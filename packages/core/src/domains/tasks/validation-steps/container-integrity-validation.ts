/**
 * ContainerIntegrityValidation — Generic parameterized integrity rule check.
 *
 * Replaces: EpicIntegrityValidation (when used in profile-driven pipelines).
 *
 * Param: integrity rule ID (e.g., 'epic-wave-integrity').
 * Reads the rule from deps.profile, delegates to the integrity validator.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { StepDependencies } from '../validation-step-registry.js';

export class ContainerIntegrityValidation implements ValidationStep {
  readonly name = 'ContainerIntegrityValidation';
  private readonly ruleId: string;

  constructor(
    param: string,
    private readonly deps: StepDependencies,
  ) {
    this.ruleId = param;
  }

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const profile = this.deps.profile;
    if (!profile) {
      return {
        stepName: this.name,
        passed: true,
        message: 'No methodology profile configured — integrity check skipped',
        severity: 'info',
      };
    }

    const rule = profile.integrityRules.find((r) => r.id === this.ruleId);
    if (!rule) {
      return {
        stepName: this.name,
        passed: true,
        message: `Integrity rule "${this.ruleId}" not found in profile — check skipped`,
        severity: 'info',
      };
    }

    if (rule.type !== 'same-container') {
      return {
        stepName: this.name,
        passed: true,
        message: `Integrity rule "${this.ruleId}" is type "${rule.type}" — not handled by this step`,
        severity: 'info',
      };
    }

    const groupByValue = context.task.containers[rule.groupBy];
    if (!groupByValue) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task has no ${rule.groupBy} assignment — integrity check not applicable`,
        severity: 'info',
      };
    }

    const mustMatchValue = context.task.containers[rule.mustMatch];
    if (!mustMatchValue) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task has no ${rule.mustMatch} assignment — integrity cannot be verified yet`,
        severity: 'info',
      };
    }

    const result = await this.deps.integrityValidator.validateAssignmentIntegrity(
      context.issueNumber,
      mustMatchValue,
    );

    if (result.maintained) {
      return {
        stepName: this.name,
        passed: true,
        message: `Integrity maintained for ${rule.groupBy} "${groupByValue}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Integrity violation (${this.ruleId}): ${result.violations.join('; ')}`,
      severity: rule.severity === 'error' ? 'error' : 'warning',
      details: { ruleId: this.ruleId, groupBy: groupByValue, violations: result.violations },
    };
  }
}
