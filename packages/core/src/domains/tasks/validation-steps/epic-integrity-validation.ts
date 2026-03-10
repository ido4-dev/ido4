import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IIntegrityValidator } from '../../../container/interfaces.js';

export class EpicIntegrityValidation implements ValidationStep {
  readonly name = 'EpicIntegrityValidation';

  constructor(private readonly integrityValidator: IIntegrityValidator) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const epic = context.task.containers['epic'];
    const wave = context.task.containers['wave'];

    if (!epic) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task has no epic assignment — epic integrity check not applicable',
        severity: 'info',
      };
    }

    if (!wave) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task has no wave assignment — epic integrity cannot be verified yet',
        severity: 'info',
      };
    }

    const result = await this.integrityValidator.validateAssignmentIntegrity(
      context.issueNumber,
      wave,
    );

    if (result.maintained) {
      return {
        stepName: this.name,
        passed: true,
        message: `Epic integrity maintained for "${epic}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Epic integrity violation: ${result.violations.join('; ')}`,
      severity: 'error',
      details: { epicName: epic, violations: result.violations },
    };
  }
}
