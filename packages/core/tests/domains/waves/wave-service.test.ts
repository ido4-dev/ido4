import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveService } from '../../../src/domains/waves/wave-service.js';
import type { IProjectRepository, IIssueRepository, IEpicValidator, IWorkflowConfig, ProjectItem } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockWorkflowConfig, createMockProjectItem, createMockTaskData } from '../../helpers/mock-factories.js';

function createMockProjectRepo(): IProjectRepository {
  return {
    getProjectItems: vi.fn().mockResolvedValue([]),
    updateItemField: vi.fn(),
    getWaveStatus: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), updateTaskStatus: vi.fn(),
    updateTaskField: vi.fn(), updateTaskWave: vi.fn(), assignTask: vi.fn(),
    addComment: vi.fn(), closeIssue: vi.fn(), findPullRequestForIssue: vi.fn(),
    getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockEpicValidator(): IEpicValidator {
  return {
    validateWaveAssignmentEpicIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
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

describe('WaveService', () => {
  let service: WaveService;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let epicValidator: ReturnType<typeof createMockEpicValidator>;
  let workflowConfig: IWorkflowConfig;
  let logger: TestLogger;

  beforeEach(() => {
    projectRepo = createMockProjectRepo();
    issueRepo = createMockIssueRepo();
    epicValidator = createMockEpicValidator();
    workflowConfig = createMockWorkflowConfig();
    logger = new TestLogger();
    service = new WaveService(projectRepo, issueRepo, epicValidator, workflowConfig, logger);
  });

  describe('listWaves', () => {
    it('returns empty array when no items', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([]);
      const result = await service.listWaves();
      expect(result).toHaveLength(0);
    });

    it('groups items by wave name', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001' },
          { wave: 'wave-001' },
          { wave: 'wave-002' },
        ),
      );

      const result = await service.listWaves();
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('wave-001');
      expect(result[0]!.taskCount).toBe(2);
      expect(result[1]!.name).toBe('wave-002');
      expect(result[1]!.taskCount).toBe(1);
    });

    it('skips items without wave', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        createMockProjectItem({ fieldValues: { Status: 'Backlog' } }),
      ]);

      const result = await service.listWaves();
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

      const result = await service.listWaves();
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

      const result = await service.listWaves();
      expect(result[0]!.status).toBe('completed');
    });

    it('sets status to active when some tasks completed', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Done' },
          { wave: 'wave-001', status: 'In Progress' },
        ),
      );

      const result = await service.listWaves();
      expect(result[0]!.status).toBe('active');
    });

    it('sets status to not_started when no tasks completed', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-001', status: 'Backlog' },
          { wave: 'wave-001', status: 'Ready for Dev' },
        ),
      );

      const result = await service.listWaves();
      expect(result[0]!.status).toBe('not_started');
    });

    it('sorts waves alphabetically', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems(
          { wave: 'wave-003' },
          { wave: 'wave-001' },
          { wave: 'wave-002' },
        ),
      );

      const result = await service.listWaves();
      expect(result.map((w) => w.name)).toEqual(['wave-001', 'wave-002', 'wave-003']);
    });
  });

  describe('getWaveStatus', () => {
    it('delegates to projectRepository', async () => {
      const waveData = {
        name: 'wave-001',
        tasks: [createMockTaskData()],
        metrics: { total: 1, completed: 0, inProgress: 0, blocked: 0, ready: 1 },
      };
      vi.mocked(projectRepo.getWaveStatus).mockResolvedValue(waveData);

      const result = await service.getWaveStatus('wave-001');
      expect(result).toEqual(waveData);
      expect(projectRepo.getWaveStatus).toHaveBeenCalledWith('wave-001');
    });
  });

  describe('createWave', () => {
    it('creates wave with valid name', async () => {
      const result = await service.createWave('wave-001-auth');
      expect(result.name).toBe('wave-001-auth');
      expect(result.created).toBe(true);
    });

    it('returns created=false for duplicate wave', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue(
        makeItems({ wave: 'wave-001-auth' }),
      );

      const result = await service.createWave('wave-001-auth');
      expect(result.created).toBe(false);
    });

    it('throws for invalid wave format', async () => {
      await expect(service.createWave('bad-name')).rejects.toThrow();
    });
  });

  describe('assignTaskToWave', () => {
    it('updates wave and checks epic integrity', async () => {
      const result = await service.assignTaskToWave(42, 'wave-001-auth');

      expect(issueRepo.updateTaskWave).toHaveBeenCalledWith(42, 'wave-001-auth');
      expect(epicValidator.validateWaveAssignmentEpicIntegrity).toHaveBeenCalledWith(42, 'wave-001-auth');
      expect(result.issueNumber).toBe(42);
      expect(result.wave).toBe('wave-001-auth');
      expect(result.epicIntegrity.maintained).toBe(true);
    });

    it('returns integrity violations when epic is split', async () => {
      vi.mocked(epicValidator.validateWaveAssignmentEpicIntegrity).mockResolvedValue({
        maintained: false, violations: ['Epic split across waves'],
      });

      const result = await service.assignTaskToWave(42, 'wave-002-feature');
      expect(result.epicIntegrity.maintained).toBe(false);
      expect(result.epicIntegrity.violations).toHaveLength(1);
    });

    it('throws for invalid wave format', async () => {
      await expect(service.assignTaskToWave(42, 'invalid')).rejects.toThrow();
    });
  });

  describe('validateWaveCompletion', () => {
    it('returns canComplete=true when all tasks are Done', async () => {
      vi.mocked(projectRepo.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [
          createMockTaskData({ number: 1, status: 'Done' }),
          createMockTaskData({ number: 2, status: 'Done' }),
        ],
        metrics: { total: 2, completed: 2, inProgress: 0, blocked: 0, ready: 0 },
      });

      const result = await service.validateWaveCompletion('wave-001');
      expect(result.canComplete).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.tasks).toHaveLength(0);
    });

    it('returns canComplete=false when some tasks not Done', async () => {
      vi.mocked(projectRepo.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [
          createMockTaskData({ number: 1, title: 'Task A', status: 'Done' }),
          createMockTaskData({ number: 2, title: 'Task B', status: 'In Progress' }),
        ],
        metrics: { total: 2, completed: 1, inProgress: 1, blocked: 0, ready: 0 },
      });

      const result = await service.validateWaveCompletion('wave-001');
      expect(result.canComplete).toBe(false);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.number).toBe(2);
      expect(result.reasons[0]).toContain('#2');
      expect(result.reasons[0]).toContain('In Progress');
    });

    it('returns canComplete=false for empty wave', async () => {
      vi.mocked(projectRepo.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
      });

      const result = await service.validateWaveCompletion('wave-001');
      expect(result.canComplete).toBe(false);
      expect(result.reasons).toContain('Wave has no tasks');
    });
  });
});
