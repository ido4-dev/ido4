import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class StartFromReadyForDevValidation implements ValidationStep {
  readonly name = 'StartFromReadyForDevValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.READY_FOR_DEV) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task is Ready for Dev, eligible to start',
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Start command requires task to be in "${WORKFLOW_STATUSES.READY_FOR_DEV}" status. Current: "${context.task.status}"`,
      severity: 'error',
    };
  }
}
