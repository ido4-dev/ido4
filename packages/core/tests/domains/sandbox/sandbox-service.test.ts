/**
 * SandboxService unit tests — verifies create, destroy, and reset flows
 * using mocked dependencies. Updated for generic scenario types.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SandboxService } from '../../../src/domains/sandbox/sandbox-service.js';
import { HYDRO_GOVERNANCE } from '../../../src/domains/sandbox/scenarios/hydro-governance.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';
import { ValidationError } from '../../../src/shared/errors/index.js';

// Mock external dependencies
vi.mock('node:fs/promises');
vi.mock('../../../src/domains/projects/project-init-service.js');
vi.mock('../../../src/container/service-container.js');
vi.mock('../../../src/profiles/registry.js');

const mockFs = vi.mocked(fs);

// Import mocked modules
const { ProjectInitService } = await import('../../../src/domains/projects/project-init-service.js');
const { ServiceContainer } = await import('../../../src/container/service-container.js');
const { ProfileRegistry } = await import('../../../src/profiles/registry.js');

const mockGraphqlClient = {
  query: vi.fn(),
  mutate: vi.fn(),
};

const mockLogger = new NoopLogger();

// Mock profile for Hydro
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ProfileRegistry
    vi.mocked(ProfileRegistry.getBuiltin).mockReturnValue(MOCK_HYDRO_PROFILE as never);

    service = new SandboxService(mockGraphqlClient, mockLogger);
    // Override sleep to be instant
    vi.spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);

    mockIssueRepo = {
      createIssue: vi.fn(),
      updateTaskStatus: vi.fn(),
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
      // First read: stale sandbox config exists → triggers auto-destroy
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ sandbox: true, project: { id: 'PVT_old' } }));

      // Mock destroySandbox to succeed without actual GitHub calls
      const destroySpy = vi.spyOn(service, 'destroySandbox').mockResolvedValueOnce({
        success: true,
        projectId: 'PVT_old',
        issuesClosed: 0,
        projectDeleted: true,
        configRemoved: true,
      });

      // After auto-destroy, ensureNoExistingSandbox returns (no more config)
      // Then createSandbox proceeds and needs the full init flow — will fail
      // on ProjectInitService, but we only care that destroySandbox was called.
      vi.mocked(ProjectInitService).mockImplementation(() => ({
        initializeProject: vi.fn().mockRejectedValue(new Error('stopped after destroy check')),
      }) as unknown as InstanceType<typeof ProjectInitService>);

      await expect(
        service.createSandbox({ repository: 'owner/repo', projectRoot: '/tmp/test' }),
      ).rejects.toThrow('stopped after destroy check');

      // The key assertion: destroy was called automatically
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

    it('creates sandbox with full flow when no existing project', async () => {
      // No existing config
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));

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

      const mockInitService = {
        initializeProject: vi.fn().mockResolvedValue(mockInitResult),
      };
      vi.mocked(ProjectInitService).mockImplementation(() => mockInitService as unknown as InstanceType<typeof ProjectInitService>);

      // Mock ServiceContainer
      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
        taskService: mockTaskService,
        eventBus: mockEventBus,
        agentService: mockAgentService,
        sessionId: 'test-session',
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);

      // Mock parent issue creation
      let parentCallCount = 0;
      mockIssueRepo.createIssue.mockImplementation(async () => {
        parentCallCount++;
        return { id: `parent-id-${parentCallCount}`, number: parentCallCount, url: `https://github.com/owner/repo/issues/${parentCallCount}` };
      });
      mockProjectRepo.addItemToProject.mockResolvedValue('item-id');

      // Mock task creation
      let taskCallCount = 0;
      mockTaskService.createTask.mockImplementation(async () => {
        taskCallCount++;
        const taskNumber = 100 + taskCallCount;
        return {
          success: true,
          data: {
            issueNumber: taskNumber,
            issueId: `task-id-${taskCallCount}`,
            itemId: `item-${taskCallCount}`,
            url: `https://github.com/owner/repo/issues/${taskNumber}`,
            title: `Task ${taskCallCount}`,
            status: 'BACKLOG',
            fieldsSet: ['status'],
          },
          suggestions: [],
          warnings: [],
        };
      });

      // Mock PR seeding
      mockRepoRepo.getDefaultBranchInfo.mockResolvedValue({
        repositoryId: 'repo-id-1',
        branchName: 'main',
        oid: 'abc123',
      });
      mockRepoRepo.createBranch.mockResolvedValue({ refId: 'ref-id-1' });
      mockRepoRepo.createCommitOnBranch.mockResolvedValue({ oid: 'commit-oid-1' });
      mockRepoRepo.createPullRequest.mockResolvedValue({ id: 'pr-id-1', number: 200, url: 'https://github.com/owner/repo/pull/200' });

      // Mock config read for sandbox marker append
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ project: { id: 'PVT_sandbox' } }));
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await service.createSandbox({
        repository: 'owner/repo',
        projectRoot: '/tmp/test',
      });

      expect(result.success).toBe(true);
      expect(result.scenario).toBe('hydro-governance');
      expect(result.created.parentIssues).toBe(HYDRO_GOVERNANCE.parentIssues.length);
      expect(result.created.tasks).toBe(HYDRO_GOVERNANCE.tasks.length);
      // sub-issue relationships = tasks with parentRef
      const tasksWithParent = HYDRO_GOVERNANCE.tasks.filter((t) => t.parentRef);
      expect(result.created.subIssueRelationships).toBe(tasksWithParent.length);

      // Verify init was called with profile
      expect(mockInitService.initializeProject).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'create',
          repository: 'owner/repo',
          projectRoot: '/tmp/test',
        }),
      );

      // Verify parent issues were created
      expect(mockIssueRepo.createIssue).toHaveBeenCalledTimes(HYDRO_GOVERNANCE.parentIssues.length);

      // Verify tasks were created
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(HYDRO_GOVERNANCE.tasks.length);

      // Verify tasks use containers (not wave/epic)
      const firstCreateCall = mockTaskService.createTask.mock.calls[0]![0];
      expect(firstCreateCall.containers).toBeDefined();

      // Verify sub-issue relationships
      expect(mockIssueRepo.addSubIssue).toHaveBeenCalledTimes(tasksWithParent.length);

      // Verify terminal tasks were closed
      const doneTasks = HYDRO_GOVERNANCE.tasks.filter((t) => t.status === 'DONE');
      expect(mockIssueRepo.closeIssue).toHaveBeenCalledTimes(doneTasks.length);

      // Verify PR seeding (T12 has seedPR)
      const tasksWithPR = HYDRO_GOVERNANCE.tasks.filter((t) => t.seedPR);
      expect(mockRepoRepo.getDefaultBranchInfo).toHaveBeenCalledTimes(1);
      expect(mockRepoRepo.createBranch).toHaveBeenCalledTimes(tasksWithPR.length);
      expect(mockRepoRepo.createPullRequest).toHaveBeenCalledTimes(tasksWithPR.length);
      expect(result.created.pullRequests).toBe(tasksWithPR.length);

      // Verify context comments
      const tasksWithComments = HYDRO_GOVERNANCE.tasks.filter((t) => t.contextComments && t.contextComments.length > 0);
      const totalComments = tasksWithComments.reduce((sum, t) => sum + t.contextComments!.length, 0);
      expect(mockIssueRepo.addComment).toHaveBeenCalledTimes(totalComments);
      expect(result.created.contextComments).toBe(totalComments);

      // Verify audit events were emitted from scenario data
      const emitCalls = mockEventBus.emit.mock.calls;
      expect(emitCalls.length).toBe(HYDRO_GOVERNANCE.auditEvents.length);
      expect(result.created.auditEvents).toBe(HYDRO_GOVERNANCE.auditEvents.length);

      // Verify agents were registered and T7 locked
      expect(mockAgentService.registerAgent).toHaveBeenCalledTimes(2);
      expect(mockAgentService.registerAgent).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-alpha', role: 'coding' }),
      );
      expect(mockAgentService.registerAgent).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-beta', role: 'coding' }),
      );
      expect(mockAgentService.lockTask).toHaveBeenCalledTimes(1);
      expect(mockAgentService.lockTask).toHaveBeenCalledWith('agent-alpha', expect.any(Number));
      expect(result.created.registeredAgents).toBe(2);

      // Verify memory seed file was written
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/test/.ido4/sandbox-memory-seed.md',
        expect.stringContaining('Sandbox Governance Memory Seed'),
      );

      // Verify sandbox marker was written with sandboxArtifacts
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/test/.ido4/project-info.json',
        expect.stringContaining('"sandbox": true'),
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/test/.ido4/project-info.json',
        expect.stringContaining('"sandboxArtifacts"'),
      );
    });
  });

  describe('destroySandbox', () => {
    it('succeeds silently when config does not exist (nothing to destroy)', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await service.destroySandbox('/tmp/test');
      expect(result.success).toBe(true);
      expect(result.projectDeleted).toBe(false);
      expect(result.configRemoved).toBe(false); // Can't confirm it was a sandbox
    });

    it('refuses on non-sandbox projects', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        project: { id: 'PVT_real' },
      }));

      await expect(service.destroySandbox('/tmp/test')).rejects.toThrow(ValidationError);
    });

    it('destroys sandbox project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        sandbox: true,
        project: { id: 'PVT_sandbox' },
      }));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.rmdir.mockResolvedValue(undefined);

      // Verify sandbox project title check
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
      expect(result.projectId).toBe('PVT_sandbox');
      expect(result.issuesClosed).toBe(1); // Only 1 open issue
      expect(result.projectDeleted).toBe(true);
      expect(result.configRemoved).toBe(true);

      expect(mockIssueRepo.closeIssue).toHaveBeenCalledWith(1);
      expect(mockIssueRepo.closeIssue).not.toHaveBeenCalledWith(2);
      expect(mockProjectRepo.deleteProject).toHaveBeenCalled();
    });

    it('cleans up seeded PRs and branches when sandboxArtifacts exist', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        sandbox: true,
        project: { id: 'PVT_sandbox' },
        sandboxArtifacts: {
          seededPRs: [
            { prId: 'pr-id-1', refId: 'ref-id-1', branchName: 'sandbox/session-management', taskRef: 'T12' },
          ],
        },
      }));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.rmdir.mockResolvedValue(undefined);

      // Verify sandbox project title check
      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'ido4 Sandbox — Test' } });

      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);

      mockProjectRepo.getProjectItems.mockResolvedValue([]);
      mockProjectRepo.deleteProject.mockResolvedValue(undefined);
      mockRepoRepo.closePullRequest.mockResolvedValue(undefined);
      mockRepoRepo.deleteBranch.mockResolvedValue(undefined);

      await service.destroySandbox('/tmp/test');

      // Verify PR and branch cleanup
      expect(mockRepoRepo.closePullRequest).toHaveBeenCalledWith('pr-id-1');
      expect(mockRepoRepo.deleteBranch).toHaveBeenCalledWith('ref-id-1');
    });

    it('refuses to delete project when title does not contain Sandbox', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        sandbox: true,
        project: { id: 'PVT_sandbox' },
      }));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFs.rmdir.mockResolvedValue(undefined);

      // Project title doesn't contain "Sandbox" — guardrail should prevent deletion
      mockGraphqlClient.query.mockResolvedValueOnce({ node: { title: 'My Real Project' } });

      const mockContainer = {
        issueRepository: mockIssueRepo,
        projectRepository: mockProjectRepo,
        repositoryRepository: mockRepoRepo,
      };
      vi.mocked(ServiceContainer.create).mockResolvedValue(mockContainer as unknown as InstanceType<typeof ServiceContainer>);

      mockProjectRepo.getProjectItems.mockResolvedValue([]);
      mockProjectRepo.deleteProject.mockResolvedValue(undefined);

      const result = await service.destroySandbox('/tmp/test');

      expect(result.success).toBe(true);
      expect(result.projectDeleted).toBe(false); // Guardrail prevented deletion
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
        project: { id: 'PVT_new', number: 2, title: 'Sandbox', url: 'https://example.com', repository: 'owner/repo' },
        scenario: 'hydro-governance',
        created: {
          parentIssues: 5,
          containerInstances: 4,
          tasks: 20,
          subIssueRelationships: 20,
          closedTasks: 8,
          pullRequests: 1,
          contextComments: 5,
          auditEvents: 28,
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
      expect(service.destroySandbox).toHaveBeenCalledWith('/tmp/test');
      expect(service.createSandbox).toHaveBeenCalledWith({
        repository: 'owner/repo',
        projectRoot: '/tmp/test',
      });
    });
  });
});
