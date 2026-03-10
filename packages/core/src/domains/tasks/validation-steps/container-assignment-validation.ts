/**
 * ContainerAssignmentValidation — Generic parameterized container assignment check.
 *
 * Replaces: WaveAssignmentValidation (when used in profile-driven pipelines).
 *
 * Param: container type ID (e.g., 'wave').
 * Checks that the task has a value in containers[containerType].
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

export class ContainerAssignmentValidation implements ValidationStep {
  readonly name = 'ContainerAssignmentValidation';
  private readonly containerType: string;

  constructor(param: string) {
    this.containerType = param;
  }

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const value = context.task.containers[this.containerType];

    if (value && value.trim() !== '') {
      return {
        stepName: this.name,
        passed: true,
        message: `Task assigned to ${this.containerType} "${value}"`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: false,
      message: `Task must be assigned to a ${this.containerType} before this transition. Use the assign_task_to_container tool.`,
      severity: 'error',
    };
  }
}
