/**
 * SandboxService — Creates, destroys, and resets governed sandbox environments.
 *
 * Bootstraps standalone (like ProjectInitService) — creates its own GraphQL client.
 * Does NOT live in ServiceContainer. Each operation manages its own infrastructure.
 *
 * Now methodology-agnostic: resolves profile from scenario's profileId,
 * creates profile-appropriate fields and statuses, and handles all container
 * types generically.
 *
 * Create flow:
 * 1. Resolve profile from scenario's profileId
 * 2. ProjectInitService.initializeProject() with profile → creates project + fields + config
 * 3. Read generated config → field IDs, status option IDs
 * 4. Initialize ServiceContainer from new config
 * 5. Create parent issues (epics, bets) → record ref→issueNumber map
 * 6. Create task issues via taskService.createTask() → sets all container fields
 * 7. Create sub-issue relationships from task.parentRef
 * 8. Close tasks in terminal states (using profile.semantics.terminalStates)
 * 9. Seed audit trail events from scenario.auditEvents
 * 10. Seed agents from scenario.agents
 * 11. Seed PRs for tasks with seedPR config
 * 12. Add context comments with temporal language
 * 13. Write container metadata (for circuit breaker time enforcement)
 * 14. Write governance memory seed file
 * 15. Append sandbox marker to config (with sandboxArtifacts)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ILogger } from '../../shared/logger.js';
import type { IGraphQLClient } from '../../container/interfaces.js';
import type { DomainEvent, TaskTransitionEvent } from '../../shared/events/types.js';
import { ServiceContainer } from '../../container/service-container.js';
import { ProjectInitService } from '../projects/project-init-service.js';
import { ProfileRegistry } from '../../profiles/registry.js';
import { ValidationError } from '../../shared/errors/index.js';
import { SYSTEM_ACTOR } from '../../shared/actor.js';
import { HYDRO_GOVERNANCE } from './scenarios/hydro-governance.js';
import { SCRUM_SPRINT } from './scenarios/scrum-sprint.js';
import { SHAPE_UP_CYCLE } from './scenarios/shape-up-cycle.js';
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
    this.scenarios.set(HYDRO_GOVERNANCE.id, HYDRO_GOVERNANCE);
    this.scenarios.set(SCRUM_SPRINT.id, SCRUM_SPRINT);
    this.scenarios.set(SHAPE_UP_CYCLE.id, SHAPE_UP_CYCLE);
  }

  async createSandbox(options: SandboxCreateOptions): Promise<SandboxCreateResult> {
    const scenarioId = options.scenarioId ?? 'hydro-governance';
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

    // Resolve profile from scenario
    const profile = ProfileRegistry.getBuiltin(scenario.profileId);

    this.logger.info('Creating sandbox', {
      scenario: scenarioId,
      repository: options.repository,
      profile: profile.id,
    });

    // Step 1: Initialize project via ProjectInitService (profile-aware)
    const initService = new ProjectInitService(this.graphqlClient, this.logger, profile);
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

    // Step 3: Create parent issues (epics, bets, etc.)
    const parentRefToIssue = new Map<string, { id: string; number: number }>();
    for (const parent of scenario.parentIssues) {
      const issue = await container.issueRepository.createIssue(parent.title, parent.body);
      await container.projectRepository.addItemToProject(issue.id);
      parentRefToIssue.set(parent.ref, { id: issue.id, number: issue.number });
      this.logger.info('Parent issue created', { ref: parent.ref, issueNumber: issue.number });
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

      // Build container assignments — resolve parent refs to issue numbers
      const containers: Record<string, string> = {};
      for (const [containerType, containerValue] of Object.entries(task.containers)) {
        // If the value starts with '#' and matches a parent ref, resolve to issue number
        if (containerValue.startsWith('#')) {
          const parentRef = containerValue.slice(1);
          const parentIssue = parentRefToIssue.get(parentRef);
          if (parentIssue) {
            containers[containerType] = `#${parentIssue.number}`;
          } else {
            containers[containerType] = containerValue;
          }
        } else {
          containers[containerType] = containerValue;
        }
      }

      const createResult = await container.taskService.createTask({
        title: task.title,
        body: task.body,
        initialStatus: task.status,
        containers,
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

    // Step 5: Create sub-issue relationships (parent → task)
    let subIssueCount = 0;
    for (const task of scenario.tasks) {
      if (!task.parentRef) continue;

      const parentIssue = parentRefToIssue.get(task.parentRef);
      const taskIssue = taskRefToIssue.get(task.ref);

      if (parentIssue && taskIssue) {
        await container.issueRepository.addSubIssue(parentIssue.id, taskIssue.id);
        subIssueCount++;

        // GitHub API quirk: adding sub-issue can reset field values.
        // Re-set the status after creating the relationship.
        await this.sleep(SUB_ISSUE_DELAY_MS);
        await container.issueRepository.updateTaskStatus(taskIssue.number, task.status);
      }
    }

    // Step 6: Close tasks in terminal states
    let closedCount = 0;
    const terminalStates = new Set(profile.semantics.terminalStates);
    const terminalTasks = scenario.tasks.filter((t) => terminalStates.has(t.status));
    for (const task of terminalTasks) {
      const taskIssue = taskRefToIssue.get(task.ref);
      if (taskIssue) {
        await container.issueRepository.closeIssue(taskIssue.number);
        closedCount++;
      }
    }

    // Step 7: Seed audit trail events
    const auditEventCount = await this.seedAuditEvents(container, scenario, taskRefToIssue);

    // Step 8: Seed agents
    const agentCount = await this.seedAgents(container, scenario, taskRefToIssue);

    // Step 9: Seed PRs for tasks with seedPR config
    const seededPRs: SeededPRArtifact[] = [];
    const tasksWithPR = scenario.tasks.filter((t) => t.seedPR);
    if (tasksWithPR.length > 0) {
      const branchInfo = await container.repositoryRepository.getDefaultBranchInfo();
      for (const task of tasksWithPR) {
        const taskIssue = taskRefToIssue.get(task.ref);
        if (taskIssue && task.seedPR) {
          let refId: string;
          try {
            ({ refId } = await container.repositoryRepository.createBranch(
              branchInfo.repositoryId,
              task.seedPR.branchName,
              branchInfo.oid,
            ));
          } catch (branchError) {
            // Branch may exist from a previous aborted run — delete and retry
            const errMsg = branchError instanceof Error ? branchError.message : String(branchError);
            if (errMsg.includes('already exists')) {
              this.logger.info('Deleting leftover branch before retry', { branchName: task.seedPR.branchName });
              await this.deleteStaleRef(container, branchInfo.repositoryId, task.seedPR.branchName);
              ({ refId } = await container.repositoryRepository.createBranch(
                branchInfo.repositoryId,
                task.seedPR.branchName,
                branchInfo.oid,
              ));
            } else {
              throw branchError;
            }
          }
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

    // Step 11: Write container metadata (for circuit breaker time enforcement)
    await this.writeContainerMetadata(options.projectRoot, scenario);

    // Step 12: Write governance memory seed file
    await this.writeMemorySeed(options.projectRoot, scenario);

    // Step 13: Append sandbox marker to config (with artifact tracking)
    const configPath = path.join(options.projectRoot, '.ido4', 'project-info.json');
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    configData.sandbox = true;
    configData.scenarioId = scenarioId;
    if (seededPRs.length > 0) {
      configData.sandboxArtifacts = { seededPRs };
    }
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

    this.logger.info('Sandbox created successfully', {
      parentIssues: parentRefToIssue.size,
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
        parentIssues: parentRefToIssue.size,
        containerInstances: scenario.containerInstances.length,
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
      // No config at all — nothing to destroy. Do NOT touch .ido4/ since
      // we can't verify this was a sandbox. Only return success (idempotent).
      return { success: true, projectId: '', issuesClosed: 0, projectDeleted: false, configRemoved: false };
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

    // Step 2: Try to clean up GitHub resources — resilient to failures
    // (project may have been manually deleted, API may be unavailable)
    let issuesClosed = 0;
    let projectDeleted = false;

    try {
      const container = await ServiceContainer.create({
        projectRoot,
        logger: this.logger,
      });

      // Close open issues
      try {
        const items = await container.projectRepository.getProjectItems();
        for (const item of items) {
          if (!item.content.closed) {
            try {
              await container.issueRepository.closeIssue(item.content.number);
              issuesClosed++;
            } catch {
              this.logger.warn('Failed to close issue during destroy', { issueNumber: item.content.number });
            }
          }
        }
      } catch {
        this.logger.warn('Could not list project items — project may already be deleted');
      }

      // Clean up seeded PRs and branches
      const artifacts = configData.sandboxArtifacts as { seededPRs?: SeededPRArtifact[] } | undefined;
      if (artifacts?.seededPRs) {
        for (const pr of artifacts.seededPRs) {
          try { await container.repositoryRepository.closePullRequest(pr.prId); } catch {
            this.logger.warn('Failed to close seeded PR', { prId: pr.prId });
          }
          try { await container.repositoryRepository.deleteBranch(pr.refId); } catch {
            this.logger.warn('Failed to delete sandbox branch', { refId: pr.refId });
          }
        }
      }

      // Delete the project — verify title contains "Sandbox" first (belt-and-suspenders)
      try {
        const isSandboxProject = await this.verifySandboxProject(projectId);
        if (isSandboxProject) {
          await container.projectRepository.deleteProject();
          projectDeleted = true;
        } else {
          this.logger.warn('Project title does not contain "Sandbox" — refusing to delete', { projectId });
        }
      } catch {
        this.logger.warn('Failed to delete GitHub project — may already be deleted', { projectId });
      }
    } catch {
      // ServiceContainer.create() failed — project config is stale.
      // Skip all GitHub cleanup, just remove local files.
      this.logger.warn('Could not initialize services — cleaning up local files only', { projectId });
    }

    // Step 3: Always remove local files regardless of GitHub cleanup outcome
    await this.removeLocalConfig(projectRoot);

    this.logger.info('Sandbox destroyed', { projectId, issuesClosed, projectDeleted });

    return {
      success: true,
      projectId,
      issuesClosed,
      projectDeleted,
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
   * Seeds audit trail events from scenario data via the event bus.
   * AuditService persists automatically.
   */
  private async seedAuditEvents(
    container: { eventBus: { emit: (event: DomainEvent) => void }; sessionId?: string },
    scenario: SandboxScenario,
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): Promise<number> {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const sessionId = (container as { sessionId?: string }).sessionId ?? 'sandbox-seed';

    let count = 0;
    for (const event of scenario.auditEvents) {
      const issue = taskRefToIssue.get(event.taskRef);
      if (!issue) continue;

      const transitionEvent: TaskTransitionEvent = {
        type: 'task.transition' as const,
        timestamp: new Date(now - event.daysAgo * DAY + (event.hoursOffset ?? 0) * HOUR).toISOString(),
        sessionId,
        actor: SYSTEM_ACTOR,
        issueNumber: issue.number,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        transition: event.transition,
        dryRun: false,
      };

      container.eventBus.emit(transitionEvent as DomainEvent);
      count++;
    }

    this.logger.info('Audit events seeded', { count });
    return count;
  }

  /**
   * Seeds agent registrations and task locks from scenario data.
   */
  private async seedAgents(
    container: { agentService: { registerAgent: (reg: { agentId: string; name: string; role: 'coding'; capabilities: string[] }) => Promise<unknown>; lockTask: (agentId: string, issueNumber: number) => Promise<unknown> } },
    scenario: SandboxScenario,
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): Promise<number> {
    if (!scenario.agents) return 0;

    for (const agent of scenario.agents.agents) {
      await container.agentService.registerAgent(agent);
    }

    if (scenario.agents.locks) {
      for (const lock of scenario.agents.locks) {
        const taskIssue = taskRefToIssue.get(lock.taskRef);
        if (taskIssue) {
          await container.agentService.lockTask(lock.agentId, taskIssue.number);
        }
      }
    }

    const agentCount = scenario.agents.agents.length;
    this.logger.info('Agents seeded', {
      count: agentCount,
      locks: scenario.agents.locks?.length ?? 0,
    });
    return agentCount;
  }

  /**
   * Writes container metadata for containers that have startDate or other metadata.
   * Used by circuit breaker time enforcement.
   */
  private async writeContainerMetadata(
    projectRoot: string,
    scenario: SandboxScenario,
  ): Promise<void> {
    const containersWithMetadata = scenario.containerInstances.filter(
      (ci) => ci.metadata && Object.keys(ci.metadata).length > 0,
    );

    if (containersWithMetadata.length === 0) return;

    const metadata: Record<string, Record<string, unknown>> = {};
    for (const ci of containersWithMetadata) {
      metadata[ci.name] = ci.metadata!;
    }

    const metadataPath = path.join(projectRoot, '.ido4', 'container-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    this.logger.info('Container metadata written', {
      path: metadataPath,
      containers: containersWithMetadata.map((c) => c.name),
    });
  }

  /**
   * Writes the governance memory seed file from the scenario's memorySeed string.
   */
  private async writeMemorySeed(projectRoot: string, scenario: SandboxScenario): Promise<void> {
    const seedPath = path.join(projectRoot, '.ido4', 'sandbox-memory-seed.md');
    await fs.writeFile(seedPath, scenario.memorySeed);
    this.logger.info('Memory seed written', { path: seedPath });
  }

  private async ensureNoExistingSandbox(projectRoot: string): Promise<void> {
    const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
    let data: string;
    try {
      data = await fs.readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist — good, we can proceed
      return;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(data);
    } catch {
      // Corrupt config — remove it and proceed
      this.logger.warn('Removing corrupt .ido4/project-info.json');
      await this.removeLocalConfig(projectRoot);
      return;
    }

    if (config.sandbox) {
      // Stale sandbox — auto-destroy and proceed
      this.logger.info('Found stale sandbox config — auto-cleaning before creating new sandbox');
      await this.destroySandbox(projectRoot);
      return;
    }

    throw new ValidationError({
      message: 'A real ido4 project already exists in this directory',
      context: { configPath },
      remediation: 'Use a different directory for the sandbox, or remove the existing project first',
    });
  }

  /**
   * Deletes a branch ref by looking it up first.
   * Used to clean up leftover branches from aborted sandbox runs.
   */
  private async deleteStaleRef(
    container: { repositoryRepository: { deleteBranch: (refId: string) => Promise<void> } },
    repositoryId: string,
    branchName: string,
  ): Promise<void> {
    // Look up the ref ID by querying the repository
    const result = await this.graphqlClient.query<{
      node: { ref: { id: string } | null } | null;
    }>(
      `query GetRef($repositoryId: ID!, $qualifiedName: String!) {
        node(id: $repositoryId) {
          ... on Repository { ref(qualifiedName: $qualifiedName) { id } }
        }
      }`,
      { repositoryId, qualifiedName: `refs/heads/${branchName}` },
    );

    const refId = result.node?.ref?.id;
    if (refId) {
      await container.repositoryRepository.deleteBranch(refId);
      this.logger.info('Stale branch deleted', { branchName });
    }
  }

  /**
   * Verifies a GitHub project is a sandbox by checking its title.
   * Returns false if the project doesn't exist or title doesn't contain "Sandbox".
   */
  private async verifySandboxProject(projectId: string): Promise<boolean> {
    try {
      const result = await this.graphqlClient.query<{
        node: { title: string } | null;
      }>(
        `query GetProjectTitle($projectId: ID!) { node(id: $projectId) { ... on ProjectV2 { title } } }`,
        { projectId },
      );
      const title = result.node?.title ?? '';
      return title.includes('Sandbox');
    } catch {
      // Project not found or API error — treat as already gone
      return false;
    }
  }

  /** Files that sandbox creates — only these are removed during cleanup. */
  private static readonly SANDBOX_FILES = [
    'project-info.json',
    'methodology-profile.json',
    'git-workflow.json',
    'sandbox-memory-seed.md',
    'audit-log.jsonl',
    'agent-locks.json',
    'container-metadata.json',
  ];

  /**
   * Removes only known sandbox-generated files from .ido4/.
   * Never removes files it didn't create — protects user-added config.
   */
  private async removeLocalConfig(projectRoot: string): Promise<void> {
    const ido4Dir = path.join(projectRoot, '.ido4');

    for (const fileName of SandboxService.SANDBOX_FILES) {
      try {
        await fs.unlink(path.join(ido4Dir, fileName));
      } catch {
        // File doesn't exist — ok
      }
    }

    // Only remove .ido4/ if it's now empty
    try {
      await fs.rmdir(ido4Dir);
    } catch {
      // Not empty (user has other files) or doesn't exist — leave it
    }
  }
}
