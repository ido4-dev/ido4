/**
 * SandboxService — Creates, destroys, and resets governed sandbox environments.
 *
 * Bootstraps standalone (like ProjectInitService) — creates its own GraphQL client.
 * Does NOT live in ServiceContainer. Each operation manages its own infrastructure.
 *
 * Create flow:
 * 1. ProjectInitService.initializeProject() → creates project + fields + config
 * 2. Read generated config → field IDs, status option IDs
 * 3. Initialize ServiceContainer from new config
 * 4. Create epic issues → record ref→issueNumber map
 * 5. Create task issues via taskService.createTask() → sets all fields
 * 6. Create sub-issue relationships → delay + status re-set (GitHub API quirk)
 * 7. Close Done tasks (Wave 1 tasks)
 * 8. Seed audit trail events via event bus (AuditService persists automatically)
 * 9. Seed agents (register + lock T7 to alpha)
 * 10. Seed PRs for tasks with seedPR config
 * 11. Add context comments with temporal language
 * 12. Write governance memory seed file
 * 13. Append sandbox marker to config (with sandboxArtifacts)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ILogger } from '../../shared/logger.js';
import type { IGraphQLClient } from '../../container/interfaces.js';
import type { DomainEvent, TaskTransitionEvent } from '../../shared/events/types.js';
import { ServiceContainer } from '../../container/service-container.js';
import { ProjectInitService } from '../projects/project-init-service.js';
import { ConfigurationError, ValidationError } from '../../shared/errors/index.js';
import { SYSTEM_ACTOR } from '../../shared/actor.js';
import { GOVERNANCE_SHOWCASE } from './scenarios/governance-showcase.js';
import type {
  ISandboxService,
  SandboxCreateOptions,
  SandboxCreateResult,
  SandboxDestroyResult,
  SandboxResetResult,
  SandboxScenario,
  SeededPRArtifact,
} from './types.js';

/** Delay between sub-issue creation to avoid GitHub API race conditions */
const SUB_ISSUE_DELAY_MS = 1000;

export class SandboxService implements ISandboxService {
  private readonly scenarios: Map<string, SandboxScenario>;

  constructor(
    private readonly graphqlClient: IGraphQLClient,
    private readonly logger: ILogger,
  ) {
    this.scenarios = new Map();
    this.scenarios.set(GOVERNANCE_SHOWCASE.id, GOVERNANCE_SHOWCASE);
  }

  async createSandbox(options: SandboxCreateOptions): Promise<SandboxCreateResult> {
    const scenarioId = options.scenarioId ?? 'governance-showcase';
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new ValidationError({
        message: `Unknown scenario: '${scenarioId}'`,
        context: { scenarioId, available: Array.from(this.scenarios.keys()) },
        remediation: `Use one of: ${Array.from(this.scenarios.keys()).join(', ')}`,
      });
    }

    // Check no existing sandbox
    await this.ensureNoExistingSandbox(options.projectRoot);

    this.logger.info('Creating sandbox', { scenario: scenarioId, repository: options.repository });

    // Step 1: Initialize project via ProjectInitService
    const initService = new ProjectInitService(this.graphqlClient, this.logger);
    const initResult = await initService.initializeProject({
      mode: 'create',
      repository: options.repository,
      projectName: `ido4 Sandbox — ${scenario.name}`,
      projectRoot: options.projectRoot,
    });

    this.logger.info('Project initialized', { projectId: initResult.project.id });

    // Step 2: Initialize ServiceContainer from the new config
    const container = await ServiceContainer.create({
      projectRoot: options.projectRoot,
      logger: this.logger,
    });

    // Step 3: Create epic issues
    const epicRefToIssue = new Map<string, { id: string; number: number }>();
    for (const epic of scenario.epics) {
      const issue = await container.issueRepository.createIssue(epic.title, epic.body);
      await container.projectRepository.addItemToProject(issue.id);
      epicRefToIssue.set(epic.ref, { id: issue.id, number: issue.number });
      this.logger.info('Epic created', { ref: epic.ref, issueNumber: issue.number });
    }

    // Step 4: Create task issues with all fields
    const taskRefToIssue = new Map<string, { id: string; number: number }>();
    for (const task of scenario.tasks) {
      // Resolve dependency refs to issue numbers
      let dependencies: string | undefined;
      if (task.dependencyRefs && task.dependencyRefs.length > 0) {
        const depNumbers = task.dependencyRefs.map((ref) => {
          const dep = taskRefToIssue.get(ref);
          if (!dep) {
            throw new ValidationError({
              message: `Task ${task.ref} depends on ${ref}, but ${ref} hasn't been created yet`,
              context: { taskRef: task.ref, dependencyRef: ref },
              remediation: 'Ensure tasks are ordered so dependencies are created first',
            });
          }
          return `#${dep.number}`;
        });
        dependencies = depNumbers.join(', ');
      }

      // Resolve epic ref to name
      const epicIssue = epicRefToIssue.get(task.epicRef);
      const epicName = epicIssue ? `#${epicIssue.number}` : undefined;

      const createResult = await container.taskService.createTask({
        title: task.title,
        body: task.body,
        initialStatus: task.status,
        wave: task.wave,
        epic: epicName,
        dependencies,
        effort: task.effort,
        riskLevel: task.riskLevel,
        aiSuitability: task.aiSuitability,
        actor: SYSTEM_ACTOR,
      });

      if (createResult.success) {
        taskRefToIssue.set(task.ref, {
          id: createResult.data.issueId,
          number: createResult.data.issueNumber,
        });
        this.logger.info('Task created', {
          ref: task.ref,
          issueNumber: createResult.data.issueNumber,
          status: task.status,
        });
      }
    }

    // Step 5: Create sub-issue relationships (epic → task)
    let subIssueCount = 0;
    for (const task of scenario.tasks) {
      const epicIssue = epicRefToIssue.get(task.epicRef);
      const taskIssue = taskRefToIssue.get(task.ref);

      if (epicIssue && taskIssue) {
        await container.issueRepository.addSubIssue(epicIssue.id, taskIssue.id);
        subIssueCount++;

        // GitHub API quirk: adding sub-issue can reset field values.
        // Re-set the status after creating the relationship.
        await this.sleep(SUB_ISSUE_DELAY_MS);
        await container.issueRepository.updateTaskStatus(taskIssue.number, task.status);
      }
    }

    // Step 6: Close Done tasks (they need to be CLOSED on GitHub too)
    let closedCount = 0;
    const doneTasks = scenario.tasks.filter((t) => t.status === 'DONE');
    for (const task of doneTasks) {
      const taskIssue = taskRefToIssue.get(task.ref);
      if (taskIssue) {
        await container.issueRepository.closeIssue(taskIssue.number);
        closedCount++;
      }
    }

    // Step 7: Seed audit trail events
    const auditEventCount = await this.seedAuditEvents(container, taskRefToIssue);

    // Step 8: Seed agents
    const agentCount = await this.seedAgents(container, taskRefToIssue);

    // Step 9: Seed PRs for tasks with seedPR config
    const seededPRs: SeededPRArtifact[] = [];
    const tasksWithPR = scenario.tasks.filter((t) => t.seedPR);
    if (tasksWithPR.length > 0) {
      const branchInfo = await container.repositoryRepository.getDefaultBranchInfo();
      for (const task of tasksWithPR) {
        const taskIssue = taskRefToIssue.get(task.ref);
        if (taskIssue && task.seedPR) {
          const { refId } = await container.repositoryRepository.createBranch(
            branchInfo.repositoryId,
            task.seedPR.branchName,
            branchInfo.oid,
          );
          // Push a commit so the branch differs from main (required for PR creation)
          await container.repositoryRepository.createCommitOnBranch(
            options.repository,
            task.seedPR.branchName,
            branchInfo.oid,
            `.sandbox/${task.ref}.md`,
            `# ${task.title}\n\nSandbox-seeded file for governance demonstration.\n`,
            `feat: scaffold ${task.title.toLowerCase()}`,
          );
          const pr = await container.repositoryRepository.createPullRequest(
            branchInfo.repositoryId,
            {
              title: task.seedPR.prTitle,
              body: `Closes #${taskIssue.number}\n\nSandbox-seeded PR for governance demonstration.`,
              baseBranch: branchInfo.branchName,
              headBranch: task.seedPR.branchName,
            },
          );
          seededPRs.push({
            prId: pr.id,
            refId,
            branchName: task.seedPR.branchName,
            taskRef: task.ref,
          });
          this.logger.info('PR seeded', { taskRef: task.ref, prNumber: pr.number });
        }
      }
    }

    // Step 10: Add context comments with temporal language
    let commentCount = 0;
    for (const task of scenario.tasks) {
      if (task.contextComments && task.contextComments.length > 0) {
        const taskIssue = taskRefToIssue.get(task.ref);
        if (taskIssue) {
          for (const template of task.contextComments) {
            const resolved = this.resolveTaskRefs(template, taskRefToIssue);
            await container.issueRepository.addComment(taskIssue.number, resolved);
            commentCount++;
          }
        }
      }
    }

    // Step 11: Write governance memory seed file
    await this.writeMemorySeed(options.projectRoot, scenario);

    // Step 12: Append sandbox marker to config (with artifact tracking)
    const configPath = path.join(options.projectRoot, '.ido4', 'project-info.json');
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    configData.sandbox = true;
    configData.scenarioId = scenarioId;
    if (seededPRs.length > 0) {
      configData.sandboxArtifacts = { seededPRs };
    }
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

    this.logger.info('Sandbox created successfully', {
      epics: epicRefToIssue.size,
      tasks: taskRefToIssue.size,
      subIssues: subIssueCount,
      closed: closedCount,
      pullRequests: seededPRs.length,
      comments: commentCount,
      auditEvents: auditEventCount,
      agents: agentCount,
    });

    return {
      success: true,
      project: {
        id: initResult.project.id,
        number: initResult.project.number,
        title: initResult.project.title,
        url: initResult.project.url,
        repository: initResult.project.repository,
      },
      scenario: scenarioId,
      created: {
        epics: epicRefToIssue.size,
        tasks: taskRefToIssue.size,
        subIssueRelationships: subIssueCount,
        closedTasks: closedCount,
        pullRequests: seededPRs.length,
        contextComments: commentCount,
        auditEvents: auditEventCount,
        registeredAgents: agentCount,
      },
      configPath,
    };
  }

  async destroySandbox(projectRoot: string): Promise<SandboxDestroyResult> {
    // Step 1: Read config and verify sandbox marker
    const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
    let configData: Record<string, unknown>;

    try {
      configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch {
      throw new ConfigurationError({
        message: 'No .ido4/project-info.json found — cannot destroy sandbox',
        remediation: 'Ensure you are in a directory with an ido4 project',
      });
    }

    if (!configData.sandbox) {
      throw new ValidationError({
        message: 'This project is not a sandbox — refusing to destroy',
        context: { configPath },
        remediation: 'Only sandbox projects (created with create_sandbox) can be destroyed. This safety check prevents accidental deletion of real projects.',
      });
    }

    const projectId = (configData.project as { id: string }).id;
    this.logger.info('Destroying sandbox', { projectId });

    // Step 2: Initialize container to access repositories
    const container = await ServiceContainer.create({
      projectRoot,
      logger: this.logger,
    });

    // Step 3: List all project items and close open issues
    const items = await container.projectRepository.getProjectItems();
    let issuesClosed = 0;
    for (const item of items) {
      if (!item.content.closed) {
        try {
          await container.issueRepository.closeIssue(item.content.number);
          issuesClosed++;
        } catch (error) {
          this.logger.warn('Failed to close issue during destroy', {
            issueNumber: item.content.number,
            error,
          });
        }
      }
    }

    // Step 4: Clean up seeded PRs and branches
    const artifacts = configData.sandboxArtifacts as { seededPRs?: SeededPRArtifact[] } | undefined;
    if (artifacts?.seededPRs) {
      for (const pr of artifacts.seededPRs) {
        try {
          await container.repositoryRepository.closePullRequest(pr.prId);
        } catch (error) {
          this.logger.warn('Failed to close seeded PR during destroy', { prId: pr.prId, error });
        }
        try {
          await container.repositoryRepository.deleteBranch(pr.refId);
        } catch (error) {
          this.logger.warn('Failed to delete sandbox branch during destroy', { refId: pr.refId, error });
        }
      }
    }

    // Step 5: Delete the project
    await container.projectRepository.deleteProject();

    // Step 6: Remove config file
    await fs.unlink(configPath);

    // Remove memory seed file if it exists
    const memorySeedPath = path.join(projectRoot, '.ido4', 'sandbox-memory-seed.md');
    try {
      await fs.unlink(memorySeedPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Remove audit log if it exists
    const auditLogPath = path.join(projectRoot, '.ido4', 'audit-log.jsonl');
    try {
      await fs.unlink(auditLogPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Remove agent locks if they exist
    const agentLocksPath = path.join(projectRoot, '.ido4', 'agent-locks.json');
    try {
      await fs.unlink(agentLocksPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Also remove git-workflow.json if it exists
    const gitWorkflowPath = path.join(projectRoot, '.ido4', 'git-workflow.json');
    try {
      await fs.unlink(gitWorkflowPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Try to remove .ido4 directory if empty
    try {
      await fs.rmdir(path.join(projectRoot, '.ido4'));
    } catch {
      // Ignore if not empty or doesn't exist
    }

    this.logger.info('Sandbox destroyed', { projectId, issuesClosed });

    return {
      success: true,
      projectId,
      issuesClosed,
      projectDeleted: true,
      configRemoved: true,
    };
  }

  async resetSandbox(options: SandboxCreateOptions): Promise<SandboxResetResult> {
    this.logger.info('Resetting sandbox', { repository: options.repository });

    const destroyed = await this.destroySandbox(options.projectRoot);
    const created = await this.createSandbox(options);

    return { destroyed, created };
  }

  /** Overridable sleep for testing */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resolves #T_REF placeholders in comment templates to actual issue numbers.
   * e.g., "#T7" → "#42" where T7 was created as issue #42.
   */
  private resolveTaskRefs(
    template: string,
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): string {
    return template.replace(/#(T\d+)/g, (_match, ref: string) => {
      const issue = taskRefToIssue.get(ref);
      return issue ? `#${issue.number}` : `#${ref}`;
    });
  }

  /**
   * Seeds audit trail events via the event bus — AuditService persists automatically.
   * Creates ~25 TaskTransitionEvents with spread timestamps for realistic temporal analysis.
   */
  private async seedAuditEvents(
    container: { eventBus: { emit: (event: DomainEvent) => void }; sessionId?: string },
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): Promise<number> {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const sessionId = (container as { sessionId?: string }).sessionId ?? 'sandbox-seed';

    const makeEvent = (
      issueRef: string,
      transition: string,
      fromStatus: string,
      toStatus: string,
      daysAgo: number,
      hoursOffset = 0,
    ): TaskTransitionEvent | null => {
      const issue = taskRefToIssue.get(issueRef);
      if (!issue) return null;
      return {
        type: 'task.transition' as const,
        timestamp: new Date(now - daysAgo * DAY + hoursOffset * HOUR).toISOString(),
        sessionId,
        actor: SYSTEM_ACTOR,
        issueNumber: issue.number,
        fromStatus,
        toStatus,
        transition,
        dryRun: false,
      };
    };

    const events: (TaskTransitionEvent | null)[] = [
      // Wave-001 tasks T1-T5 (Done): start→review→approve (10-8 days ago)
      makeEvent('T1', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 10, 0),
      makeEvent('T1', 'review', 'IN_PROGRESS', 'IN_REVIEW', 10, 4),
      makeEvent('T1', 'approve', 'IN_REVIEW', 'DONE', 9, 0),
      makeEvent('T2', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 10, 1),
      makeEvent('T2', 'review', 'IN_PROGRESS', 'IN_REVIEW', 9, 2),
      makeEvent('T2', 'approve', 'IN_REVIEW', 'DONE', 8, 0),
      makeEvent('T3', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 10, 2),
      makeEvent('T3', 'review', 'IN_PROGRESS', 'IN_REVIEW', 9, 4),
      makeEvent('T3', 'approve', 'IN_REVIEW', 'DONE', 9, 6),
      makeEvent('T4', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 9, 1),
      makeEvent('T4', 'review', 'IN_PROGRESS', 'IN_REVIEW', 8, 4),
      makeEvent('T4', 'approve', 'IN_REVIEW', 'DONE', 8, 6),
      makeEvent('T5', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 9, 3),
      makeEvent('T5', 'review', 'IN_PROGRESS', 'IN_REVIEW', 8, 2),
      makeEvent('T5', 'approve', 'IN_REVIEW', 'DONE', 8, 4),
      // Wave-002 Done tasks: T6 and T15
      makeEvent('T6', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 5, 0),
      makeEvent('T6', 'review', 'IN_PROGRESS', 'IN_REVIEW', 3, 0),
      makeEvent('T6', 'approve', 'IN_REVIEW', 'DONE', 0, -6), // 6 hours ago — within 24h freshness window
      makeEvent('T15', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 4, 0),
      makeEvent('T15', 'review', 'IN_PROGRESS', 'IN_REVIEW', 2, 0),
      makeEvent('T15', 'approve', 'IN_REVIEW', 'DONE', 1, 4),
      // T7 (In Progress): started 4 days ago
      makeEvent('T7', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 4, 0),
      // T8, T9 (Blocked): blocked 3 days ago
      makeEvent('T8', 'block', 'READY_FOR_DEV', 'BLOCKED', 3, 0),
      makeEvent('T9', 'block', 'READY_FOR_DEV', 'BLOCKED', 3, 1),
      // T10 (In Review): start 6 days ago, review 5 days ago
      makeEvent('T10', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 6, 0),
      makeEvent('T10', 'review', 'IN_PROGRESS', 'IN_REVIEW', 5, 0),
      // T12 (In Review): start 5 days ago, review 4 days ago
      makeEvent('T12', 'start', 'READY_FOR_DEV', 'IN_PROGRESS', 5, 0),
      makeEvent('T12', 'review', 'IN_PROGRESS', 'IN_REVIEW', 4, 0),
    ];

    let count = 0;
    for (const event of events) {
      if (event) {
        container.eventBus.emit(event as DomainEvent);
        count++;
      }
    }

    this.logger.info('Audit events seeded', { count });
    return count;
  }

  /**
   * Seeds agent registrations and task locks for work distribution testing.
   */
  private async seedAgents(
    container: { agentService: { registerAgent: (reg: { agentId: string; name: string; role: 'coding'; capabilities: string[] }) => Promise<unknown>; lockTask: (agentId: string, issueNumber: number) => Promise<unknown> } },
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): Promise<number> {
    // Register agent-alpha: backend/data specialist, locked on T7
    await container.agentService.registerAgent({
      agentId: 'agent-alpha',
      name: 'Alpha',
      role: 'coding',
      capabilities: ['backend', 'data', 'etl'],
    });

    // Register agent-beta: frontend/auth specialist, available
    await container.agentService.registerAgent({
      agentId: 'agent-beta',
      name: 'Beta',
      role: 'coding',
      capabilities: ['frontend', 'auth', 'security'],
    });

    // Lock T7 to agent-alpha (realistic: alpha is working on ETL)
    const t7 = taskRefToIssue.get('T7');
    if (t7) {
      await container.agentService.lockTask('agent-alpha', t7.number);
    }

    this.logger.info('Agents seeded', { count: 2, lockedTask: 'T7' });
    return 2;
  }

  /**
   * Writes a governance memory seed file for cross-skill intelligence.
   * The sandbox skill reads this and writes it to Claude Code's auto-memory.
   */
  private async writeMemorySeed(projectRoot: string, scenario: SandboxScenario): Promise<void> {
    const wave1Tasks = scenario.tasks.filter((t) => t.wave === 'wave-001-foundation');
    const wave2Tasks = scenario.tasks.filter((t) => t.wave === 'wave-002-core');
    const doneInWave2 = wave2Tasks.filter((t) => t.status === 'DONE').length;
    const blockedInWave2 = wave2Tasks.filter((t) => t.status === 'BLOCKED').length;

    const seed = [
      '# Sandbox Governance Memory Seed',
      '',
      '## Wave-001 Retro Findings',
      `- **Velocity baseline**: ${wave1Tasks.length} tasks completed in wave-001-foundation`,
      '- **Delivery pattern**: All tasks in a single epic (Infrastructure) — clean, focused delivery',
      '- **Effort distribution**: Mix of S/M/L tasks, no XL tasks — good task sizing',
      '- **AI suitability**: Mix of AI_ONLY, AI_REVIEWED, and HYBRID — balanced approach',
      '',
      '## Compliance Baseline',
      '- **Epic Integrity violation**: Auth epic (E3) has tasks split across wave-002 and wave-003',
      '  - T10, T11, T12 in wave-002-core; T16 (RBAC) in wave-003-advanced',
      '  - Severity: HIGH — authentication is a cross-cutting concern that should ship atomically',
      '- **Clean epics**: E1 (Infrastructure), E2 (Data Pipeline), E4 (Dashboard), E5 (Documentation)',
      '',
      '## Active Governance Signals',
      '- **False Status**: T10 (Auth token service) is In Review but has no associated PR',
      '- **Review Bottleneck**: T12 (Session management) has a PR but no reviews after 4 days',
      '- **Cascade Blocker**: T7 (ETL) → T8 (Validation) → T9 (Rate limiting) — 3-level dependency chain',
      '- **Wave Risk**: wave-002-core has ' + `${doneInWave2}/${wave2Tasks.length}` + ' tasks done with ' + `${blockedInWave2}` + ' blocked',
      '',
      '## Velocity Data',
      `- Wave-001: ${wave1Tasks.length} tasks completed (baseline)`,
      `- Wave-002: ${doneInWave2}/${wave2Tasks.length} tasks completed (${Math.round((doneInWave2 / wave2Tasks.length) * 100)}% done)`,
      `- Projected waves: ${scenario.waves.length - 2} remaining`,
      '',
      '## Known Patterns',
      '- Infrastructure tasks (E1) have lowest risk and highest AI suitability',
      '- Authentication tasks (E3) are marked HUMAN_ONLY or HYBRID — governance-correct for security-sensitive work',
      '- XL effort tasks (T7, T14) tend to become blockers — consider breaking down in future waves',
      '',
      '## Active Agents',
      '- **agent-alpha**: coding (backend, data, etl) — currently locked on T7 (ETL transformations)',
      '- **agent-beta**: coding (frontend, auth, security) — available for assignment',
      '',
      '## Work Distribution Signals',
      '- T13 (Data export) has highest cascade value: T14 depends on it (depth-1 non-Done dependent)',
      '- T11 (OAuth) matches agent-beta capability profile (auth, security)',
      '- T14 (Batch processing) is in refinement — not yet startable',
      '',
      '## Coordination Observations',
      '- agent-alpha has been on T7 (ETL) for 4 days — monitor for stall risk',
      '- When T7 completes: handoff opportunity — T8 and T9 unblock, cascade resolves',
      '- agent-beta is idle — assign to highest-value ready task matching capabilities',
    ].join('\n');

    const seedPath = path.join(projectRoot, '.ido4', 'sandbox-memory-seed.md');
    await fs.writeFile(seedPath, seed);
    this.logger.info('Memory seed written', { path: seedPath });
  }

  private async ensureNoExistingSandbox(projectRoot: string): Promise<void> {
    const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.sandbox) {
        throw new ValidationError({
          message: 'A sandbox already exists in this project',
          context: { configPath },
          remediation: 'Use reset_sandbox to recreate, or destroy_sandbox first',
        });
      }
      throw new ValidationError({
        message: 'A real ido4 project already exists in this directory',
        context: { configPath },
        remediation: 'Use a different directory for the sandbox, or remove the existing project first',
      });
    } catch (error) {
      // If it's our own ValidationError, re-throw
      if (error instanceof ValidationError) throw error;
      // File doesn't exist — good, we can proceed
    }
  }
}
