import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../../../src/domains/tasks/task-service.js';
import { TaskWorkflowService } from '../../../src/domains/tasks/task-workflow-service.js';
import { SuggestionService } from '../../../src/domains/tasks/suggestion-service.js';
import type { IIssueRepository, IProjectRepository, ITaskTransitionValidator, IWorkflowConfig, TaskTransitionData, Suggestion } from '../../../src/container/interfaces.js';
import type { IEventBus } from '../../../src/shared/events/event-bus.js';
import type { DomainEvent } from '../../../src/shared/events/types.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData, createMockProjectConfig, createMockWorkflowConfig, createMockGitWorkflowConfig } from '../../helpers/mock-factories.js';
import { SYSTEM_ACTOR } from '../../../src/index.js';
import type { ValidationResult, TransitionType } from '../../../src/domains/tasks/types.js';
import type { WorkflowTransitionResult } from '../../../src/domains/tasks/task-workflow-service.js';

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), createIssue: vi.fn(),
    updateTaskStatus: vi.fn(), updateTaskField: vi.fn(), updateTaskWave: vi.fn(),
    assignTask: vi.fn(), addComment: vi.fn(), closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(), getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockProjectRepo(): IProjectRepository {
  return {
    getProjectItems: vi.fn().mockResolvedValue([]),
    addItemToProject: vi.fn().mockResolvedValue('PVTI_item1'),
    updateItemField: vi.fn(),
    getWaveStatus: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

function createMockValidator(): ITaskTransitionValidator {
  return {
    validateTransition: vi.fn(),
    validateAllTransitions: vi.fn(),
  };
}

function createMockEventBus(): IEventBus {
  return {
    on: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

function makeWorkflowResult(overrides: Partial<WorkflowTransitionResult> = {}): WorkflowTransitionResult {
  return {
    issueNumber: 42,
    fromStatus: 'Ready for Dev',
    toStatus: 'In Progress',
    transition: 'start',
    validationResult: {
      canProceed: true,
      transition: 'start',
      reason: 'All validations passed',
      details: [],
      suggestions: [],
      metadata: {},
    },
    executed: true,
    ...overrides,
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let workflowService: TaskWorkflowService;
  let suggestionService: SuggestionService;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let validator: ReturnType<typeof createMockValidator>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let logger: TestLogger;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    projectRepo = createMockProjectRepo();
    validator = createMockValidator();
    eventBus = createMockEventBus();
    logger = new TestLogger();

    const workflowConfig = createMockWorkflowConfig();
    const gitWorkflowConfig = createMockGitWorkflowConfig();
    const projectConfig = createMockProjectConfig();

    // Use real WorkflowService and SuggestionService but mock their dependencies
    workflowService = new TaskWorkflowService(issueRepo, validator, workflowConfig, logger);
    suggestionService = new SuggestionService(workflowConfig, gitWorkflowConfig);

    service = new TaskService(
      workflowService, suggestionService, validator,
      issueRepo, projectRepo, projectConfig, workflowConfig, eventBus, 'test-session', logger,
    );

    // Default: task in Ready for Dev, validation passes
    vi.mocked(issueRepo.getTask).mockResolvedValue(
      createMockTaskData({ status: 'Ready for Dev' }),
    );
    vi.mocked(validator.validateTransition).mockResolvedValue({
      canProceed: true, transition: 'start', reason: 'OK',
      details: [], suggestions: [], metadata: {},
    });
  });

  describe('transition methods delegate correctly', () => {
    it('startTask returns ToolResponse with correct shape', async () => {
      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });

      expect(result.success).toBe(true);
      expect(result.data.issueNumber).toBe(42);
      expect(result.data.fromStatus).toBe('Ready for Dev');
      expect(result.data.toStatus).toBe('In Progress');
      expect(result.suggestions).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.auditEntry).toBeDefined();
      expect(result.validationResult).toBeDefined();
    });

    it('refineTask delegates with refine transition', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'Backlog' }));
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: true, transition: 'refine', reason: 'OK',
        details: [], suggestions: [], metadata: {},
      });

      const result = await service.refineTask({ issueNumber: 42, actor: SYSTEM_ACTOR });
      expect(result.success).toBe(true);
      expect(result.data.toStatus).toBe('In Refinement');
    });

    it('blockTask passes reason', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Progress' }));
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: true, transition: 'block', reason: 'OK',
        details: [], suggestions: [], metadata: {},
      });

      const result = await service.blockTask({
        issueNumber: 42, actor: SYSTEM_ACTOR, reason: 'API down',
      });
      expect(result.success).toBe(true);
      expect(result.data.toStatus).toBe('Blocked');
    });

    it('returnTask passes targetStatus', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'In Progress' }));
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: true, transition: 'return', reason: 'OK',
        details: [], suggestions: [], metadata: {},
      });

      const result = await service.returnTask({
        issueNumber: 42, actor: SYSTEM_ACTOR, targetStatus: 'Ready for Dev', reason: 'Rework',
      });
      expect(result.success).toBe(true);
      expect(result.data.toStatus).toBe('Ready for Dev');
    });
  });

  describe('validation failure', () => {
    it('returns success=false when validation fails', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: false, transition: 'start', reason: 'Validation failed',
        details: [{ stepName: 'TestStep', passed: false, message: 'Bad', severity: 'error' }],
        suggestions: ['Fix it'], metadata: {},
      });

      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });
      expect(result.success).toBe(false);
      expect(result.validationResult!.stepsFailed).toBe(1);
    });

    it('still generates suggestions on failure', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: false, transition: 'start', reason: 'Failed',
        details: [{ stepName: 'WaveAssignmentValidation', passed: false, message: 'No wave', severity: 'error' }],
        suggestions: [], metadata: {},
      });

      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('audit entry', () => {
    it('includes actor in audit entry', async () => {
      const result = await service.startTask({
        issueNumber: 42,
        actor: { type: 'ai-agent', id: 'agent-1', name: 'Builder' },
      });

      expect(result.auditEntry!.actor.type).toBe('ai-agent');
      expect(result.auditEntry!.actor.id).toBe('agent-1');
    });

    it('includes transition details in audit entry', async () => {
      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });

      expect(result.auditEntry!.transition).toBe('start');
      expect(result.auditEntry!.issueNumber).toBe(42);
      expect(result.auditEntry!.fromStatus).toBe('Ready for Dev');
      expect(result.auditEntry!.toStatus).toBe('In Progress');
      expect(result.auditEntry!.timestamp).toBeDefined();
    });

    it('marks dryRun in audit metadata', async () => {
      const result = await service.startTask({
        issueNumber: 42, actor: SYSTEM_ACTOR, dryRun: true,
      });

      expect(result.auditEntry!.metadata.dryRun).toBe(true);
    });
  });

  describe('validation result mapping', () => {
    it('maps validation steps to AuditValidationResult', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: true, transition: 'start', reason: 'OK',
        details: [
          { stepName: 'StepA', passed: true, message: 'OK', severity: 'info' },
          { stepName: 'StepB', passed: false, message: 'Warn', severity: 'warning' },
        ],
        suggestions: [], metadata: {},
      });

      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });

      expect(result.validationResult!.stepsRun).toBe(2);
      expect(result.validationResult!.stepsPassed).toBe(1);
      expect(result.validationResult!.stepsWarned).toBe(1);
      expect(result.validationResult!.stepsFailed).toBe(0);
    });
  });

  describe('warnings', () => {
    it('extracts warning-severity steps as warnings', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: true, transition: 'start', reason: 'OK',
        details: [
          { stepName: 'RiskLevel', passed: false, message: 'High risk task', severity: 'warning' },
        ],
        suggestions: [], metadata: {},
      });

      const result = await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.code).toBe('RiskLevel');
      expect(result.warnings[0]!.message).toBe('High risk task');
      expect(result.warnings[0]!.severity).toBe('warning');
    });
  });

  describe('event emission', () => {
    it('emits TaskTransitionEvent on successful execution', async () => {
      await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const event = vi.mocked(eventBus.emit).mock.calls[0]![0];
      expect(event.type).toBe('task.transition');
      expect((event as any).issueNumber).toBe(42);
      expect((event as any).fromStatus).toBe('Ready for Dev');
      expect((event as any).toStatus).toBe('In Progress');
      expect((event as any).transition).toBe('start');
      expect(event.sessionId).toBe('test-session');
      expect(event.actor).toEqual(SYSTEM_ACTOR);
    });

    it('does NOT emit event on validation failure', async () => {
      vi.mocked(validator.validateTransition).mockResolvedValue({
        canProceed: false, transition: 'start', reason: 'Failed',
        details: [{ stepName: 'X', passed: false, message: 'Bad', severity: 'error' }],
        suggestions: [], metadata: {},
      });

      await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR });
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('does NOT emit event on dryRun', async () => {
      await service.startTask({ issueNumber: 42, actor: SYSTEM_ACTOR, dryRun: true });
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('getTask', () => {
    it('returns task data', async () => {
      const task = createMockTaskData({ number: 99, title: 'My Task' });
      vi.mocked(issueRepo.getTask).mockResolvedValue(task);

      const result = await service.getTask({ issueNumber: 99 });
      expect(result.number).toBe(99);
      expect(result.title).toBe('My Task');
    });
  });

  describe('getTaskField', () => {
    it('returns specific field value', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ status: 'In Progress' }),
      );

      const result = await service.getTaskField({ issueNumber: 42, field: 'status' });
      expect(result).toBe('In Progress');
    });

    it('returns full task when no field specified', async () => {
      const task = createMockTaskData();
      vi.mocked(issueRepo.getTask).mockResolvedValue(task);

      const result = await service.getTaskField({ issueNumber: 42 });
      expect(result).toEqual(task);
    });
  });
});
