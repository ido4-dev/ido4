import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskTransitionValidator } from '../../../src/domains/tasks/task-transition-validator.js';
import type { IIssueRepository, IProjectConfig, IWorkflowConfig, IIntegrityValidator, IRepositoryRepository, IGitWorkflowConfig } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig, createMockGitWorkflowConfig } from '../../helpers/mock-factories.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), getIssueComments: vi.fn(),
    updateTaskStatus: vi.fn(), updateTaskField: vi.fn(), updateTaskContainer: vi.fn(),
    assignTask: vi.fn(), addComment: vi.fn(), closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(), getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockRepoRepo(): IRepositoryRepository {
  return {
    mergePullRequest: vi.fn(), findPullRequestForIssue: vi.fn(),
    checkContainerBranchMerged: vi.fn(), getPullRequestReviews: vi.fn(),
  };
}

function createMockIntegrityValidator(): IIntegrityValidator {
  return {
    validateAssignmentIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
  };
}

describe('TaskTransitionValidator', () => {
  let validator: TaskTransitionValidator;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let repoRepo: ReturnType<typeof createMockRepoRepo>;
  let integrityValidator: ReturnType<typeof createMockIntegrityValidator>;
  let logger: TestLogger;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    repoRepo = createMockRepoRepo();
    integrityValidator = createMockIntegrityValidator();
    logger = new TestLogger();
    validator = new TaskTransitionValidator(
      issueRepo,
      createMockProjectConfig(),
      createMockWorkflowConfig(),
      integrityValidator,
      repoRepo,
      createMockGitWorkflowConfig(),
      logger,
      undefined,
      undefined,
      undefined,
      HYDRO_PROFILE,
    );
  });

  describe('validateTransition', () => {
    it('validates start transition for Ready for Dev task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Ready for Dev', wave: 'wave-001', dependencies: 'No dependencies' }),
      );

      const result = await validator.validateTransition(42, 'start');
      expect(result.canProceed).toBe(true);
      expect(result.transition).toBe('start');
    });

    it('fails start transition for Backlog task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Backlog' }),
      );

      const result = await validator.validateTransition(42, 'start');
      expect(result.canProceed).toBe(false);
    });

    it('validates refine transition for Backlog task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Backlog' }),
      );

      const result = await validator.validateTransition(42, 'refine');
      expect(result.canProceed).toBe(true);
    });

    it('validates block transition for In Progress task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );

      const result = await validator.validateTransition(42, 'block');
      expect(result.canProceed).toBe(true);
    });

    it('fails block transition for Done task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Done' }),
      );

      const result = await validator.validateTransition(42, 'block');
      expect(result.canProceed).toBe(false);
    });

    it('validates unblock transition for Blocked task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Blocked' }),
      );

      const result = await validator.validateTransition(42, 'unblock');
      expect(result.canProceed).toBe(true);
    });

    it('validates return transition for In Progress task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );

      const result = await validator.validateTransition(42, 'return');
      expect(result.canProceed).toBe(true);
    });

    it('fails return transition for Backlog task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Backlog' }),
      );

      const result = await validator.validateTransition(42, 'return');
      expect(result.canProceed).toBe(false);
    });

    it('validates review transition for In Progress task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );
      vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue({
        number: 100, title: 'PR', url: '', state: 'OPEN', merged: false,
      });

      const result = await validator.validateTransition(42, 'review');
      expect(result.canProceed).toBe(true);
    });

    it('validates approve transition for In Review task', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Review' }),
      );

      const result = await validator.validateTransition(42, 'approve');
      expect(result.canProceed).toBe(true);
    });

    it('returns all step details in result', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Ready for Dev', wave: 'wave-001', dependencies: 'No dependencies' }),
      );

      const result = await validator.validateTransition(42, 'start');
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.metadata.totalSteps).toBeGreaterThan(0);
    });
  });

  describe('validateAllTransitions', () => {
    it('returns results for all 9 transitions', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'Ready for Dev', wave: 'wave-001', dependencies: 'No dependencies' }),
      );

      const result = await validator.validateAllTransitions(42);
      expect(result.issueNumber).toBe(42);
      expect(Object.keys(result.transitions)).toHaveLength(9);
      expect(result.transitions['start']).toBeDefined();
      expect(result.transitions['block']).toBeDefined();
    });

    it('fetches task only once', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );

      await validator.validateAllTransitions(42);
      expect(issueRepo.getTask).toHaveBeenCalledTimes(1);
    });

    it('marks valid transitions as canProceed=true', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );
      vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue({
        number: 100, title: 'PR', url: '', state: 'OPEN', merged: false,
      });

      const result = await validator.validateAllTransitions(42);
      // In Progress can: review, block, return
      expect(result.transitions['review']!.canProceed).toBe(true);
      expect(result.transitions['block']!.canProceed).toBe(true);
      expect(result.transitions['return']!.canProceed).toBe(true);
      // In Progress cannot: start, refine, ready, approve, unblock
      expect(result.transitions['start']!.canProceed).toBe(false);
      expect(result.transitions['refine']!.canProceed).toBe(false);
    });
  });
});
