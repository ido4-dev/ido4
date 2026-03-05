import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class RefineFromBacklogValidation implements ValidationStep {
  readonly name = 'RefineFromBacklogValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.status === WORKFLOW_STATUSES.BACKLOG) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task is in Backlog, eligible for refinement',
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Refine command requires task to be in "${WORKFLOW_STATUSES.BACKLOG}" status. Current: "${context.task.status}". Use the return command for backward transitions.`,
      severity: 'error',
    };
  }
}
