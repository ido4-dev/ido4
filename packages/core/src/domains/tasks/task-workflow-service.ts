/**
 * TaskWorkflowService — Executes task state transitions.
 *
 * Single executeTransition() replaces 8 near-identical methods from CLI.
 * Returns raw WorkflowTransitionResult — no ToolResponse, no events, no suggestions.
 * The TaskService facade handles those concerns.
 */

import type {
  IIssueRepository,
  IWorkflowConfig,
  ITaskTransitionValidator,
  TaskTransitionRequest,
  BlockTaskRequest,
  ReturnTaskRequest,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { TransitionType, ValidationResult } from './types.js';

export interface WorkflowTransitionResult {
  issueNumber: number;
  fromStatus: string;
  toStatus: string;
  transition: TransitionType;
  validationResult: ValidationResult;
  executed: boolean;
}

export class TaskWorkflowService {
  constructor(
    private readonly issueRepository: IIssueRepository,
    private readonly transitionValidator: ITaskTransitionValidator,
    private readonly workflowConfig: IWorkflowConfig,
    private readonly logger: ILogger,
  ) {}

  async executeTransition(
    transition: TransitionType,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
  ): Promise<WorkflowTransitionResult> {
    const { issueNumber, skipValidation, dryRun } = request;

    // Phase 1: Validate
    let validationResult: ValidationResult;
    if (skipValidation) {
      validationResult = {
        canProceed: true,
        transition,
        reason: 'Validation skipped',
        details: [],
        suggestions: [],
        metadata: { skipped: true },
      };
    } else {
      validationResult = await this.transitionValidator.validateTransition(issueNumber, transition);
    }

    // Fetch current task for fromStatus
    const task = await this.issueRepository.getTask(issueNumber);
    const fromStatus = task.status;
    const toStatus = this.getTargetStatus(transition, request);

    if (!validationResult.canProceed) {
      this.logger.debug('Transition blocked by validation', {
        issueNumber,
        transition,
        fromStatus,
        toStatus,
        reason: validationResult.reason,
      });
      return {
        issueNumber,
        fromStatus,
        toStatus,
        transition,
        validationResult,
        executed: false,
      };
    }

    // Phase 2: Dry run check
    if (dryRun) {
      this.logger.debug('Dry run — skipping execution', { issueNumber, transition });
      return {
        issueNumber,
        fromStatus,
        toStatus,
        transition,
        validationResult,
        executed: false,
      };
    }

    // Phase 3: Execute
    await this.issueRepository.updateTaskStatus(issueNumber, this.getTargetStatusKey(transition, request));

    if (request.message) {
      await this.issueRepository.addComment(issueNumber, request.message);
    }

    // Block reason as comment
    if (transition === 'block' && 'reason' in request) {
      await this.issueRepository.addComment(issueNumber, `Blocked: ${(request as BlockTaskRequest).reason}`);
    }

    // Return reason as comment
    if (transition === 'return' && 'reason' in request) {
      await this.issueRepository.addComment(issueNumber, `Returned: ${(request as ReturnTaskRequest).reason}`);
    }

    // Close issue on approve
    if (transition === 'approve') {
      await this.issueRepository.closeIssue(issueNumber);
    }

    this.logger.info('Transition executed', {
      issueNumber,
      transition,
      fromStatus,
      toStatus,
    });

    return {
      issueNumber,
      fromStatus,
      toStatus,
      transition,
      validationResult,
      executed: true,
    };
  }

  private getTargetStatus(transition: TransitionType, request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest): string {
    if (transition === 'return' && 'targetStatus' in request) {
      return (request as ReturnTaskRequest).targetStatus;
    }
    const key = this.getTargetStatusKey(transition, request);
    return this.workflowConfig.getStatusName(key);
  }

  private getTargetStatusKey(transition: TransitionType, request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest): string {
    switch (transition) {
      case 'refine': return 'IN_REFINEMENT';
      case 'ready': return 'READY_FOR_DEV';
      case 'start': return 'IN_PROGRESS';
      case 'review': return 'IN_REVIEW';
      case 'approve': return 'DONE';
      case 'complete': return 'DONE';
      case 'block': return 'BLOCKED';
      case 'unblock': return 'READY_FOR_DEV';
      case 'return': {
        // For return, we need to find the status key from the target status name
        if ('targetStatus' in request) {
          const targetName = (request as ReturnTaskRequest).targetStatus;
          const allStatuses = this.workflowConfig.getAllStatusValues();
          for (const [key, name] of Object.entries(allStatuses)) {
            if (name === targetName) return key;
          }
        }
        return 'READY_FOR_DEV';
      }
    }
  }
}
