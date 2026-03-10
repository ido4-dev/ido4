import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class WaveAssignmentValidation implements ValidationStep {
  readonly name = 'WaveAssignmentValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const wave = context.task.containers['wave'];
    if (wave && wave.trim() !== '') {
      return {
        stepName: this.name,
        passed: true,
        message: `Task assigned to wave "${wave}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: 'Task must be assigned to a wave before starting. Use the assign_wave tool.',
      severity: 'error',
    };
  }
}
