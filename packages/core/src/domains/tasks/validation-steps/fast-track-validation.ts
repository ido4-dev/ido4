import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import { WORKFLOW_STATUSES } from '../types.js';

/** Validates whether a fast-track from Backlog → Ready for Dev is appropriate. */
export class FastTrackValidation implements ValidationStep {
  readonly name = 'FastTrackValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    // Fast-track only relevant when coming from Backlog (skipping In Refinement)
    if (context.task.status !== WORKFLOW_STATUSES.BACKLOG) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Not a fast-track transition',
        severity: 'info',
      };
    }

    // Fast-track is appropriate for small/low-effort tasks
    const effort = context.task.effort?.toLowerCase();
    if (effort === 'small' || effort === 'low') {
      return {
        stepName: this.name,
        passed: true,
        message: `Fast-track approved for ${effort}-effort task`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Fast-tracking from Backlog directly to Ready for Dev. Consider refinement for complex tasks.',
      severity: 'warning',
    };
  }
}
