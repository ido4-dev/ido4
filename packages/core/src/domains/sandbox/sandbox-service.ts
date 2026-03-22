/**
 * SandboxService — Creates, destroys, and resets governed sandbox environments.
 *
 * v2 architecture: Uses the ingestion pipeline to create issues from a technical spec,
 * then applies post-ingestion state simulation, violation injection, and seeding.
 * The sandbox eats ido4's own dogfood — the same pipeline that governs real projects
 * creates the demo project.
 *
 * Bootstraps standalone (like ProjectInitService) — creates its own GraphQL client.
 * Does NOT live in ServiceContainer. Each operation manages its own infrastructure.
 *
 * Create flow:
 * Phase 1: Project setup (ProjectInitService + ServiceContainer)
 * Phase 2: Ingest technical spec (IngestionService — creates capabilities + tasks)
 * Phase 3: Container assignment + state simulation (post-ingestion field updates)
 * Phase 4: Violation injection (methodology-specific governance violations)
 * Phase 5: Seeding (audit events, agents, PRs, comments, metadata, memory seed)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ILogger } from '../../shared/logger.js';
import type { IGraphQLClient } from '../../container/interfaces.js';
import type { DomainEvent, TaskTransitionEvent } from '../../shared/events/types.js';
import { ServiceContainer } from '../../container/service-container.js';
import { ProjectInitService } from '../projects/project-init-service.js';
import { IngestionService } from '../ingestion/ingestion-service.js';
import { ProfileRegistry } from '../../profiles/registry.js';
import { ValidationError } from '../../shared/errors/index.js';
import { SYSTEM_ACTOR } from '../../shared/actor.js';
import { HYDRO_GOVERNANCE } from './scenarios/hydro-governance.js';
import { SCRUM_SPRINT } from './scenarios/scrum-sprint.js';
import { SHAPE_UP_CYCLE } from './scenarios/shape-up-cycle.js';
import { ScenarioBuilder } from './scenario-builder.js';
import type {
  ISandboxService,
  SandboxCreateOptions,
  SandboxCreateResult,
  SandboxDestroyResult,
  SandboxResetResult,
  SandboxScenario,
  ScenarioConfig,
  SeededPRArtifact,
  ViolationInjection,
} from './types.js';

/** Delay between post-ingestion field updates to avoid GitHub API race conditions */
const FIELD_UPDATE_DELAY_MS = 500;

export class SandboxService implements ISandboxService {
  private readonly configs: Map<string, ScenarioConfig>;

  constructor(
    private readonly graphqlClient: IGraphQLClient,
    private readonly logger: ILogger,
  ) {
    this.configs = new Map();
    this.configs.set(HYDRO_GOVERNANCE.id, HYDRO_GOVERNANCE);
    this.configs.set(SCRUM_SPRINT.id, SCRUM_SPRINT);
    this.configs.set(SHAPE_UP_CYCLE.id, SHAPE_UP_CYCLE);
  }

  async createSandbox(options: SandboxCreateOptions): Promise<SandboxCreateResult> {
    const scenarioId = options.scenarioId ?? 'hydro-governance';
    const config = this.configs.get(scenarioId);
    if (!config) {
      throw new ValidationError({
        message: `Unknown scenario: '${scenarioId}'`,
        context: { scenarioId, available: Array.from(this.configs.keys()) },
        remediation: `Use one of: ${Array.from(this.configs.keys()).join(', ')}`,
      });
    }

    await this.ensureNoExistingSandbox(options.projectRoot);

    const profile = ProfileRegistry.getBuiltin(config.profileId);

    this.logger.info('Creating sandbox', {
      scenario: scenarioId,
      repository: options.repository,
      profile: profile.id,
    });

    // ── Phase 1: Project Setup ──

    const initService = new ProjectInitService(this.graphqlClient, this.logger, profile);
    const initResult = await initService.initializeProject({
      mode: 'create',
      repository: options.repository,
      projectName: `ido4 Sandbox — ${config.name}`,
      projectRoot: options.projectRoot,
    });

    this.logger.info('Project initialized', { projectId: initResult.project.id });

    const container = await ServiceContainer.create({
      projectRoot: options.projectRoot,
      logger: this.logger,
    });

    // ── Phase 2: Ingest Technical Spec ──

    const ingestionService = new IngestionService(
      container.taskService,
      container.issueRepository,
      container.projectRepository,
      profile,
      this.logger,
    );

    const ingestionResult = await ingestionService.ingestSpec({
      specContent: config.technicalSpecContent,
      dryRun: false,
      profile,
    });

    if (!ingestionResult.success) {
      this.logger.warn('Ingestion had failures', {
        failed: ingestionResult.failed.length,
        warnings: ingestionResult.warnings.length,
      });
    }

    this.logger.info('Technical spec ingested', {
      capabilities: ingestionResult.created.groupIssues.length,
      tasks: ingestionResult.created.tasks.length,
      subIssues: ingestionResult.created.subIssueRelationships,
    });

    // ── Build Scenario Algorithmically ──

    const scenario = ScenarioBuilder.build(ingestionResult, profile, config);

    // Build ref → issueNumber map from ingestion result
    const taskRefToIssue = new Map<string, { id: string; number: number }>();
    for (const task of ingestionResult.created.tasks) {
      taskRefToIssue.set(task.ref, { id: '', number: task.issueNumber });
    }

    // ── Phase 3: Container Assignment + State Simulation ──

    let containerAssignmentCount = 0;
    for (const [taskRef, assignments] of Object.entries(scenario.containerAssignments)) {
      const task = taskRefToIssue.get(taskRef);
      if (!task) continue;

      for (const [containerType, containerValue] of Object.entries(assignments)) {
        try {
          await container.issueRepository.updateTaskField(
            task.number,
            containerType,
            containerValue,
          );
          containerAssignmentCount++;
          await this.sleep(FIELD_UPDATE_DELAY_MS);
        } catch (err) {
          this.logger.warn('Failed to assign container', {
            taskRef, containerType, containerValue,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.logger.info('Container assignments applied', { count: containerAssignmentCount });

    // State transitions
    let stateTransitionCount = 0;
    let closedCount = 0;
    const terminalStates = new Set(profile.semantics.terminalStates);

    for (const [taskRef, targetStatus] of Object.entries(scenario.taskStates)) {
      const task = taskRefToIssue.get(taskRef);
      if (!task) continue;

      try {
        await container.issueRepository.updateTaskStatus(task.number, targetStatus);
        stateTransitionCount++;

        if (terminalStates.has(targetStatus)) {
          await container.issueRepository.closeIssue(task.number);
          closedCount++;
        }

        await this.sleep(FIELD_UPDATE_DELAY_MS);
      } catch (err) {
        this.logger.warn('Failed to transition task', {
          taskRef, targetStatus,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.info('State simulation applied', {
      transitions: stateTransitionCount,
      closed: closedCount,
    });

    // ── Phase 4: Violation Injection ──

    let violationCount = 0;
    for (const violation of scenario.violations) {
      const task = taskRefToIssue.get(violation.taskRef);
      if (!task) continue;

      try {
        await this.injectViolation(container, task.number, violation);
        violationCount++;
      } catch (err) {
        this.logger.warn('Failed to inject violation', {
          type: violation.type, taskRef: violation.taskRef,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.info('Violations injected', { count: violationCount });

    // ── Phase 5: Seeding ──

    const auditEventCount = await this.seedAuditEvents(container, scenario, taskRefToIssue);
    const agentCount = await this.seedAgents(container, scenario, taskRefToIssue);

    // Seed PRs
    const seededPRs: SeededPRArtifact[] = [];
    if (scenario.prSeeds && scenario.prSeeds.length > 0) {
      const branchInfo = await container.repositoryRepository.getDefaultBranchInfo();
      for (const prSeed of scenario.prSeeds) {
        const taskIssue = taskRefToIssue.get(prSeed.taskRef);
        if (!taskIssue) continue;

        try {
          let refId: string;
          try {
            ({ refId } = await container.repositoryRepository.createBranch(
              branchInfo.repositoryId,
              prSeed.branchName,
              branchInfo.oid,
            ));
          } catch (branchError) {
            const errMsg = branchError instanceof Error ? branchError.message : String(branchError);
            if (errMsg.includes('already exists')) {
              this.logger.info('Deleting leftover branch before retry', { branchName: prSeed.branchName });
              await this.deleteStaleRef(container, branchInfo.repositoryId, prSeed.branchName);
              ({ refId } = await container.repositoryRepository.createBranch(
                branchInfo.repositoryId,
                prSeed.branchName,
                branchInfo.oid,
              ));
            } else {
              throw branchError;
            }
          }

          const fileContent = prSeed.patchContent
            ?? `# ${prSeed.prTitle}\n\nSandbox-seeded file for governance demonstration.\n`;
          const filePath = prSeed.filePath
            ?? (prSeed.patchContent ? `src/${prSeed.taskRef.toLowerCase()}.ts` : `.sandbox/${prSeed.taskRef}.md`);

          await container.repositoryRepository.createCommitOnBranch(
            options.repository,
            prSeed.branchName,
            branchInfo.oid,
            filePath,
            fileContent,
            `feat: ${prSeed.prTitle.toLowerCase()}`,
          );

          const pr = await container.repositoryRepository.createPullRequest(
            branchInfo.repositoryId,
            {
              title: prSeed.prTitle,
              body: `Closes #${taskIssue.number}\n\nSandbox-seeded PR for governance demonstration.`,
              baseBranch: branchInfo.branchName,
              headBranch: prSeed.branchName,
            },
          );

          seededPRs.push({
            prId: pr.id,
            refId,
            branchName: prSeed.branchName,
            taskRef: prSeed.taskRef,
          });
          this.logger.info('PR seeded', { taskRef: prSeed.taskRef, prNumber: pr.number });
        } catch (err) {
          this.logger.warn('Failed to seed PR', {
            taskRef: prSeed.taskRef,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Context comments
    let commentCount = 0;
    for (const [taskRef, comments] of Object.entries(scenario.contextComments)) {
      const taskIssue = taskRefToIssue.get(taskRef);
      if (!taskIssue) continue;

      for (const template of comments) {
        const resolved = this.resolveTaskRefs(template, taskRefToIssue);
        await container.issueRepository.addComment(taskIssue.number, resolved);
        commentCount++;
      }
    }

    // Container metadata, memory seed, config update
    await this.writeContainerMetadata(options.projectRoot, scenario);
    await this.writeMemorySeed(options.projectRoot, scenario);

    const configPath = path.join(options.projectRoot, '.ido4', 'project-info.json');
    const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    configData.sandbox = true;
    configData.scenarioId = scenarioId;
    if (seededPRs.length > 0) {
      configData.sandboxArtifacts = { seededPRs };
    }
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

    this.logger.info('Sandbox created successfully', {
      capabilities: ingestionResult.created.groupIssues.length,
      tasks: ingestionResult.created.tasks.length,
      containerAssignments: containerAssignmentCount,
      stateTransitions: stateTransitionCount,
      violations: violationCount,
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
        capabilities: ingestionResult.created.groupIssues.length,
        tasks: ingestionResult.created.tasks.length,
        subIssueRelationships: ingestionResult.created.subIssueRelationships,
        containerAssignments: containerAssignmentCount,
        stateTransitions: stateTransitionCount,
        violations: violationCount,
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
    const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
    let configData: Record<string, unknown>;

    try {
      configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch {
      return { success: true, projectId: '', issuesClosed: 0, projectDeleted: false, configRemoved: false };
    }

    if (!configData.sandbox) {
      throw new ValidationError({
        message: 'This project is not a sandbox — refusing to destroy',
        context: { configPath },
        remediation: 'Only sandbox projects (created with create_sandbox) can be destroyed.',
      });
    }

    const projectId = (configData.project as { id: string }).id;
    this.logger.info('Destroying sandbox', { projectId });

    let issuesClosed = 0;
    let projectDeleted = false;

    try {
      const container = await ServiceContainer.create({
        projectRoot,
        logger: this.logger,
      });

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
      this.logger.warn('Could not initialize services — cleaning up local files only', { projectId });
    }

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
   * Injects a governance violation into a task using direct repository methods
   * (bypassing BRE — this is scenario setup, not real governance).
   */
  private async injectViolation(
    container: { issueRepository: { updateTaskField: (n: number, k: string, v: string, t?: string) => Promise<void> } },
    issueNumber: number,
    violation: ViolationInjection,
  ): Promise<void> {
    switch (violation.action.kind) {
      case 'wrong_container':
        await container.issueRepository.updateTaskField(
          issueNumber,
          violation.action.containerType,
          violation.action.wrongValue,
        );
        break;
      case 'false_status':
        // Status is already set in state simulation — false_status means
        // the status says "In Review" but there's no PR. No additional
        // field update needed; the violation is the absence of a PR.
        break;
      case 'label':
        // Labels would be set via GitHub API — for now, tracked in scenario metadata
        break;
    }

    this.logger.debug('Violation injected', {
      type: violation.type,
      issueNumber,
      action: violation.action.kind,
    });
  }

  /**
   * Resolves task ref placeholders in comment templates to actual issue numbers.
   * Supports both #TASK_REF (e.g., #NCO-01) and legacy #T_REF patterns.
   */
  private resolveTaskRefs(
    template: string,
    taskRefToIssue: Map<string, { id: string; number: number }>,
  ): string {
    return template.replace(/#([A-Z]{2,5}-\d{2,3})/g, (_match, ref: string) => {
      const issue = taskRefToIssue.get(ref);
      return issue ? `#${issue.number}` : `#${ref}`;
    });
  }

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
    this.logger.info('Agents seeded', { count: agentCount, locks: scenario.agents.locks?.length ?? 0 });
    return agentCount;
  }

  private async writeContainerMetadata(projectRoot: string, scenario: SandboxScenario): Promise<void> {
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
  }

  private async writeMemorySeed(projectRoot: string, scenario: SandboxScenario): Promise<void> {
    const seedPath = path.join(projectRoot, '.ido4', 'sandbox-memory-seed.md');
    await fs.writeFile(seedPath, scenario.memorySeed);
  }

  private async ensureNoExistingSandbox(projectRoot: string): Promise<void> {
    const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
    let data: string;
    try {
      data = await fs.readFile(configPath, 'utf-8');
    } catch {
      return;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(data);
    } catch {
      this.logger.warn('Removing corrupt .ido4/project-info.json');
      await this.removeLocalConfig(projectRoot);
      return;
    }

    if (config.sandbox) {
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

  private async deleteStaleRef(
    container: { repositoryRepository: { deleteBranch: (refId: string) => Promise<void> } },
    repositoryId: string,
    branchName: string,
  ): Promise<void> {
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
      return false;
    }
  }

  private static readonly SANDBOX_FILES = [
    'project-info.json',
    'methodology-profile.json',
    'git-workflow.json',
    'sandbox-memory-seed.md',
    'audit-log.jsonl',
    'agent-locks.json',
    'container-metadata.json',
  ];

  private async removeLocalConfig(projectRoot: string): Promise<void> {
    const ido4Dir = path.join(projectRoot, '.ido4');
    for (const fileName of SandboxService.SANDBOX_FILES) {
      try {
        await fs.unlink(path.join(ido4Dir, fileName));
      } catch {
        // File doesn't exist — ok
      }
    }
    try {
      await fs.rmdir(ido4Dir);
    } catch {
      // Not empty or doesn't exist — leave it
    }
  }
}
