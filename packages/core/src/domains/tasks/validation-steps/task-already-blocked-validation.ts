import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class TaskAlreadyBlockedValidation implements ValidationStep {
  readonly name = 'TaskAlreadyBlockedValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.BLOCKED) {
      return {
        stepName: this.name,
        passed: false,
        message: `Task #${context.issueNumber} is already "${WORKFLOW_STATUSES.BLOCKED}". Use the unblock command to unblock it.`,
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
