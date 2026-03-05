import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class TaskAlreadyCompletedValidation implements ValidationStep {
  readonly name = 'TaskAlreadyCompletedValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.DONE) {
      return {
        stepName: this.name,
        passed: false,
        message: `Task #${context.issueNumber} is already in "${WORKFLOW_STATUSES.DONE}" status and cannot be modified`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Task is not completed',
      severity: 'info',
    };
  }
}
