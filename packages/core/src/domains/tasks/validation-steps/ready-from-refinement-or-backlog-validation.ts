import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

export class ReadyFromRefinementOrBacklogValidation implements ValidationStep {
  readonly name = 'ReadyFromRefinementOrBacklogValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const allowed = [WORKFLOW_STATUSES.IN_REFINEMENT, WORKFLOW_STATUSES.BACKLOG];

    if (allowed.includes(context.task.status as (typeof allowed)[number])) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task is in "${context.task.status}", eligible for ready`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Ready command requires task to be in "${WORKFLOW_STATUSES.IN_REFINEMENT}" or "${WORKFLOW_STATUSES.BACKLOG}" status. Current: "${context.task.status}"`,
      severity: 'error',
    };
  }
}
