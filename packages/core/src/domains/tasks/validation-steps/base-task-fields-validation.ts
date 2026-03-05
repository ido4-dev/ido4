import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class BaseTaskFieldsValidation implements ValidationStep {
  readonly name = 'BaseTaskFieldsValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const issues: string[] = [];

    if (!context.task.title || context.task.title.trim() === '') {
      issues.push('Task title is missing');
    }

    if (!context.task.body || context.task.body.trim() === '') {
      issues.push('Task description is missing');
    }

    if (issues.length > 0) {
      return {
        stepName: this.name,
        passed: false,
        message: `Missing required fields: ${issues.join(', ')}`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Required fields are present',
      severity: 'info',
    };
  }
}
