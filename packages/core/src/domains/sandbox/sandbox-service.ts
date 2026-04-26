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
  OrphanSandboxProject,
  ListOrphanSandboxesResult,
  DeleteOrphanSandboxResult,
} from './types.js';

/**
 * In-memory record of mutations performed during createSandbox, walked in
 * reverse during best-effort rollback when any phase throws.
 *
 * Phase 5 OBS-07 fix: external state (Project V2, GitHub issues, branches,
 * PRs) and local state (.ido4/ files) get cleaned up when creation fails
 * mid-flight. The log accumulates as each phase succeeds; on failure, the
 * catch block walks it in reverse and best-efforts each undo.
 *
 * Not a saga or two-phase commit — those aren't viable across the GitHub
 * Projects V2 surface. This is "if we created it, we try to clean it up."
 */
interface CreateMutationLog {
  /** Project V2 ID, set after createProject succeeds. */
  projectId?: string;
  /** True after writeConfigFiles writes .ido4/ files. */
  wroteLocalConfig: boolean;
  /** Issue numbers created by ingestion + sub-issue creation. */
  createdIssueNumbers: number[];
  /** Branch refs created during PR seeding. */
  createdBranchRefs: Array<{ refId: string; branchName: string }>;
  /** PR IDs created during PR seeding. */
  createdPRs: Array<{ prId: string }>;
}

/**
 * Delay between post-ingestion field updates. GitHub's ProjectV2 API can reset
 * field values when mutations arrive too quickly. 500ms is empirically safe
 * (same pattern as SUB_ISSUE_DELAY_MS in IngestionService, which uses 1000ms).
 */
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

    // Phase 5 OBS-06/03/04: pre-flight all external dependencies before
    // any mutation. If preflight fails, no Project V2 created, no issues
    // created, no .ido4/ files written. Cleanly recoverable — user fixes
    // the underlying condition (e.g., empty repo) and retries.
    await this.preflightCreate(options.repository);

    const profile = ProfileRegistry.getBuiltin(config.profileId);

    this.logger.info('Creating sandbox', {
      scenario: scenarioId,
      repository: options.repository,
      profile: profile.id,
    });

    // Phase 5 OBS-07: in-memory mutation log; populated as each phase
    // succeeds. On any failure post-preflight, the catch block walks it
    // in reverse and best-efforts cleanup. Local-only sandbox state is
    // already covered by the existing removeLocalConfig pattern.
    const mutations: CreateMutationLog = {
      wroteLocalConfig: false,
      createdIssueNumbers: [],
      createdBranchRefs: [],
      createdPRs: [],
    };

    try {
      return await this.createSandboxWithRollback(options, scenarioId, config, profile, mutations);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn('Sandbox creation failed — attempting best-effort rollback', {
        error: errMessage,
        mutationSummary: {
          projectCreated: !!mutations.projectId,
          localConfigWritten: mutations.wroteLocalConfig,
          issuesCreated: mutations.createdIssueNumbers.length,
          branchesCreated: mutations.createdBranchRefs.length,
          prsCreated: mutations.createdPRs.length,
        },
      });

      const rollback = await this.rollbackCreate(mutations, options.projectRoot);

      throw new ValidationError({
        message: `Sandbox creation failed: ${errMessage}. ${rollback.summary}`,
        context: {
          originalError: errMessage,
          rollback: rollback.actions,
        },
        remediation: rollback.userAction
          ?? `Fix the underlying condition (see error above) and retry. The directory has been cleaned up and is safe to retry.`,
      });
    }
  }

  /**
   * Inner createSandbox body that mutates `mutations` as each phase succeeds.
   * Splitting this from the public method keeps the try/catch + rollback
   * boilerplate visible in createSandbox without bloating it.
   */
  private async createSandboxWithRollback(
    options: SandboxCreateOptions,
    scenarioId: string,
    config: ScenarioConfig,
    profile: ReturnType<typeof ProfileRegistry.getBuiltin>,
    mutations: CreateMutationLog,
  ): Promise<SandboxCreateResult> {
    // ── Phase 1: Project Setup ──

    const initService = new ProjectInitService(this.graphqlClient, this.logger, profile);
    const initResult = await initService.initializeProject({
      mode: 'create',
      repository: options.repository,
      projectName: `ido4 Sandbox — ${config.name}`,
      projectRoot: options.projectRoot,
    });

    // Track mutations as Phase 1 succeeds. ProjectInitService writes the
    // local config files internally; if it threw partway, we may still
    // have an orphan project — we'll detect that during rollback by
    // reading project-info.json (if it was written) or by leaving a
    // user-action note.
    mutations.projectId = initResult.project.id;
    mutations.wroteLocalConfig = true;

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

    // Track every issue created by ingestion (group/capability + tasks).
    // Even if ingestion partially failed, the issues that DID get created
    // are in the result and will be rolled back if a later phase throws.
    for (const t of ingestionResult.created.tasks) {
      mutations.createdIssueNumbers.push(t.issueNumber);
    }
    for (const g of ingestionResult.created.groupIssues) {
      mutations.createdIssueNumbers.push(g.issueNumber);
    }

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
          // Track for rollback (Phase 5 OBS-07)
          mutations.createdBranchRefs.push({ refId, branchName: prSeed.branchName });
          mutations.createdPRs.push({ prId: pr.id });
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
        // Label support requires GitHub REST API (not in current GraphQL interface).
        // Violation is tracked in scenario metadata; label is not applied to the issue.
        this.logger.debug('Label violation recorded in metadata (no GitHub label API)', {
          issueNumber, labels: violation.action.labels,
        });
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
    return template.replace(/#([A-Z]{2,5}-\d{2,3}[A-Z]?)/g, (_match, ref: string) => {
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
        executed: true,
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

  /**
   * Phase 5 OBS-06/03/04 fix: validate every external dependency BEFORE
   * createSandbox mutates anything. The dominant Phase 4 partial-smoke
   * failure mode (orphan issues + orphan project on a partially-failed
   * sandbox creation) traced to skipping default-branch validation —
   * the engine threw mid-flight at PR seeding, but by then issues + the
   * Project V2 + the local config were already written.
   *
   * Throws ValidationError with specific remediation if any check fails.
   * Zero mutations happen until this method returns successfully.
   */
  private async preflightCreate(repository: string): Promise<void> {
    // Validate format first — cheap; no network call.
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
      throw new ValidationError({
        message: `Invalid repository format: '${repository}'. Expected 'owner/repo'.`,
        context: { field: 'repository', value: repository },
        remediation: 'Use the format owner/repo (e.g., my-org/my-repo).',
      });
    }

    const [owner, repo] = repository.split('/') as [string, string];

    // Single combined query: repo accessibility + default branch + viewer
    // identity (proxies for project-v2 mutation permission — viewer auth
    // confirms the gh token has user-scope access; if a project v2 mutation
    // is later forbidden, that's a different downstream auth issue, but the
    // common "auth missing entirely" case fails here).
    let result: {
      repository: { defaultBranchRef: { name: string } | null } | null;
      viewer: { id: string; login: string } | null;
    };
    try {
      result = await this.graphqlClient.query(
        `query Preflight($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            defaultBranchRef { name }
          }
          viewer { id login }
        }`,
        { owner, repo },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new ValidationError({
        message: `GitHub preflight check failed: ${errMsg}`,
        context: { repository },
        remediation: 'Run `gh auth status` to verify auth. If auth is good, the repository may not exist or may not be accessible — check the spelling.',
      });
    }

    if (!result.viewer?.id) {
      throw new ValidationError({
        message: 'GitHub auth not active — cannot create sandbox.',
        context: {},
        remediation: 'Run `gh auth login` to authenticate with the GitHub CLI, then retry.',
      });
    }

    if (!result.repository) {
      throw new ValidationError({
        message: `Repository '${repository}' not accessible.`,
        context: { repository, viewer: result.viewer.login },
        remediation: `Verify the repository exists and is reachable from your auth (viewer: ${result.viewer.login}). For private repos, ensure your token has 'repo' scope.`,
      });
    }

    if (!result.repository.defaultBranchRef) {
      throw new ValidationError({
        message: `Repository '${repository}' has no default branch — sandbox creation requires an initialized repo.`,
        context: { repository },
        remediation: 'Push at least one commit to establish a default branch (e.g., `git init && git commit --allow-empty -m "init" && git push -u origin main`), then retry.',
      });
    }

    this.logger.debug('Preflight passed', {
      repository,
      defaultBranch: result.repository.defaultBranchRef.name,
      viewer: result.viewer.login,
    });
  }

  /**
   * Phase 5 OBS-07 fix: walks the mutation log in reverse and best-efforts
   * each undo. Failures during rollback are logged but don't abort the
   * walk — we want to clean up as much as possible even when individual
   * undos fail (e.g., issue already closed, branch already deleted).
   *
   * Returns a structured summary the catch block uses to compose the
   * user-facing error.
   */
  private async rollbackCreate(
    mutations: CreateMutationLog,
    projectRoot: string,
  ): Promise<{ summary: string; actions: Record<string, unknown>; userAction?: string }> {
    let prsClosedRollback = 0;
    let branchesDeletedRollback = 0;
    let issuesClosedRollback = 0;
    let projectDeletedRollback = false;
    let configRemovedRollback = false;
    const cleanupErrors: string[] = [];

    // Bootstrap a service container for issue/PR/branch/project ops. If
    // local config is missing, this fails — that's a sign Phase 1 failed
    // before writeConfigFiles, so there's nothing on the GH side from us
    // either (initService.createProject hadn't been called yet OR ran but
    // failed before writing local config — see chained-cleanup note below).
    let container: { issueRepository: { closeIssue: (n: number) => Promise<void> }; projectRepository: { deleteProject: () => Promise<void> }; repositoryRepository: { closePullRequest: (id: string) => Promise<void>; deleteBranch: (refId: string) => Promise<void> } } | null = null;
    if (mutations.wroteLocalConfig) {
      try {
        container = await ServiceContainer.create({ projectRoot, logger: this.logger });
      } catch (err) {
        cleanupErrors.push(`could not bootstrap container for cleanup: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Walk reverse: PRs → branches → issues → project → local config.

    if (container) {
      for (const pr of mutations.createdPRs) {
        try {
          await container.repositoryRepository.closePullRequest(pr.prId);
          prsClosedRollback++;
        } catch (err) {
          cleanupErrors.push(`PR ${pr.prId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const branch of mutations.createdBranchRefs) {
        try {
          await container.repositoryRepository.deleteBranch(branch.refId);
          branchesDeletedRollback++;
        } catch (err) {
          cleanupErrors.push(`branch ${branch.branchName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const issueNumber of mutations.createdIssueNumbers) {
        try {
          await container.issueRepository.closeIssue(issueNumber);
          issuesClosedRollback++;
        } catch (err) {
          cleanupErrors.push(`issue #${issueNumber}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (mutations.projectId) {
        try {
          // Reuse the existing safety guard — project title must contain
          // "Sandbox" before we delete. Defense against accidentally
          // deleting a non-sandbox project that somehow ended up in the
          // mutation log.
          const isSandbox = await this.verifySandboxProject(mutations.projectId);
          if (isSandbox) {
            await container.projectRepository.deleteProject();
            projectDeletedRollback = true;
          } else {
            cleanupErrors.push(`project ${mutations.projectId}: title doesn't contain "Sandbox" — refused to delete (safety guard)`);
          }
        } catch (err) {
          cleanupErrors.push(`project ${mutations.projectId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else if (mutations.projectId) {
      // Container couldn't bootstrap but a project was created — fall back
      // to direct GraphQL deletion (uses the standalone graphqlClient that
      // SandboxService holds, doesn't depend on local config).
      try {
        const isSandbox = await this.verifySandboxProject(mutations.projectId);
        if (isSandbox) {
          await this.deleteProjectByIdViaGraphQL(mutations.projectId);
          projectDeletedRollback = true;
        } else {
          cleanupErrors.push(`project ${mutations.projectId}: title doesn't contain "Sandbox" — refused to delete (safety guard)`);
        }
      } catch (err) {
        cleanupErrors.push(`project ${mutations.projectId} (direct GraphQL): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (mutations.wroteLocalConfig) {
      try {
        await this.removeLocalConfig(projectRoot);
        configRemovedRollback = true;
      } catch (err) {
        cleanupErrors.push(`local config removal: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const summaryParts: string[] = [];
    if (issuesClosedRollback > 0) summaryParts.push(`${issuesClosedRollback} issue(s) closed`);
    if (branchesDeletedRollback > 0) summaryParts.push(`${branchesDeletedRollback} branch(es) deleted`);
    if (prsClosedRollback > 0) summaryParts.push(`${prsClosedRollback} PR(s) closed`);
    if (projectDeletedRollback) summaryParts.push('project deleted');
    if (configRemovedRollback) summaryParts.push('local config removed');

    const summary = summaryParts.length > 0
      ? `Rolled back: ${summaryParts.join(', ')}.`
      : 'Nothing to roll back (failure occurred before any mutation).';

    let userAction: string | undefined;
    if (mutations.projectId && !projectDeletedRollback) {
      userAction = `Manual cleanup may be needed: an ido4 Sandbox Project V2 was created but could not be deleted. Run \`/ido4dev:sandbox\` to surface orphan projects, or \`gh project list --owner $(gh api user -q .login)\` and \`gh project delete <number>\` manually.`;
    }

    return {
      summary,
      actions: {
        prsClosedRollback,
        branchesDeletedRollback,
        issuesClosedRollback,
        projectDeletedRollback,
        configRemovedRollback,
        cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
      },
      userAction,
    };
  }

  /**
   * Direct GraphQL project deletion that doesn't depend on a ServiceContainer.
   * Used by rollback when the container couldn't bootstrap, and by orphan
   * cleanup which has no local config at all.
   */
  private async deleteProjectByIdViaGraphQL(projectId: string): Promise<void> {
    await this.graphqlClient.query(
      `mutation DeleteProject($projectId: ID!) {
        deleteProjectV2(input: { projectId: $projectId }) {
          projectV2 { id }
        }
      }`,
      { projectId },
    );
  }

  /**
   * Phase 5 OBS-09: list ido4 Sandbox-titled Project V2 projects on the
   * viewer's account, identifying orphans whose linked repository no
   * longer exists.
   *
   * Read-only — no mutations. Caller (skill) presents the list to the
   * user, who confirms before any deletion via deleteOrphanSandbox.
   *
   * Scoped to the viewer's projects (not org-owned). Org-owned orphan
   * cleanup is v1.1 work — most ido4 sandbox use is on user-owned repos.
   */
  async listOrphanSandboxes(): Promise<ListOrphanSandboxesResult> {
    const candidates: OrphanSandboxProject[] = [];
    let cursor: string | null = null;

    // Paginate through user's projects
    do {
      const result: {
        viewer: {
          projectsV2: {
            nodes: Array<{
              id: string;
              number: number;
              title: string;
              url: string;
              repositories: { nodes: Array<{ nameWithOwner: string }> };
            }>;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      } = await this.graphqlClient.query(
        `query ListSandboxProjects($cursor: String) {
          viewer {
            projectsV2(first: 100, after: $cursor) {
              nodes {
                id
                number
                title
                url
                repositories(first: 1) {
                  nodes { nameWithOwner }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        { cursor },
      );

      for (const node of result.viewer.projectsV2.nodes) {
        // Title-prefix filter — sandbox creation always titles projects
        // "ido4 Sandbox — <Scenario Name>" (see createSandbox line ~94).
        if (!node.title.startsWith('ido4 Sandbox')) continue;

        const linkedRepoNameWithOwner = node.repositories.nodes[0]?.nameWithOwner;
        let linkedRepository: OrphanSandboxProject['linkedRepository'] = null;
        if (linkedRepoNameWithOwner) {
          const [owner, name] = linkedRepoNameWithOwner.split('/') as [string, string];
          linkedRepository = { owner, name, nameWithOwner: linkedRepoNameWithOwner };
        }

        candidates.push({
          projectId: node.id,
          projectNumber: node.number,
          title: node.title,
          url: node.url,
          linkedRepository,
          repositoryExists: false, // will populate next
        });
      }

      cursor = result.viewer.projectsV2.pageInfo.hasNextPage
        ? result.viewer.projectsV2.pageInfo.endCursor
        : null;
    } while (cursor);

    // Now check each linked repo for existence (parallel fan-out).
    await Promise.all(candidates.map(async (c) => {
      if (!c.linkedRepository) {
        c.repositoryExists = false;
        return;
      }
      try {
        const result: { repository: { id: string } | null } = await this.graphqlClient.query(
          `query RepoExists($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) { id }
          }`,
          { owner: c.linkedRepository.owner, name: c.linkedRepository.name },
        );
        c.repositoryExists = !!result.repository;
      } catch {
        // Treat query failure as "unknown" → don't claim it's orphan
        c.repositoryExists = true;
      }
    }));

    const orphans = candidates.filter((c) => !c.repositoryExists);

    return { candidates, orphans };
  }

  /**
   * Phase 5 OBS-09: delete one orphan sandbox project. Gated by
   * verifySandboxProject (project title must contain "Sandbox") to defend
   * against accidentally deleting a non-sandbox project.
   *
   * Caller is expected to confirm with the user before invoking this —
   * deletion is irreversible at the GitHub Projects V2 layer.
   */
  async deleteOrphanSandbox(projectId: string): Promise<DeleteOrphanSandboxResult> {
    const isSandbox = await this.verifySandboxProject(projectId);
    if (!isSandbox) {
      return {
        success: true,
        projectId,
        deleted: false,
        reason: 'Project title does not contain "Sandbox" — refused to delete (safety guard).',
      };
    }

    try {
      await this.deleteProjectByIdViaGraphQL(projectId);
      this.logger.info('Orphan sandbox project deleted', { projectId });
      return { success: true, projectId, deleted: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new ValidationError({
        message: `Failed to delete orphan sandbox project ${projectId}: ${errMsg}`,
        context: { projectId, error: errMsg },
        remediation: 'The project may have already been deleted, or your GitHub token may lack project deletion scope. Run `gh auth status` to verify and `gh project delete <number>` to delete manually if needed.',
      });
    }
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
