import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

/** For the 'complete' transition — validates task is already Done. */
export class StatusAlreadyDoneValidation implements ValidationStep {
  readonly name = 'StatusAlreadyDoneValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.DONE) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task is in Done status',
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Task #${context.issueNumber} is not in "${WORKFLOW_STATUSES.DONE}" status (current: "${context.task.status}"). Use the approve command to complete a task.`,
      severity: 'error',
    };
  }
}
