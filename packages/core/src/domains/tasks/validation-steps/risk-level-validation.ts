import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class RiskLevelValidation implements ValidationStep {
  readonly name = 'RiskLevelValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const risk = context.task.riskLevel;

    if (!risk) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Risk level not specified. Consider assessing task risk.',
        severity: 'warning',
      };
    }

    switch (risk) {
      case 'High':
        return {
          stepName: this.name,
          passed: true,
          message: 'High-risk task — extra review and testing recommended',
          severity: 'warning',
          details: { riskLevel: risk },
        };

      case 'Medium':
        return {
          stepName: this.name,
          passed: true,
          message: 'Medium-risk task — standard review process applies',
          severity: 'info',
          details: { riskLevel: risk },
        };

      case 'Low':
        return {
          stepName: this.name,
          passed: true,
          message: 'Low-risk task',
          severity: 'info',
          details: { riskLevel: risk },
        };

      default:
        return {
          stepName: this.name,
          passed: true,
          message: `Unknown risk level: "${risk}"`,
          severity: 'warning',
        };
    }
  }
}
