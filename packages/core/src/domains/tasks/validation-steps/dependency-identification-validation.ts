import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class DependencyIdentificationValidation implements ValidationStep {
  readonly name = 'DependencyIdentificationValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const deps = context.task.dependencies;

    if (!deps || deps.trim() === '') {
      return {
        stepName: this.name,
        passed: false,
        message: 'Dependencies field is empty. Explicitly set dependencies or mark as "No dependencies".',
        severity: 'warning',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `Dependencies identified: "${deps}"`,
      severity: 'info',
    };
  }
}
