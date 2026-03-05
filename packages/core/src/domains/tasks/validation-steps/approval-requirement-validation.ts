import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class ApprovalRequirementValidation implements ValidationStep {
  readonly name = 'ApprovalRequirementValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    // High-risk tasks require explicit review
    if (context.task.riskLevel === 'High') {
      return {
        stepName: this.name,
        passed: true,
        message: 'High-risk task — ensure thorough review has been completed before approval',
        severity: 'warning',
        details: { riskLevel: context.task.riskLevel },
      };
    }

    // AI-reviewed tasks need human sign-off
    if (context.task.aiSuitability === 'ai-reviewed' || context.task.aiSuitability === 'hybrid') {
      return {
        stepName: this.name,
        passed: true,
        message: `Task classified as "${context.task.aiSuitability}" — human review is recommended before approval`,
        severity: 'warning',
        details: { aiSuitability: context.task.aiSuitability },
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'No special approval requirements',
      severity: 'info',
    };
  }
}
