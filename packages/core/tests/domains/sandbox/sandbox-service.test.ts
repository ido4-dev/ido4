/**
 * SandboxService unit tests (v2) — verifies pipeline-based creation,
 * post-ingestion state simulation, violation injection, and seeding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { SandboxService } from '../../../src/domains/sandbox/sandbox-service.js';
import { HYDRO_GOVERNANCE } from '../../../src/domains/sandbox/scenarios/hydro-governance.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';
import { ValidationError } from '../../../src/shared/errors/index.js';

// Mock external dependencies
vi.mock('node:fs/promises');
vi.mock('../../../src/domains/projects/project-init-service.js');
vi.mock('../../../src/container/service-container.js');
vi.mock('../../../src/profiles/registry.js');
vi.mock('../../../src/domains/ingestion/ingestion-service.js');
vi.mock('../../../src/domains/sandbox/scenario-builder.js');

const mockFs = vi.mocked(fs);

const { ProjectInitService } = await import('../../../src/domains/projects/project-init-service.js');
const { ServiceContainer } = await import('../../../src/container/service-container.js');
const { ProfileRegistry } = await import('../../../src/profiles/registry.js');
const { IngestionService } = await import('../../../src/domains/ingestion/ingestion-service.js');
const { ScenarioBuilder } = await import('../../../src/domains/sandbox/scenario-builder.js');

const mockGraphqlClient = {
  query: vi.fn(),
  mutate: vi.fn(),
};

const mockLogger = new NoopLogger();

const MOCK_HYDRO_PROFILE = {
  id: 'hydro',
  name: 'Hydro',
  semantics: {
    terminalStates: ['DONE'],
    blockedStates: ['BLOCKED'],
    activeStates: ['IN_PROGRESS'],
    readyStates: ['READY_FOR_DEV'],
    reviewStates: ['IN_REVIEW'],
    initialState: 'BACKLOG',
  },
  containers: [
    { id: 'wave', taskField: 'Wave' },
    { id: 'epic', taskField: 'Epic' },
  ],
};

describe('SandboxService', () => {
  let service: SandboxService;
  let mockIssueRepo: {
    createIssue: ReturnType<typeof vi.fn>;
    updateTaskStatus: ReturnType<typeof vi.fn>;
    updateTaskField: ReturnType<typeof vi.fn>;
    addSubIssue: ReturnType<typeof vi.fn>;
    closeIssue: ReturnType<typeof vi.fn>;
    addComment: ReturnType<typeof vi.fn>;
  };
  let mockProjectRepo: {
    addItemToProject: ReturnType<typeof vi.fn>;
    getProjectItems: ReturnType<typeof vi.fn>;
    deleteProject: ReturnType<typeof vi.fn>;
  };
  let mockRepoRepo: {
    getDefaultBranchInfo: ReturnType<typeof vi.fn>;
    createBranch: ReturnType<typeof vi.fn>;
    createCommitOnBranch: ReturnType<typeof vi.fn>;
    createPullRequest: ReturnType<typeof vi.fn>;
    closePullRequest: ReturnType<typeof vi.fn>;
    deleteBranch: ReturnType<typeof vi.fn>;
  };
  let mockTaskService: {
    createTask: ReturnType<typeof vi.fn>;
  };
  let mockEventBus: {
    emit: ReturnType<typeof vi.fn>;
  };
  let mockAgentService: {
    registerAgent: ReturnType<typeof vi.fn>;
    lockTask: ReturnType<typeof vi.fn>;
  };
  let mockIngestionService: {
    ingestSpec: ReturnType<typeof vi.fn>;
  };

  const MOCK_BUILT_SCENARIO = {
    id: 'hydro-governance',
    name: 'Hydro Governance',
    description: 'test',
    profileId: 'hydro',
    narrative: { setup: 'test', tension: 'test', violationContext: {}, expectedFindings: [], resolution: 'test' },
    technicalSpecContent: '',
    containerInstances: [],
    containerAssignments: { 'NCO-01': { wave: 'wave-002-core' }, 'API-02': { wave: 'wave-001-foundation' } },
    taskStates: { 'API-02': 'DONE', 'NCO-01': 'IN_PROGRESS', 'NCO-02': 'IN_REVIEW', 'NCO-03': 'BLOCKED' },
    violations: [{ type: 'FALSE_STATUS', taskRef: 'NCO-02', action: { kind: 'false_status' as const, status: 'IN_REVIEW' }, description: 'test' }],
    auditEvents: [
      { taskRef: 'API-02', transition: 'approve', fromStatus: 'IN_REVIEW', toStatus: 'DONE', daysAgo: 8 },
      { taskRef: 'NCO-01', transition: 'start', fromStatus: 'READY_FOR_DEV', toStatus: 'IN_PROGRESS', daysAgo: 4 },
    ],
    agents: {
      agents: [
        { agentId: 'agent-alpha', name: 'Alpha', role: 'coding' as const, capabilities: ['backend'] },
        { agentId: 'agent-beta', name: 'Beta', role: 'coding' as const, capabilities: ['frontend'] },
      ],
      locks: [{ agentId: 'agent-alpha', taskRef: 'NCO-01' }],
    },
    prSeeds: [{ taskRef: 'NCO-02', branchName: 'sandbox/nco-02', prTitle: 'feat: retry policy' }],
    contextComments: { 'NCO-01': ['Started delivery engine 4 days ago.'] },
    memorySeed: '# Sandbox Governance Memory Seed\n',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(ProfileRegistry.getBuiltin).mockReturnValue(MOCK_HYDRO_PROFILE as never);
    vi.mocked(ScenarioBuilder.build).mockReturnValue(MOCK_BUILT_SCENARIO as never);

    service = new SandboxService(mockGraphqlClient, mockLogger);
    vi.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);

    mockIssueRepo = {
      createIssue: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTaskField: vi.fn(),
      addSubIssue: vi.fn(),
      closeIssue: vi.fn(),
      addComment: vi.fn(),
    };

    mockProjectRepo = {
      addItemToProject: vi.fn(),
      getProjectItems: vi.fn(),
      deleteProject: vi.fn(),
    };

    mockRepoRepo = {
      getDefaultBranchInfo: vi.fn(),
      createBranch: vi.fn(),
      createCommitOnBranch: vi.fn(),
      createPullRequest: vi.fn(),
      closePullRequest: vi.fn(),
      deleteBranch: vi.fn(),
    };

    mockTaskService = {
      createTask: vi.fn(),
    };

    mockEventBus = {
      emit: vi.fn(),
    };

    mockAgentService = {
      registerAgent: vi.fn().mockResolvedValue({ agentId: 'test', registeredAt: new Date().toISOString(), lastHeartbeat: new Date().toISOString() }),
      lockTask: vi.fn().mockResolvedValue({ issueNumber: 0, agentId: 'test', acquiredAt: new Date().toISOString(), expiresAt: new Date().toISOString() }),
    };

    mockIngestionService = {
      ingestSpec: vi.fn(),
    };
  });

  describe('createSandbox', () => {
    it('rejects unknown scenario', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(
        service.createSandbox({
          repository: 'owner/repo',
          projectRoot: '/tmp/test',
          scenarioId: 'nonexistent',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('auto-destroys stale sandbox before creating new one', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ sandbox: true, project: { id: 'PVT_old' } }));

      const destroySpy = vi.spyOn(service, 'destroySandbox').mockResolvedValueOnce({
        success: true,
        projectId: 'PVT_old',
        issuesClosed: 0,
        projectDeleted: true,
        configRemoved: true,
      });

      // Phase 5 OBS-06: preflight runs after ensureNoExistingSandbox (auto-destroy)
      // and before ProjectInitService. Mock the preflight GraphQL query to succeed
      // so the test can verify destroy → init ordering.
      mockGraphqlClient.query.mockResolvedValueOnce({
        repository: { defaultBranchRef: { name: 'main' } },
        viewer: { id: 'U_test', login: 'test-user' },
      });

      vi.mocked(ProjectInitService).mockImplementation(() => ({
        initializeProject: vi.fn().mockRejectedValue(new Error('stopped after destroy check')),
      }) as unknown as InstanceType<typeof ProjectInitService>);

      // The Phase 5 wrapper catches initializeProject's error, attempts rollback,
      // and rethrows wrapped — so the original "stopped after destroy check"
      // string is preserved in the wrapped error message.
      await expect(
        service.createSandbox({ repository: 'owner/repo', projectRoot: '/tmp/test' }),
      ).rejects.toThrow(/stopped after destroy check/);

      expect(destroySpy).toHaveBeenCalledWith('/tmp/test');
    });

    it('rejects when real project exists', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ project: { id: 'PVT_real' } }));

      await expect(
        service.createSandbox({
          repository: 'owner/repo',
          projectRoot: '/tmp/test',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('creates sandbox using ingestion pipeline', async () => {
      // No existing config
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      // Phase 5 OBS-06: preflight runs before ProjectInitService.
      mockGraphqlClient.query.mockResolvedValueOnce({
        repository: { defaultBranchRef: { name: 'main' } },
        viewer: { id: 'U_test', login: 'test-user' },
      });

      // Mock ProjectInitService
      const mockInitResult = {
        success: true,
        project: {
          id: 'PVT_sandbox',
          number: 1,
          title: 'ido4 Sandbox — Hydro Governance',
          url: 'https://github.com/orgs/owner/projects/1',
          repository: 'owner/repo',
        },
        fieldsCreated: ['Wave', 'Epic'],
        configPath: '/tmp/test/.ido4/project-info.json',
      };

      vi.mocked(ProjectInitService).mockImplementation(() => ({
        initializeProject: vi.fn().mockResolvedValue(mockInitResult),
      }) as unknown as InstanceType<typeof ProjectInitService>);

      // Mock ServiceContainer
      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
        taskService: mockTaskService,
        eventBus: mockEventBus,
        agentService: mockAgentService,
        sessionId: 'test-session',
        profile: MOCK_HYDRO_PROFILE,
        logger: mockLogger,
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);

      // Mock IngestionService
      const ingestionResult = {
        success: true,
        parsed: { projectName: 'Notification Platform', groupCount: 6, taskCount: 17, parseErrors: [] },
        created: {
          groupIssues: [
            { ref: 'capability:Notification Core', issueNumber: 1, title: 'Notification Core', url: 'url' },
            { ref: 'capability:Channel Providers', issueNumber: 2, title: 'Channel Providers', url: 'url' },
          ],
          tasks: [
            { ref: 'NCO-01', issueNumber: 101, title: 'Delivery Engine Core', url: 'url', dependsOn: [] },
            { ref: 'NCO-02', issueNumber: 102, title: 'Retry Policy', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'NCO-03', issueNumber: 103, title: 'Status Tracking', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'NCO-04', issueNumber: 104, title: 'Idempotency', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'CHP-01', issueNumber: 105, title: 'Email', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'CHP-02', issueNumber: 106, title: 'SMS', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'CHP-03', issueNumber: 107, title: 'Push', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'CHP-04', issueNumber: 108, title: 'Webhook', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'TMP-01', issueNumber: 109, title: 'Renderer', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'TMP-02', issueNumber: 110, title: 'Preview', url: 'url', dependsOn: ['TMP-01'] },
            { ref: 'ANL-01', issueNumber: 111, title: 'Tracking', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'ANL-02', issueNumber: 112, title: 'Metrics', url: 'url', dependsOn: ['ANL-01'] },
            { ref: 'API-01', issueNumber: 113, title: 'Send', url: 'url', dependsOn: ['NCO-01'] },
            { ref: 'API-02', issueNumber: 114, title: 'Rate Limit', url: 'url', dependsOn: [] },
            { ref: 'API-03', issueNumber: 115, title: 'Render', url: 'url', dependsOn: ['TMP-01'] },
            { ref: 'INT-01', issueNumber: 116, title: 'Webhooks', url: 'url', dependsOn: ['NCO-01', 'CHP-04'] },
            { ref: 'INT-02', issueNumber: 117, title: 'Registry', url: 'url', dependsOn: ['INT-01'] },
          ],
          subIssueRelationships: 17,
          totalIssues: 19,
        },
        failed: [],
        warnings: [],
        suggestions: [],
      };
      vi.mocked(IngestionService).mockImplementation(() => mockIngestionService as unknown as InstanceType<typeof IngestionService>);
      mockIngestionService.ingestSpec.mockResolvedValue(ingestionResult);

      // Mock PR seeding
      mockRepoRepo.getDefaultBranchInfo.mockResolvedValue({ repositoryId: 'repo-1', branchName: 'main', oid: 'abc123' });
      mockRepoRepo.createBranch.mockResolvedValue({ refId: 'ref-1' });
      mockRepoRepo.createCommitOnBranch.mockResolvedValue({ oid: 'commit-1' });
      mockRepoRepo.createPullRequest.mockResolvedValue({ id: 'pr-1', number: 200, url: 'url' });

      // Mock config read for sandbox marker
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ project: { id: 'PVT_sandbox' } }));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await service.createSandbox({
        repository: 'owner/repo',
        projectRoot: '/tmp/test',
      });

      expect(result.success).toBe(true);
      expect(result.scenario).toBe('hydro-governance');

      // Verify ingestion was called
      expect(mockIngestionService.ingestSpec).toHaveBeenCalledOnce();

      // Verify ScenarioBuilder was called
      expect(ScenarioBuilder.build).toHaveBeenCalledOnce();

      // Verify post-ingestion container assignments (from built scenario)
      const assignmentCount = Object.keys(MOCK_BUILT_SCENARIO.containerAssignments).length;
      expect(mockIssueRepo.updateTaskField).toHaveBeenCalled();
      expect(result.created.containerAssignments).toBe(assignmentCount);

      // Verify state transitions (from built scenario)
      const stateCount = Object.keys(MOCK_BUILT_SCENARIO.taskStates).length;
      expect(mockIssueRepo.updateTaskStatus).toHaveBeenCalled();
      expect(result.created.stateTransitions).toBe(stateCount);

      // Verify terminal tasks closed
      const doneTasks = Object.values(MOCK_BUILT_SCENARIO.taskStates).filter((s) => s === 'DONE');
      expect(mockIssueRepo.closeIssue).toHaveBeenCalledTimes(doneTasks.length);
      expect(result.created.closedTasks).toBe(doneTasks.length);

      // Verify audit events (from built scenario)
      expect(mockEventBus.emit).toHaveBeenCalledTimes(MOCK_BUILT_SCENARIO.auditEvents.length);
      expect(result.created.auditEvents).toBe(MOCK_BUILT_SCENARIO.auditEvents.length);

      // Verify agents
      expect(mockAgentService.registerAgent).toHaveBeenCalledTimes(2);
      expect(mockAgentService.lockTask).toHaveBeenCalledTimes(1);

      // Verify PR seeding (from built scenario)
      expect(mockRepoRepo.createPullRequest).toHaveBeenCalledTimes(MOCK_BUILT_SCENARIO.prSeeds.length);

      // Verify context comments (from built scenario)
      const totalComments = Object.values(MOCK_BUILT_SCENARIO.contextComments).reduce((sum, c) => sum + c.length, 0);
      expect(mockIssueRepo.addComment).toHaveBeenCalledTimes(totalComments);

      // Verify memory seed and config were written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/test/.ido4/sandbox-memory-seed.md',
        expect.stringContaining('Sandbox Governance Memory Seed'),
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/test/.ido4/project-info.json',
        expect.stringContaining('"sandbox": true'),
      );
    });
  });

  describe('destroySandbox', () => {
    it('succeeds silently when config does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await service.destroySandbox('/tmp/test');
      expect(result.success).toBe(true);
      expect(result.projectDeleted).toBe(false);
      expect(result.configRemoved).toBe(false);
    });

    it('refuses on non-sandbox projects', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ project: { id: 'PVT_real' } }));

      await expect(service.destroySandbox('/tmp/test')).rejects.toThrow(ValidationError);
    });

    it('destroys sandbox project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        sandbox: true,
        project: { id: 'PVT_sandbox' },
      }));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.rmdir.mockResolvedValue(undefined);

      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'ido4 Sandbox — Hydro Governance' } });

      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);

      mockProjectRepo.getProjectItems.mockResolvedValue([
        { id: '1', content: { number: 1, title: 'T1', body: '', url: '', closed: false }, fieldValues: {} },
        { id: '2', content: { number: 2, title: 'T2', body: '', url: '', closed: true }, fieldValues: {} },
      ]);
      mockIssueRepo.closeIssue.mockResolvedValue(undefined);
      mockProjectRepo.deleteProject.mockResolvedValue(undefined);

      const result = await service.destroySandbox('/tmp/test');

      expect(result.success).toBe(true);
      expect(result.issuesClosed).toBe(1);
      expect(result.projectDeleted).toBe(true);
    });

    it('refuses to delete project when title does not contain Sandbox', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        sandbox: true,
        project: { id: 'PVT_sandbox' },
      }));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.rmdir.mockResolvedValue(undefined);

      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'My Real Project' } });

      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);
      mockProjectRepo.getProjectItems.mockResolvedValue([]);

      const result = await service.destroySandbox('/tmp/test');
      expect(result.projectDeleted).toBe(false);
      expect(mockProjectRepo.deleteProject).not.toHaveBeenCalled();
    });
  });

  describe('resetSandbox', () => {
    it('calls destroy then create', async () => {
      const destroyResult = {
        success: true,
        projectId: 'PVT_old',
        issuesClosed: 5,
        projectDeleted: true,
        configRemoved: true,
      };

      const createResult = {
        success: true,
        project: { id: 'PVT_new', number: 2, title: 'Sandbox', url: 'url', repository: 'owner/repo' },
        scenario: 'hydro-governance',
        created: {
          capabilities: 6,
          tasks: 17,
          subIssueRelationships: 17,
          containerAssignments: 17,
          stateTransitions: 10,
          violations: 2,
          closedTasks: 1,
          pullRequests: 1,
          contextComments: 4,
          auditEvents: 15,
          registeredAgents: 2,
        },
        configPath: '/tmp/test/.ido4/project-info.json',
      };

      vi.spyOn(service, 'destroySandbox').mockResolvedValue(destroyResult);
      vi.spyOn(service, 'createSandbox').mockResolvedValue(createResult);

      const result = await service.resetSandbox({
        repository: 'owner/repo',
        projectRoot: '/tmp/test',
      });

      expect(result.destroyed).toEqual(destroyResult);
      expect(result.created).toEqual(createResult);
    });
  });

  // ─── Phase 5 WS4 — Sandbox UX Hardening ───

  describe('preflightCreate (Phase 5 OBS-06/03/04)', () => {
    // Phase 5 WS4: pre-flight all external dependencies before any mutation.
    // Prior to this fix, sandbox creation against an empty repo (no default
    // branch) would fail at PR-seeding time — by which point Project V2 +
    // N issues + local config were already created. Pre-flight catches the
    // empty-repo case before any mutation, so user can fix and retry cleanly.

    it('rejects empty repo (no default branch) with clean remediation', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      // Preflight query: viewer authenticated, repo accessible, but no default branch
      mockGraphqlClient.query.mockResolvedValueOnce({
        repository: { defaultBranchRef: null },
        viewer: { id: 'U_test', login: 'test-user' },
      });

      await expect(
        service.createSandbox({ repository: 'owner/empty-repo', projectRoot: '/tmp/test' }),
      ).rejects.toThrow(/no default branch/);

      // Critical regression assertion: NO mutations happened.
      expect(ProjectInitService).not.toHaveBeenCalled();
      expect(IngestionService).not.toHaveBeenCalled();
    });

    it('rejects when repository not accessible', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockGraphqlClient.query.mockResolvedValueOnce({
        repository: null,
        viewer: { id: 'U_test', login: 'test-user' },
      });

      await expect(
        service.createSandbox({ repository: 'owner/missing-repo', projectRoot: '/tmp/test' }),
      ).rejects.toThrow(/not accessible/);

      expect(ProjectInitService).not.toHaveBeenCalled();
    });

    it('rejects when GitHub auth not active', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockGraphqlClient.query.mockResolvedValueOnce({
        repository: null,
        viewer: null,
      });

      await expect(
        service.createSandbox({ repository: 'owner/repo', projectRoot: '/tmp/test' }),
      ).rejects.toThrow(/auth not active/);

      expect(ProjectInitService).not.toHaveBeenCalled();
    });

    it('rejects malformed repository format', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(
        service.createSandbox({ repository: 'invalid-format', projectRoot: '/tmp/test' }),
      ).rejects.toThrow(/Invalid repository format/);

      // No GraphQL query attempted — format check is cheap-and-first.
      expect(mockGraphqlClient.query).not.toHaveBeenCalled();
    });
  });

  describe('listOrphanSandboxes (Phase 5 OBS-09)', () => {
    // Phase 5 WS4: GitHub Projects V2 don't cascade-delete with the repo.
    // listOrphanSandboxes scans the viewer's projects, filters for "ido4 Sandbox"
    // titles, and identifies orphans whose linked repo no longer exists.

    it('identifies orphans (linked repo deleted) and non-orphans (repo still exists)', async () => {
      // Page 1: list of ido4 Sandbox projects + a non-sandbox project
      mockGraphqlClient.query.mockResolvedValueOnce({
        viewer: {
          projectsV2: {
            nodes: [
              { id: 'PVT_alive', number: 1, title: 'ido4 Sandbox — Hydro Governance', url: 'https://gh/...', repositories: { nodes: [{ nameWithOwner: 'me/alive-repo' }] } },
              { id: 'PVT_orphan', number: 2, title: 'ido4 Sandbox — Scrum Sprint', url: 'https://gh/...', repositories: { nodes: [{ nameWithOwner: 'me/deleted-repo' }] } },
              { id: 'PVT_unrelated', number: 3, title: 'Real Project', url: 'https://gh/...', repositories: { nodes: [{ nameWithOwner: 'me/real-repo' }] } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
      // Repo existence checks (parallel — order-insensitive)
      mockGraphqlClient.query.mockImplementation(async (_query, vars) => {
        const v = vars as { owner?: string; name?: string };
        if (v.owner === 'me' && v.name === 'alive-repo') return { repository: { id: 'R_alive' } };
        if (v.owner === 'me' && v.name === 'deleted-repo') return { repository: null };
        // Fallback for any other call
        return { repository: null };
      });

      const result = await service.listOrphanSandboxes();

      // Two ido4 Sandbox candidates (PVT_alive, PVT_orphan); PVT_unrelated filtered out
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.projectId).sort()).toEqual(['PVT_alive', 'PVT_orphan']);

      // One orphan (the deleted repo)
      expect(result.orphans).toHaveLength(1);
      expect(result.orphans[0]!.projectId).toBe('PVT_orphan');
      expect(result.orphans[0]!.repositoryExists).toBe(false);
    });

    it('returns empty result when no ido4 Sandbox projects exist', async () => {
      mockGraphqlClient.query.mockResolvedValueOnce({
        viewer: {
          projectsV2: {
            nodes: [
              { id: 'PVT_real', number: 1, title: 'Real Project', url: 'https://gh/...', repositories: { nodes: [] } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });

      const result = await service.listOrphanSandboxes();

      expect(result.candidates).toEqual([]);
      expect(result.orphans).toEqual([]);
    });
  });

  describe('deleteOrphanSandbox (Phase 5 OBS-09)', () => {
    it('deletes orphan when title contains "Sandbox"', async () => {
      // verifySandboxProject query
      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'ido4 Sandbox — Hydro Governance' } });
      // deleteProjectByIdViaGraphQL mutation
      mockGraphqlClient.query.mockResolvedValueOnce({ deleteProjectV2: { projectV2: { id: 'PVT_orphan' } } });

      const result = await service.deleteOrphanSandbox('PVT_orphan');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });

    it('refuses to delete project whose title does not contain "Sandbox" (safety guard)', async () => {
      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'My Real Project' } });

      const result = await service.deleteOrphanSandbox('PVT_misuse');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(false);
      expect(result.reason).toContain('safety guard');
    });
  });
});
