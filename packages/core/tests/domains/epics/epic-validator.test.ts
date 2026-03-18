import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrityValidator } from '../../../src/domains/epics/integrity-validator.js';
import type { IEpicService, IIssueRepository, TaskData } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData } from '../../helpers/mock-factories.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../../src/profiles/shape-up.js';

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
    getIssueComments: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTaskField: vi.fn(),
    updateTaskContainer: vi.fn(),
    assignTask: vi.fn(),
    addComment: vi.fn(),
    closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(),
    getSubIssues: vi.fn(),
  };
}

describe('IntegrityValidator', () => {
  let validator: IntegrityValidator;
  let epicService: ReturnType<typeof createMockEpicService>;
  let issueRepo: ReturnType<typeof createMockIssueRepository>;
  let logger: TestLogger;

  beforeEach(() => {
    epicService = createMockEpicService();
    issueRepo = createMockIssueRepository();
    logger = new TestLogger();
    validator = new IntegrityValidator(epicService, issueRepo, HYDRO_PROFILE, logger);
  });

  describe('validateAssignmentIntegrity', () => {
    it('returns maintained when task has no epic', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { wave: 'wave-001' } }),
      );

      const result = await validator.validateAssignmentIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('returns maintained when all epic tasks would be in same container', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
        createMockTaskData({ number: 2, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
      ]);

      const result = await validator.validateAssignmentIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('returns violated when assignment would split epic across containers', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
        createMockTaskData({ number: 2, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
      ]);

      // Assigning task 1 to wave-002 while task 2 stays in wave-001
      const result = await validator.validateAssignmentIntegrity(1, 'wave-002');

      expect(result.maintained).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('wave-001');
      expect(result.violations[0]).toContain('wave-002');
    });

    it('returns maintained when assigning first task to a container (others have no container)', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { epic: 'Auth Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { epic: 'Auth Epic' } }),
        createMockTaskData({ number: 2, containers: { epic: 'Auth Epic' } }),
      ]);

      const result = await validator.validateAssignmentIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('returns maintained when all other tasks already in proposed container', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 3, containers: { epic: 'Auth Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
        createMockTaskData({ number: 2, containers: { wave: 'wave-001', epic: 'Auth Epic' } }),
        createMockTaskData({ number: 3, containers: { epic: 'Auth Epic' } }),
      ]);

      const result = await validator.validateAssignmentIntegrity(3, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('handles single task epic', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { epic: 'Solo Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { epic: 'Solo Epic' } }),
      ]);

      const result = await validator.validateAssignmentIntegrity(1, 'wave-001');

      expect(result.maintained).toBe(true);
    });

    it('calls issueRepository.getTask with correct issue number', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 42, containers: { wave: 'wave-001' } }),
      );

      await validator.validateAssignmentIntegrity(42, 'wave-001');

      expect(issueRepo.getTask).toHaveBeenCalledWith(42);
    });

    it('calls epicService.getTasksInEpic with correct epic name', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { epic: 'Auth Epic' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([]);

      await validator.validateAssignmentIntegrity(1, 'wave-001');

      expect(epicService.getTasksInEpic).toHaveBeenCalledWith('Auth Epic');
    });
  });

  describe('Shape Up profile — bet-cycle integrity', () => {
    let shapeUpValidator: IntegrityValidator;

    beforeEach(() => {
      shapeUpValidator = new IntegrityValidator(epicService, issueRepo, SHAPE_UP_PROFILE, logger);
    });

    it('validates bet-cycle integrity rule (same-container)', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
        createMockTaskData({ number: 2, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
      ]);

      const result = await shapeUpValidator.validateAssignmentIntegrity(1, 'cycle-001');

      expect(result.maintained).toBe(true);
    });

    it('detects violation when bet tasks split across cycles', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
      );
      vi.mocked(epicService.getTasksInEpic).mockResolvedValue([
        createMockTaskData({ number: 1, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
        createMockTaskData({ number: 2, containers: { bet: 'notifications', cycle: 'cycle-001' } }),
      ]);

      // Assigning task 1 to cycle-002 while task 2 stays in cycle-001
      const result = await shapeUpValidator.validateAssignmentIntegrity(1, 'cycle-002');

      expect(result.maintained).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('cycle-001');
      expect(result.violations[0]).toContain('cycle-002');
    });

    it('returns maintained when task has no bet assignment', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, containers: { cycle: 'cycle-001' } }),
      );

      const result = await shapeUpValidator.validateAssignmentIntegrity(1, 'cycle-001');

      expect(result.maintained).toBe(true);
    });
  });
});
