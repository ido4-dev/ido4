import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

/** Validates that backward (return) transitions follow allowed paths. */
export class BackwardTransitionValidation implements ValidationStep {
  readonly name = 'BackwardTransitionValidation';

  private static readonly VALID_RETURN_PATHS: ReadonlyMap<string, string> = new Map([
    [WORKFLOW_STATUSES.READY_FOR_DEV, WORKFLOW_STATUSES.IN_REFINEMENT],
    [WORKFLOW_STATUSES.IN_PROGRESS, WORKFLOW_STATUSES.READY_FOR_DEV],
    [WORKFLOW_STATUSES.IN_REVIEW, WORKFLOW_STATUSES.IN_PROGRESS],
  ]);

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const returnTarget = BackwardTransitionValidation.VALID_RETURN_PATHS.get(context.task.status);

    if (!returnTarget) {
      const validSources = [...BackwardTransitionValidation.VALID_RETURN_PATHS.keys()].join(', ');
      return {
        stepName: this.name,
        passed: false,
        message: `Cannot return task from "${context.task.status}". Return is only available from: ${validSources}`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `Task can be returned from "${context.task.status}" to "${returnTarget}"`,
      severity: 'info',
      details: { from: context.task.status, to: returnTarget },
    };
  }
}
