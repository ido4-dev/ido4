/**
 * CircuitBreakerValidation — Time-aware enforcement for timeboxed containers.
 *
 * Param: container type ID (e.g., 'cycle').
 * When the container's timebox has expired, only closing transitions are allowed.
 *
 * Requires:
 *   - containerMetadataService in StepDependencies (for start date lookup)
 *   - durationWeeks on the container type definition (for timebox length)
 *   - closingTransitions in profile.behaviors (for allowed terminal actions)
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { StepDependencies } from '../validation-step-registry.js';

export class CircuitBreakerValidation implements ValidationStep {
  readonly name = 'CircuitBreakerValidation';
  private readonly containerTypeId: string;

  constructor(
    param: string,
    private readonly deps: StepDependencies,
  ) {
    this.containerTypeId = param;
  }

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const { profile, containerMetadataService } = this.deps;

    if (!containerMetadataService) {
      return {
        stepName: this.name,
        passed: true,
        message: 'No container metadata service available — circuit breaker check skipped',
        severity: 'info',
      };
    }

    // Find the container type definition
    const containerDef = profile.containers.find((c) => c.id === this.containerTypeId);
    if (!containerDef || !containerDef.durationWeeks) {
      return {
        stepName: this.name,
        passed: true,
        message: `Container type "${this.containerTypeId}" has no duration configured — circuit breaker skipped`,
        severity: 'info',
      };
    }

    // Get the task's container value for this container type
    const containerName = context.task.containers[containerDef.taskField] ?? context.task.containers[this.containerTypeId];
    if (!containerName) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task #${context.issueNumber} not assigned to a ${containerDef.singular} — circuit breaker skipped`,
        severity: 'info',
      };
    }

    // Get metadata for the container
    const metadata = await containerMetadataService.getContainerMetadata(containerName);
    if (!metadata) {
      return {
        stepName: this.name,
        passed: true,
        message: `No metadata found for ${containerDef.singular} "${containerName}" — circuit breaker skipped`,
        severity: 'info',
      };
    }

    // Check if the timebox has expired
    const startDate = new Date(metadata.startDate);
    const expirationDate = new Date(startDate.getTime() + containerDef.durationWeeks * 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now <= expirationDate) {
      return {
        stepName: this.name,
        passed: true,
        message: `${containerDef.singular} "${containerName}" is within its ${containerDef.durationWeeks}-week timebox (expires ${expirationDate.toISOString()})`,
        severity: 'info',
      };
    }

    // Timebox has expired — only closing transitions are allowed
    const closingTransitions = profile.behaviors.closingTransitions;
    const transition = typeof context.transition === 'string' ? context.transition : '';

    if (closingTransitions.includes(transition)) {
      return {
        stepName: this.name,
        passed: true,
        message: `${containerDef.singular} "${containerName}" timebox expired, but "${transition}" is a closing transition — allowed`,
        severity: 'info',
      };
    }

    // Non-closing transition after timebox expiration — BLOCK
    return {
      stepName: this.name,
      passed: false,
      message: `Circuit breaker: ${containerDef.singular} "${containerName}" timebox expired on ${expirationDate.toISOString()}. Only closing transitions (${closingTransitions.join(', ')}) are allowed. Current transition "${transition}" is blocked.`,
      severity: 'error',
    };
  }
}
