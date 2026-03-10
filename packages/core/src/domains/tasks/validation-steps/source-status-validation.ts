/**
 * SourceStatusValidation — Generic parameterized source-status guard.
 *
 * Replaces: RefineFromBacklogValidation, ReadyFromRefinementOrBacklogValidation,
 *           StartFromReadyForDevValidation.
 *
 * Param: comma-separated status keys (e.g., 'BACKLOG' or 'IN_REFINEMENT,BACKLOG').
 * Resolves keys to display names via workflowConfig.getStatusName().
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class SourceStatusValidation implements ValidationStep {
  readonly name = 'SourceStatusValidation';
  private readonly allowedKeys: string[];

  constructor(param: string) {
    this.allowedKeys = param.split(',').map((k) => k.trim());
  }

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const allowedNames = this.allowedKeys.map((key) => {
      const name = context.workflowConfig.getStatusName(key);
      return name || key; // Fall back to key if config doesn't resolve
    });

    if (allowedNames.includes(context.task.status)) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task is in "${context.task.status}", eligible for transition`,
        severity: 'info',
      };
    }

    const allowed = allowedNames.map((n) => `"${n}"`).join(' or ');
    return {
      stepName: this.name,
      passed: false,
      message: `This transition requires task to be in ${allowed} status. Current: "${context.task.status}".`,
      severity: 'error',
    };
  }
}
