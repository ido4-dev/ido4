/**
 * TaskService — Facade for task operations (implements ITaskService).
 *
 * This is the ONLY service that:
 * - Returns ToolResponse<T>
 * - Emits domain events
 * - Builds audit entries
 *
 * Delegates workflow execution to TaskWorkflowService,
 * suggestion generation to SuggestionService.
 */

import type {
  ITaskService,
  ITaskTransitionValidator,
  IIssueRepository,
  IWorkflowConfig,
  TaskTransitionRequest,
  BlockTaskRequest,
  ReturnTaskRequest,
  GetTaskRequest,
  TaskData,
  TaskTransitionData,
  Warning,
  AuditEntry,
  AuditValidationResult,
  AuditValidationDetail,
} from '../../container/interfaces.js';
import type { ToolResponse } from '../../shared/tool-response.js';
import type { ILogger } from '../../shared/logger.js';
import type { IEventBus } from '../../shared/events/event-bus.js';
import type { TaskTransitionEvent } from '../../shared/events/types.js';
import type { TransitionType, ValidationResult } from './types.js';
import type { TaskWorkflowService, WorkflowTransitionResult } from './task-workflow-service.js';
import type { SuggestionService } from './suggestion-service.js';

export class TaskService implements ITaskService {
  constructor(
    private readonly workflowService: TaskWorkflowService,
    private readonly suggestionService: SuggestionService,
    _transitionValidator: ITaskTransitionValidator,
    private readonly issueRepository: IIssueRepository,
    _workflowConfig: IWorkflowConfig,
    private readonly eventBus: IEventBus,
    private readonly sessionId: string,
    _logger: ILogger,
  ) {}

  async startTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('start', request);
  }

  async reviewTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('review', request);
  }

  async approveTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('approve', request);
  }

  async blockTask(request: BlockTaskRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('block', request);
  }

  async unblockTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('unblock', request);
  }

  async returnTask(request: ReturnTaskRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('return', request);
  }

  async refineTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('refine', request);
  }

  async readyTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>> {
    return this.executeTransition('ready', request);
  }

  async getTask(request: GetTaskRequest): Promise<TaskData> {
    return this.issueRepository.getTask(request.issueNumber);
  }

  async getTaskField(request: GetTaskRequest): Promise<unknown> {
    const task = await this.issueRepository.getTask(request.issueNumber);
    if (!request.field) return task;
    return (task as unknown as Record<string, unknown>)[request.field];
  }

  private async executeTransition(
    transition: TransitionType,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
  ): Promise<ToolResponse<TaskTransitionData>> {
    // 1. Execute workflow
    const workflowResult = await this.workflowService.executeTransition(transition, request);

    // 2. If validation failed, return failure response
    if (!workflowResult.validationResult.canProceed) {
      const task = await this.issueRepository.getTask(request.issueNumber);
      return this.buildFailureResponse(transition, workflowResult, task, request);
    }

    // 3. Fetch fresh task data
    const task = await this.issueRepository.getTask(request.issueNumber);

    // 4. Generate suggestions
    const suggestions = this.suggestionService.generateSuggestions(
      transition,
      workflowResult.validationResult,
      task,
    );

    // 5. Build audit entry
    const auditEntry = this.buildAuditEntry(transition, request, workflowResult);

    // 6. Extract warnings
    const warnings = this.extractWarnings(workflowResult.validationResult);

    // 7. Build audit validation result
    const validationResult = this.buildAuditValidation(workflowResult.validationResult);

    // 8. Emit event (only on actual execution, not dry run)
    if (workflowResult.executed && !request.dryRun) {
      this.emitTransitionEvent(transition, request, workflowResult, validationResult);
    }

    return {
      success: workflowResult.executed,
      data: {
        issueNumber: workflowResult.issueNumber,
        fromStatus: workflowResult.fromStatus,
        toStatus: workflowResult.toStatus,
      },
      suggestions,
      warnings,
      validationResult,
      auditEntry,
    };
  }

  private buildFailureResponse(
    transition: TransitionType,
    workflowResult: WorkflowTransitionResult,
    task: TaskData,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
  ): ToolResponse<TaskTransitionData> {
    const suggestions = this.suggestionService.generateSuggestions(
      transition,
      workflowResult.validationResult,
      task,
    );

    return {
      success: false,
      data: {
        issueNumber: workflowResult.issueNumber,
        fromStatus: workflowResult.fromStatus,
        toStatus: workflowResult.toStatus,
      },
      suggestions,
      warnings: this.extractWarnings(workflowResult.validationResult),
      validationResult: this.buildAuditValidation(workflowResult.validationResult),
      auditEntry: this.buildAuditEntry(transition, request, workflowResult),
    };
  }

  private buildAuditEntry(
    transition: TransitionType,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
    result: WorkflowTransitionResult,
  ): AuditEntry {
    return {
      timestamp: new Date().toISOString(),
      transition,
      issueNumber: result.issueNumber,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      actor: request.actor,
      validationResult: this.buildAuditValidation(result.validationResult),
      metadata: {
        dryRun: request.dryRun ?? false,
      },
    };
  }

  private buildAuditValidation(vr: ValidationResult): AuditValidationResult {
    const details: AuditValidationDetail[] = vr.details.map((d) => ({
      stepName: d.stepName,
      passed: d.passed,
      message: d.passed ? undefined : d.message,
    }));

    return {
      stepsRun: vr.details.length,
      stepsPassed: vr.details.filter((d) => d.passed).length,
      stepsFailed: vr.details.filter((d) => !d.passed && d.severity === 'error').length,
      stepsWarned: vr.details.filter((d) => d.severity === 'warning').length,
      details,
    };
  }

  private extractWarnings(vr: ValidationResult): Warning[] {
    return vr.details
      .filter((d) => d.severity === 'warning')
      .map((d) => ({
        code: d.stepName,
        message: d.message,
        severity: 'warning' as const,
      }));
  }

  private emitTransitionEvent(
    transition: TransitionType,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
    result: WorkflowTransitionResult,
    validationResult: AuditValidationResult,
  ): void {
    const event: TaskTransitionEvent = {
      type: 'task.transition',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      actor: request.actor,
      issueNumber: result.issueNumber,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      transition,
      validationResult,
      dryRun: false,
    };

    this.eventBus.emit(event);
  }
}
