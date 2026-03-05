import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class AISuitabilityValidation implements ValidationStep {
  readonly name = 'AISuitabilityValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const suitability = context.task.aiSuitability;

    if (!suitability) {
      return {
        stepName: this.name,
        passed: true,
        message: 'AI suitability not specified. Consider classifying this task.',
        severity: 'warning',
      };
    }

    switch (suitability.toLowerCase()) {
      case 'human-only':
        return {
          stepName: this.name,
          passed: false,
          message: 'Task is classified as "human-only" and cannot be started by an AI agent',
          severity: 'error',
        };

      case 'ai-only':
        return {
          stepName: this.name,
          passed: true,
          message: 'Task is classified as "ai-only" — fully suitable for AI implementation',
          severity: 'info',
        };

      case 'ai-reviewed':
        return {
          stepName: this.name,
          passed: true,
          message: 'Task is classified as "ai-reviewed" — AI can implement but human review is required',
          severity: 'warning',
        };

      case 'hybrid':
        return {
          stepName: this.name,
          passed: true,
          message: 'Task is classified as "hybrid" — requires AI-human collaboration',
          severity: 'warning',
        };

      default:
        return {
          stepName: this.name,
          passed: true,
          message: `Unknown AI suitability classification: "${suitability}"`,
          severity: 'warning',
        };
    }
  }
}
