/**
 * ValidationPipeline — Fail-safe composable validation executor.
 *
 * Executes ALL registered steps regardless of individual failures.
 * Aggregates results, tracks metadata, deduplicates suggestions.
 */

import type {
  ValidationStep,
  ValidationStepResult,
  ValidationResult,
  ValidationContext,
} from './types.js';

export class ValidationPipeline {
  private steps: ValidationStep[] = [];

  addStep(step: ValidationStep): this {
    this.steps.push(step);
    return this;
  }

  async execute(context: ValidationContext): Promise<ValidationResult> {
    const results: ValidationStepResult[] = [];
    let canProceed = true;
    const startTime = Date.now();

    for (const step of this.steps) {
      try {
        const stepResult = await step.validate(context);
        results.push(stepResult);
        if (!stepResult.passed && stepResult.severity === 'error') {
          canProceed = false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          stepName: step.name,
          passed: false,
          message: `Validation step "${step.name}" failed with error: ${message}`,
          severity: 'error',
        });
        canProceed = false;
      }
    }

    const failedSteps = results.filter((r) => !r.passed && r.severity === 'error').length;
    const warnedSteps = results.filter((r) => r.severity === 'warning').length;

    return {
      canProceed,
      transition: context.transition,
      reason: canProceed
        ? 'All validations passed'
        : `${failedSteps} validation(s) failed`,
      details: results,
      suggestions: this.aggregateSuggestions(results),
      metadata: {
        totalSteps: this.steps.length,
        failedSteps,
        warnedSteps,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  private aggregateSuggestions(results: ValidationStepResult[]): string[] {
    const suggestions = new Set<string>();
    for (const r of results) {
      if (!r.passed && r.message) {
        suggestions.add(r.message);
      }
    }
    return [...suggestions];
  }
}
