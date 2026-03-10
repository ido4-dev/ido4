import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerService } from '../../../src/domains/containers/container-service.js';
import type { IProjectRepository, IIssueRepository, IIntegrityValidator, IWorkflowConfig, ProjectItem } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockWorkflowConfig, createMockProjectItem, createMockTaskData } from '../../helpers/mock-factories.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';

function createMockProjectRepo(): IProjectRepository {
  return {
    getProjectItems: vi.fn().mockResolvedValue([]),
    updateItemField: vi.fn(),
    getContainerStatus: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), updateTaskStatus: vi.fn(),
    updateTaskField: vi.fn(), updateTaskContainer: vi.fn(), assignTask: vi.fn(),
    addComment: vi.fn(), closeIssue: vi.fn(), findPullRequestForIssue: vi.fn(),
    getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockIntegrityValidator(): IIntegrityValidator {
  return {
    validateAssignmentIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
  };
}

function makeItems(...specs: Array<{ wave?: string; status?: string }>): ProjectItem[] {
  return specs.map((spec, i) => createMockProjectItem({
    id: `PVTI_${i}`,
    content: { number: i + 1, title: `Task ${i + 1}`, body: '', url: '', closed: false },
    fieldValues: {
      Wave: spec.wave ?? 'wave-001',
      Status: spec.status ?? 'Backlog',
    },
  }));
}

describe('ContainerService', () => {
  let service: ContainerService;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let integrityValidator: ReturnType<typeof createMockIntegrityValidator>;
  let workflowConfig: IWorkflowConfig;
  let logger: TestLogger;

  beforeEach(() => {
    projectRepo = createMockProjectRepo();
    issueRepo = createMockIssueRepo();
    integrityValidator = createMockIntegrityValidator();
    workflowConfig = createMockWorkflowConfig();
    logger = new TestLogger();
    service = new ContainerService(projectRepo, issueRepo, integrityValidator, workflowConfig, HYDRO_PROFILE, logger);
  });

  describe('listContainers', () => {
    it('returns empty array when no items', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([]);
      const result = await service.listContainers();
      expect(result).toHaveLength(0);
    });

    it('groups items by container name', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001' },
          { wave: 'wave-001' },
          { wave: 'wave-002' },
        ),
      );

      const result = await service.listContainers();
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('wave-001');
      expect(result[0]!.taskCount).toBe(2);
      expect(result[1]!.name).toBe('wave-002');
      expect(result[1]!.taskCount).toBe(1);
    });

    it('skips items without container', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        createMockProjectItem({ fieldValues: { Status: 'Backlog' } }),
      ]);

      const result = await service.listContainers();
      expect(result).toHaveLength(0);
    });

    it('calculates completion percentage', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Done' },
          { wave: 'wave-001', status: 'In Progress' },
          { wave: 'wave-001', status: 'Done' },
          { wave: 'wave-001', status: 'Backlog' },
        ),
      );

      const result = await service.listContainers();
      expect(result[0]!.completedCount).toBe(2);
      expect(result[0]!.completionPercentage).toBe(50);
    });

    it('sets status to completed when all tasks done', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Done' },
          { wave: 'wave-001', status: 'Done' },
        ),
      );

      const result = await service.listContainers();
      expect(result[0]!.status).toBe('completed');
    });

    it('sets status to active when some tasks completed', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Done' },
          { wave: 'wave-001', status: 'In Progress' },
        ),
      );

      const result = await service.listContainers();
      expect(result[0]!.status).toBe('active');
    });

    it('sets status to not_started when no tasks completed', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Backlog' },
          { wave: 'wave-001', status: 'Ready for Dev' },
        ),
      );

      const result = await service.listContainers();
      expect(result[0]!.status).toBe('not_started');
    });

    it('sorts containers alphabetically', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-003' },
          { wave: 'wave-001' },
          { wave: 'wave-002' },
        ),
      );

      const result = await service.listContainers();
      expect(result.map((w) => w.name)).toEqual(['wave-001', 'wave-002', 'wave-003']);
    });
  });

  describe('getContainerStatus', () => {
    it('delegates to projectRepository', async () => {
      const waveData = {
        name: 'wave-001',
        tasks: [createMockTaskData()],
        metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, ready: 1 },
      };
      vi.mocked(projectRepo.getContainerStatus).mockResolvedValue(waveData);

      const result = await service.getContainerStatus('wave-001');
      expect(result).toEqual(waveData);
      expect(projectRepo.getContainerStatus).toHaveBeenCalledWith('wave-001');
    });
  });

  describe('createContainer', () => {
    it('creates container with valid name', async () => {
      const result = await service.createContainer('wave-001-auth');
      expect(result.name).toBe('wave-001-auth');
      expect(result.created).toBe(true);
    });

    it('returns created=false for duplicate container', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems({ wave: 'wave-001-auth' }),
      );

      const result = await service.createContainer('wave-001-auth');
      expect(result.created).toBe(false);
    });

    it('throws for invalid container format', async () => {
      await expect(service.createContainer('bad-name')).rejects.toThrow();
    });
  });

  describe('assignTaskToContainer', () => {
    it('updates container and checks integrity', async () => {
      const result = await service.assignTaskToContainer(42, 'wave-001-auth');

      expect(issueRepo.updateTaskContainer).toHaveBeenCalledWith(42, 'wave-001-auth');
      expect(integrityValidator.validateAssignmentIntegrity).toHaveBeenCalledWith(42, 'wave-001-auth');
      expect(result.issueNumber).toBe(42);
      expect(result.container).toBe('wave-001-auth');
      expect(result.integrity.maintained).toBe(true);
    });

    it('returns integrity violations when epic is split across containers', async () => {
      vi.mocked(integrityValidator.validateAssignmentIntegrity).mockResolvedValue({
        maintained: false, violations: ['Epic split across containers'],
      });

      const result = await service.assignTaskToContainer(42, 'wave-002-feature');
      expect(result.integrity.maintained).toBe(false);
      expect(result.integrity.violations).toHaveLength(1);
    });

    it('throws for invalid container format', async () => {
      await expect(service.assignTaskToContainer(42, 'invalid')).rejects.toThrow();
    });
  });

  describe('validateContainerCompletion', () => {
    it('returns canComplete=true when all tasks are Done', async () => {
      vi.mocked(projectRepo.getContainerStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [
          createMockTaskData({ number: 1, status: 'Done' }),
          createMockTaskData({ number: 2, status: 'Done' }),
        ],
        metrics: { total: 2, completed: 2, inProgress: 0, blocked: 0, ready: 0 },
      });

      const result = await service.validateContainerCompletion('wave-001');
      expect(result.canComplete).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.tasks).toHaveLength(0);
    });

    it('returns canComplete=false when some tasks not Done', async () => {
      vi.mocked(projectRepo.getContainerStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [
          createMockTaskData({ number: 1, title: 'Task A', status: 'Done' }),
          createMockTaskData({ number: 2, title: 'Task B', status: 'In Progress' }),
        ],
        metrics: { total: 2, completed: 1, inProgress: 1, blocked: 0, ready: 0 },
      });

      const result = await service.validateContainerCompletion('wave-001');
      expect(result.canComplete).toBe(false);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.number).toBe(2);
      expect(result.reasons[0]).toContain('#2');
      expect(result.reasons[0]).toContain('In Progress');
    });

    it('returns canComplete=false for empty container', async () => {
      vi.mocked(projectRepo.getContainerStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
      });

      const result = await service.validateContainerCompletion('wave-001');
      expect(result.canComplete).toBe(false);
      expect(result.reasons).toContain('Container has no tasks');
    });
  });
});
