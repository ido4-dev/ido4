import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class TaskNotBlockedValidation implements ValidationStep {
  readonly name = 'TaskNotBlockedValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status !== WORKFLOW_STATUSES.BLOCKED) {
      return {
        stepName: this.name,
        passed: false,
        message: `Task #${context.issueNumber} is not blocked (status: "${context.task.status}"). Only blocked tasks can be unblocked.`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Task is blocked and eligible for unblocking',
      severity: 'info',
    };
  }
}
