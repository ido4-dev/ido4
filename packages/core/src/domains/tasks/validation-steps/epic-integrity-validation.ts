import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IEpicValidator } from '../../../container/interfaces.js';

export class EpicIntegrityValidation implements ValidationStep {
  readonly name = 'EpicIntegrityValidation';

  constructor(private readonly epicValidator: IEpicValidator) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    if (!context.task.epic) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task has no epic assignment — epic integrity check not applicable',
        severity: 'info',
      };
    }

    if (!context.task.wave) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task has no wave assignment — epic integrity cannot be verified yet',
        severity: 'info',
      };
    }

    const result = await this.epicValidator.validateWaveAssignmentEpicIntegrity(
      context.issueNumber,
      context.task.wave,
    );

    if (result.maintained) {
      return {
        stepName: this.name,
        passed: true,
        message: `Epic integrity maintained for "${context.task.epic}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Epic integrity violation: ${result.violations.join('; ')}`,
      severity: 'error',
      details: { epicName: context.task.epic, violations: result.violations },
    };
  }
}
