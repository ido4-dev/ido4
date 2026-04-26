/**
 * TaskWorkflowService — Executes task state transitions.
 *
 * Phase 3: Profile-driven. Uses WorkflowConfig semantic methods and profile behaviors
 * instead of hardcoded switch statements.
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
import type { MethodologyProfile } from '../../profiles/types.js';

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
    private readonly profile: MethodologyProfile,
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

    // Fetch current task for fromStatus (needed for both success and failure paths)
    const task = await this.issueRepository.getTask(issueNumber);
    const fromStatus = task.status;

    // Failed-validation path — do NOT compute toStatus.
    //
    // toStatus computation depends on the transition being valid for the
    // current state. For never-valid invocations (e.g., `complete_task` on
    // an IN_PROGRESS task in Hydro, where `complete` is DONE→DONE-only),
    // computing toStatus throws "Unknown status key: <action>" because the
    // fallback at getTargetStatusKey returns the action name as a status
    // key. By short-circuiting here we return a clean validation-failure
    // response with toStatus === fromStatus (no movement attempted).
    if (!validationResult.canProceed) {
      this.logger.debug('Transition blocked by validation', {
        issueNumber,
        transition,
        fromStatus,
        reason: validationResult.reason,
      });
      return {
        issueNumber,
        fromStatus,
        toStatus: fromStatus,
        transition,
        validationResult,
        executed: false,
      };
    }

    // Validation passed — safe to compute toStatus.
    const toStatus = this.getTargetStatus(transition, fromStatus, request);

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
    await this.issueRepository.updateTaskStatus(issueNumber, this.getTargetStatusKey(transition, fromStatus, request));

    if (request.message) {
      await this.issueRepository.addComment(issueNumber, request.message);
    }

    // Block reason as comment
    if (this.isBlockTransition(transition) && 'reason' in request) {
      await this.issueRepository.addComment(issueNumber, `Blocked: ${(request as BlockTaskRequest).reason}`);
    }

    // Return reason as comment
    if (this.isReturnTransition(transition) && 'reason' in request) {
      await this.issueRepository.addComment(issueNumber, `Returned: ${(request as ReturnTaskRequest).reason}`);
    }

    // Close issue on closing transitions
    if (this.isClosingTransition(transition)) {
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

  private getTargetStatus(
    transition: TransitionType,
    fromStatus: string,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
  ): string {
    if (this.isReturnTransition(transition) && 'targetStatus' in request) {
      return (request as ReturnTaskRequest).targetStatus;
    }
    const key = this.getTargetStatusKey(transition, fromStatus, request);
    return this.workflowConfig.getStatusName(key);
  }

  private getTargetStatusKey(
    transition: TransitionType,
    fromStatus: string,
    request: TaskTransitionRequest | BlockTaskRequest | ReturnTaskRequest,
  ): string {
    // Return transition: caller specifies target via request
    if (this.isReturnTransition(transition) && 'targetStatus' in request) {
      const targetName = (request as ReturnTaskRequest).targetStatus;
      const key = this.workflowConfig.getStatusKey(targetName);
      if (key) return key;
    }

    // All other transitions: look up from profile via WorkflowConfig
    const fromKey = this.workflowConfig.getStatusKey(fromStatus);
    if (fromKey) {
      const toKey = this.workflowConfig.getTargetStateKey(fromKey, transition);
      if (toKey) return toKey;
    }

    // Fallback (shouldn't happen for valid transitions)
    return transition;
  }

  private isBlockTransition(transition: string): boolean {
    return this.profile.behaviors.blockTransition === transition;
  }

  private isReturnTransition(transition: string): boolean {
    return this.profile.behaviors.returnTransition === transition;
  }

  private isClosingTransition(transition: string): boolean {
    return this.profile.behaviors.closingTransitions.includes(transition);
  }
}
