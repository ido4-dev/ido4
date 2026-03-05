import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicValidator } from '../../../src/domains/epics/epic-validator.js';
import type { IEpicService, IIssueRepository, TaskData } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData } from '../../helpers/mock-factories.js';

function createMockEpicService(): IEpicService {
  return {
    getTasksInEpic: vi.fn(),
    validateEpicIntegrity: vi.fn(),
  };
}

function createMockIssueRepository(): IIssueRepository {
  return {
    getTask: vi.fn(),
    getTaskWithDetails: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTaskField: vi.fn(),
    updateTaskWave: vi.fn(),
    assignTask: vi.fn(),
    addComment: vi.fn(),
    closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(),
    getSubIssues: vi.fn(),
  };
}

describe('EpicValidator', () => {
  let validator: EpicValidator;
  let epicService: ReturnType<typeof createMockEpicService>;
  let issueRepo: ReturnType<typeof createMockIssueRepository>;
  let logger: TestLogger;

  beforeEach(() => {
    epicService = createMockEpicService();
    issueRepo = createMockIssueRepository();
    logger = new TestLogger();
    validator = new EpicValidator(epicService, issueRepo, logger);
  });

  describe('validateWaveAssignmentEpicIntegrity', () => {
    it('returns maintained when task has no epic', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: undefined }),
      );

      const result = await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('returns maintained when all epic tasks would be in same wave', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        createMockTaskData({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
      ]);

      const result = await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('returns violated when assignment would split epic across waves', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        createMockTaskData({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
      ]);

      // Assigning task 1 to wave-002 while task 2 stays in wave-001
      const result = await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-002');

      expect(result.maintained).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('wave-001');
      expect(result.violations[0]).toContain('wave-002');
    });

    it('returns maintained when assigning first task to a wave (others have no wave)', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: 'Auth Epic' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, epic: 'Auth Epic' }),
        createMockTaskData({ number: 2, epic: 'Auth Epic' }),
      ]);

      const result = await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('returns maintained when all other tasks already in proposed wave', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 3, epic: 'Auth Epic' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        createMockTaskData({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
        createMockTaskData({ number: 3, epic: 'Auth Epic' }),
      ]);

      const result = await validator.validateWaveAssignmentEpicIntegrity(3, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('handles single task epic', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: 'Solo Epic' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, epic: 'Solo Epic' }),
      ]);

      const result = await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('calls issueRepository.getTask with correct issue number', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 42, epic: undefined }),
      );

      await validator.validateWaveAssignmentEpicIntegrity(42, 'wave-001');

      expect(issueRepo.getTask).toHaveBeenCalledWith(42);
    });

    it('calls epicService.getTasksInEpic with correct epic name', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, epic: 'Auth Epic' }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([]);

      await validator.validateWaveAssignmentEpicIntegrity(1, 'wave-001');

      expect(epicService.getTasksInEpic).toHaveBeenCalledWith('Auth Epic');
    });
  });
});
