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
  IProjectRepository,
  IProjectConfig,
  IWorkflowConfig,
  TaskTransitionRequest,
  BlockTaskRequest,
  ReturnTaskRequest,
  GetTaskRequest,
  ListTasksRequest,
  ListTasksData,
  CreateTaskRequest,
  CreateTaskData,
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
    private readonly projectRepository: IProjectRepository,
    private readonly projectConfig: IProjectConfig,
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

  async listTasks(request: ListTasksRequest): Promise<ToolResponse<ListTasksData>> {
    const items = await this.projectRepository.getProjectItems();

    let tasks: TaskData[] = items.map((item) => {
      const containers: Record<string, string> = {};
      if (item.fieldValues.Wave) containers['wave'] = item.fieldValues.Wave;
      if (item.fieldValues.Epic) containers['epic'] = item.fieldValues.Epic;

      return {
        id: item.content.url,
        itemId: item.id,
        number: item.content.number,
        title: item.content.title,
        body: item.content.body,
        status: item.fieldValues.Status ?? 'Unknown',
        containers,
        dependencies: item.fieldValues.Dependencies,
        aiSuitability: item.fieldValues['AI Suitability'],
        riskLevel: item.fieldValues['Risk Level'],
        effort: item.fieldValues.Effort,
        taskType: item.fieldValues['Task Type'],
        aiContext: item.fieldValues['AI Context'],
        url: item.content.url,
        closed: item.content.closed,
      };
    });

    if (request.status) {
      tasks = tasks.filter((t) => t.status === request.status);
    }
    if (request.wave) {
      tasks = tasks.filter((t) => t.containers['wave'] === request.wave);
    }

    return {
      success: true,
      data: { tasks, total: tasks.length, filters: request },
      suggestions: [],
      warnings: [],
    };
  }

  async createTask(request: CreateTaskRequest): Promise<ToolResponse<CreateTaskData>> {
    if (request.dryRun) {
      return {
        success: true,
        data: {
          issueNumber: 0, issueId: '', itemId: '', url: '',
          title: request.title, status: 'Backlog', fieldsSet: [],
        },
        suggestions: [],
        warnings: [{ code: 'DRY_RUN', message: 'Dry run — no issue created', severity: 'info' }],
      };
    }

    // 1. Create GitHub issue
    const issue = await this.issueRepository.createIssue(request.title, request.body);

    // 2. Add to project
    const itemId = await this.projectRepository.addItemToProject(issue.id);

    // 3. Set initial status
    const statusKey = request.initialStatus ?? 'BACKLOG';
    await this.issueRepository.updateTaskStatus(issue.number, statusKey);

    // 4. Set optional text fields
    const fieldsSet: string[] = ['status'];

    // Merge deprecated wave/epic aliases into generic containers
    const allContainers: Record<string, string> = { ...request.containers };
    if (request.wave && !allContainers['wave']) allContainers['wave'] = request.wave;
    if (request.epic && !allContainers['epic']) allContainers['epic'] = request.epic;

    // Set container fields
    for (const [key, value] of Object.entries(allContainers)) {
      if (value) {
        await this.issueRepository.updateTaskField(issue.number, key, value, 'text');
        fieldsSet.push(key);
      }
    }

    const textFields = [
      { key: 'dependencies', value: request.dependencies },
      { key: 'ai_context', value: request.aiContext },
    ];
    for (const { key, value } of textFields) {
      if (value) {
        await this.issueRepository.updateTaskField(issue.number, key, value, 'text');
        fieldsSet.push(key);
      }
    }

    // 5. Set optional single-select fields (resolve key → option ID)
    const selectFields = [
      { key: 'effort', optionKey: request.effort, options: this.projectConfig.effort_options },
      { key: 'risk_level', optionKey: request.riskLevel, options: this.projectConfig.risk_level_options },
      { key: 'ai_suitability', optionKey: request.aiSuitability, options: this.projectConfig.ai_suitability_options },
      { key: 'task_type', optionKey: request.taskType, options: this.projectConfig.task_type_options },
    ];
    for (const { key, optionKey, options } of selectFields) {
      if (optionKey && options?.[optionKey]) {
        await this.issueRepository.updateTaskField(issue.number, key, options[optionKey]!.id, 'singleSelect');
        fieldsSet.push(key);
      }
    }

    // 6. Emit event
    this.eventBus.emit({
      type: 'task.transition',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      actor: request.actor,
      issueNumber: issue.number,
      fromStatus: '',
      toStatus: statusKey,
      transition: 'create' as TransitionType,
      dryRun: false,
    });

    return {
      success: true,
      data: {
        issueNumber: issue.number,
        issueId: issue.id,
        itemId,
        url: issue.url,
        title: request.title,
        status: statusKey,
        fieldsSet,
      },
      suggestions: this.suggestionService.generatePostCreateSuggestions(issue.number),
      warnings: [],
    };
  }

  async executeTransition(
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
