import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class EffortEstimationValidation implements ValidationStep {
  readonly name = 'EffortEstimationValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (context.task.effort && context.task.effort.trim() !== '') {
      return {
        stepName: this.name,
        passed: true,
        message: `Effort estimated as "${context.task.effort}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: 'Effort estimation is missing. Set the Effort field (Small, Medium, or Large).',
      severity: 'warning',
    };
  }
}
