/**
 * StatusTransitionValidation — Validates that the workflow graph allows this transition.
 *
 * Takes a target status key (e.g., 'IN_PROGRESS') in the constructor.
 * Reads workflowConfig from ValidationContext to check the edge exists.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class StatusTransitionValidation implements ValidationStep {
  readonly name = 'StatusTransitionValidation';

  constructor(private readonly targetStatusKey: string) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const targetStatus = context.workflowConfig.getStatusName(this.targetStatusKey);
    if (!targetStatus) {
      return {
        stepName: this.name,
        passed: false,
        message: `Unknown target status key: ${this.targetStatusKey}`,
        severity: 'error',
      };
    }

    const isValid = context.workflowConfig.isValidTransition(context.task.status, targetStatus);
    if (isValid) {
      return {
        stepName: this.name,
        passed: true,
        message: `Transition from "${context.task.status}" to "${targetStatus}" is valid`,
        severity: 'info',
      };
    }

    const validNext = context.workflowConfig.getValidNextTransitions(context.task.status);
    return {
      stepName: this.name,
      passed: false,
      message: `Cannot transition from "${context.task.status}" to "${targetStatus}". Valid transitions: ${validNext.join(', ') || 'none'}`,
      severity: 'error',
      details: { currentStatus: context.task.status, targetStatus, validTransitions: validNext },
    };
  }
}
