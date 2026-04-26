import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskWorkflowService } from '../../../src/domains/tasks/task-workflow-service.js';
import type { IIssueRepository, ITaskTransitionValidator, IWorkflowConfig } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData, createMockWorkflowConfig } from '../../helpers/mock-factories.js';
import { SYSTEM_ACTOR } from '../../../src/index.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import type { ValidationResult, TransitionType } from '../../../src/domains/tasks/types.js';

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), getIssueComments: vi.fn(),
    updateTaskStatus: vi.fn(), updateTaskField: vi.fn(), updateTaskContainer: vi.fn(),
    assignTask: vi.fn(), addComment: vi.fn(), closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(), getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockValidator(): ITaskTransitionValidator {
  return {
    validateTransition: vi.fn(),
    validateAllTransitions: vi.fn(),
  };
}

function makePassingValidation(transition: TransitionType): ValidationResult {
  return {
    canProceed: true,
    transition,
    reason: 'All validations passed',
    details: [],
    suggestions: [],
    metadata: {},
  };
}

function makeFailingValidation(transition: TransitionType): ValidationResult {
  return {
    canProceed: false,
    transition,
    reason: '1 validation(s) failed',
    details: [{ stepName: 'TestStep', passed: false, message: 'Failed', severity: 'error' }],
    suggestions: ['Fix the issue'],
    metadata: {},
  };
}

describe('TaskWorkflowService', () => {
  let service: TaskWorkflowService;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let validator: ReturnType<typeof createMockValidator>;
  let workflowConfig: IWorkflowConfig;
  let logger: TestLogger;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    validator = createMockValidator();
    workflowConfig = createMockWorkflowConfig();
    logger = new TestLogger();
    service = new TaskWorkflowService(issueRepo, validator, workflowConfig, logger, HYDRO_PROFILE);

    vi.mocked(issueRepo.getTask).mockResolvedValue(
      createMockTaskData({ status: 'Ready for Dev' }),
    );
  });

  describe('executeTransition — happy path', () => {
    it('executes start transition successfully', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('start'));

      const result = await service.executeTransition('start', {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(result.executed).toBe(true);
      expect(result.fromStatus).toBe('Ready for Dev');
      expect(result.toStatus).toBe('In Progress');
      expect(result.transition).toBe('start');
      expect(issueRepo.updateTaskStatus).toHaveBeenCalledWith(42, 'IN_PROGRESS');
    });

    it('executes refine transition', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'Backlog' }));
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('refine'));

      const result = await service.executeTransition('refine', {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(result.executed).toBe(true);
      expect(result.toStatus).toBe('In Refinement');
      expect(issueRepo.updateTaskStatus).toHaveBeenCalledWith(42, 'IN_REFINEMENT');
    });

    it('executes block transition with reason comment', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Progress' }));
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('block'));

      const result = await service.executeTransition('block', {
        issueNumber: 42, actor: SYSTEM_ACTOR, reason: 'API is down',
      });

      expect(result.executed).toBe(true);
      expect(result.toStatus).toBe('Blocked');
      expect(issueRepo.addComment).toHaveBeenCalledWith(42, 'Blocked: API is down');
    });

    it('executes return transition with target status', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Progress' }));
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('return'));

      const result = await service.executeTransition('return', {
        issueNumber: 42, actor: SYSTEM_ACTOR, targetStatus: 'Ready for Dev', reason: 'Needs rework',
      });

      expect(result.executed).toBe(true);
      expect(result.toStatus).toBe('Ready for Dev');
      expect(issueRepo.addComment).toHaveBeenCalledWith(42, 'Returned: Needs rework');
    });

    it('closes issue on approve transition', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Review' }));
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('approve'));

      await service.executeTransition('approve', {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(issueRepo.closeIssue).toHaveBeenCalledWith(42);
    });

    it('adds message comment when provided', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('start'));

      await service.executeTransition('start', {
        issueNumber: 42, actor: SYSTEM_ACTOR, message: 'Starting work',
      });

      expect(issueRepo.addComment).toHaveBeenCalledWith(42, 'Starting work');
    });
  });

  describe('executeTransition — validation failure', () => {
    it('returns executed=false when validation fails', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue(makeFailingValidation('start'));

      const result = await service.executeTransition('start', {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(result.executed).toBe(false);
      expect(result.validationResult.canProceed).toBe(false);
      expect(issueRepo.updateTaskStatus).not.toHaveBeenCalled();
    });

    it('returns clean failure (no throw) on never-valid transition (Phase 5 F5)', async () => {
      // Phase 5 F5 regression test: prior to F5 the engine threw "Unknown
      // status key: complete" when complete_task was invoked from a state
      // (e.g., IN_PROGRESS) where the `complete` action is not valid (Hydro's
      // complete is DONE→DONE-only). The cause was getTargetStatusKey's
      // fallback returning the action name as a status key, which then
      // threw at getStatusName(). Fix: short-circuit failed-validation paths
      // BEFORE computing toStatus; return toStatus = fromStatus (no movement).

      // Task is in IN_PROGRESS — validation fails because `complete` requires DONE
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Progress' }));
      vi.mocked(validator.validateTransition).mockResolvedValue(makeFailingValidation('complete'));

      // Before F5: this would throw "Unknown status key: complete"
      // After F5: returns clean failure result
      const result = await service.executeTransition('complete' as TransitionType, {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(result.executed).toBe(false);
      expect(result.validationResult.canProceed).toBe(false);
      // toStatus equals fromStatus — no movement attempted
      expect(result.toStatus).toBe('In Progress');
      expect(result.fromStatus).toBe('In Progress');
      expect(issueRepo.updateTaskStatus).not.toHaveBeenCalled();
    });
  });

  describe('executeTransition — skipValidation', () => {
    it('skips validation when skipValidation=true', async () => {
      const result = await service.executeTransition('start', {
        issueNumber: 42, actor: SYSTEM_ACTOR, skipValidation: true,
      });

      expect(result.executed).toBe(true);
      expect(validator.validateTransition).not.toHaveBeenCalled();
      expect(result.validationResult.metadata).toEqual({ skipped: true });
    });
  });

  describe('executeTransition — dryRun', () => {
    it('returns executed=false on dryRun without calling updateTaskStatus', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('start'));

      const result = await service.executeTransition('start', {
        issueNumber: 42, actor: SYSTEM_ACTOR, dryRun: true,
      });

      expect(result.executed).toBe(false);
      expect(result.validationResult.canProceed).toBe(true);
      expect(issueRepo.updateTaskStatus).not.toHaveBeenCalled();
      expect(issueRepo.addComment).not.toHaveBeenCalled();
    });
  });

  describe('executeTransition — all transition types map correctly', () => {
    // Each transition needs a valid from-status for profile-driven lookup
    const transitionToStatus: Array<[TransitionType, string, string, string]> = [
      ['refine', 'IN_REFINEMENT', 'In Refinement', 'Backlog'],
      ['ready', 'READY_FOR_DEV', 'Ready for Dev', 'In Refinement'],
      ['start', 'IN_PROGRESS', 'In Progress', 'Ready for Dev'],
      ['review', 'IN_REVIEW', 'In Review', 'In Progress'],
      ['approve', 'DONE', 'Done', 'In Review'],
      ['complete', 'DONE', 'Done', 'Done'],
      ['block', 'BLOCKED', 'Blocked', 'In Progress'],
      ['unblock', 'READY_FOR_DEV', 'Ready for Dev', 'Blocked'],
    ];

    for (const [transition, statusKey, statusName, fromStatus] of transitionToStatus) {
      it(`maps ${transition} → ${statusName}`, async () => {
        vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: fromStatus }));
        vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation(transition));

        const result = await service.executeTransition(transition, {
          issueNumber: 42, actor: SYSTEM_ACTOR,
        });

        expect(result.toStatus).toBe(statusName);
        expect(issueRepo.updateTaskStatus).toHaveBeenCalledWith(42, statusKey);
      });
    }
  });

  describe('profile-driven behaviors', () => {
    it('uses profile.behaviors.closingTransitions for closing transition detection', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue(makePassingValidation('approve'));
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Review' }));

      await service.executeTransition('approve', {
        issueNumber: 42, actor: SYSTEM_ACTOR,
      });

      expect(issueRepo.closeIssue).toHaveBeenCalledWith(42);
    });
  });
});
