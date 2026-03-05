import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

/** Prevents returning a blocked task — use unblock instead. */
export class TaskBlockedValidation implements ValidationStep {
  readonly name = 'TaskBlockedValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.BLOCKED) {
      return {
        stepName: this.name,
        passed: false,
        message: `Task #${context.issueNumber} is blocked. Use the unblock command before returning it.`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Task is not blocked',
      severity: 'info',
    };
  }
}
