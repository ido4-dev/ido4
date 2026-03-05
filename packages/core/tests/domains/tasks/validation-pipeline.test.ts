import { describe, it, expect, vi } from 'vitest';
import { ValidationPipeline } from '../../../src/domains/tasks/validation-pipeline.js';
import type { ValidationStep, ValidationStepResult, ValidationContext } from '../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../helpers/mock-factories.js';

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData(),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
    ...overrides,
  };
}

function makeStep(name: string, result: Partial<ValidationStepResult>): ValidationStep {
  return {
    name,
    validate: vi.fn().mockResolvedValue({
      stepName: name,
      passed: true,
      message: 'OK',
      severity: 'info',
      ...result,
    }),
  };
}

function makeThrowingStep(name: string, error: Error): ValidationStep {
  return {
    name,
    validate: vi.fn().mockRejectedValue(error),
  };
}

describe('ValidationPipeline', () => {
  it('returns canProceed=true for empty pipeline', async () => {
    const pipeline = new ValidationPipeline();
    const result = await pipeline.execute(makeContext());
    expect(result.canProceed).toBe(true);
    expect(result.details).toHaveLength(0);
  });

  it('returns canProceed=true when all steps pass', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: true }))
      .addStep(makeStep('B', { passed: true }));

    const result = await pipeline.execute(makeContext());
    expect(result.canProceed).toBe(true);
    expect(result.details).toHaveLength(2);
  });

  it('returns canProceed=false when an error step fails', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: true }))
      .addStep(makeStep('B', { passed: false, severity: 'error' }));

    const result = await pipeline.execute(makeContext());
    expect(result.canProceed).toBe(false);
  });

  it('does NOT block on warning-severity failures', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: false, severity: 'warning' }));

    const result = await pipeline.execute(makeContext());
    expect(result.canProceed).toBe(true);
  });

  it('executes ALL steps even after failure (fail-safe)', async () => {
    const stepA = makeStep('A', { passed: false, severity: 'error' });
    const stepB = makeStep('B', { passed: true });

    const pipeline = new ValidationPipeline().addStep(stepA).addStep(stepB);
    const result = await pipeline.execute(makeContext());

    expect(stepA.validate).toHaveBeenCalled();
    expect(stepB.validate).toHaveBeenCalled();
    expect(result.details).toHaveLength(2);
  });

  it('catches step exceptions and adds error result', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeThrowingStep('Broken', new Error('Kaboom')))
      .addStep(makeStep('After', { passed: true }));

    const result = await pipeline.execute(makeContext());
    expect(result.canProceed).toBe(false);
    expect(result.details).toHaveLength(2);
    expect(result.details[0]!.stepName).toBe('Broken');
    expect(result.details[0]!.passed).toBe(false);
    expect(result.details[0]!.message).toContain('Kaboom');
    // Second step still runs
    expect(result.details[1]!.stepName).toBe('After');
    expect(result.details[1]!.passed).toBe(true);
  });

  it('aggregates suggestions from failed steps', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: false, severity: 'error', message: 'Fix A' }))
      .addStep(makeStep('B', { passed: false, severity: 'warning', message: 'Fix B' }));

    const result = await pipeline.execute(makeContext());
    expect(result.suggestions).toContain('Fix A');
    expect(result.suggestions).toContain('Fix B');
  });

  it('deduplicates suggestions', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: false, severity: 'error', message: 'Same message' }))
      .addStep(makeStep('B', { passed: false, severity: 'error', message: 'Same message' }));

    const result = await pipeline.execute(makeContext());
    expect(result.suggestions).toHaveLength(1);
  });

  it('includes metadata with step counts', async () => {
    const pipeline = new ValidationPipeline()
      .addStep(makeStep('A', { passed: true }))
      .addStep(makeStep('B', { passed: false, severity: 'error' }))
      .addStep(makeStep('C', { passed: false, severity: 'warning' }));

    const result = await pipeline.execute(makeContext());
    expect(result.metadata.totalSteps).toBe(3);
    expect(result.metadata.failedSteps).toBe(1);
    expect(result.metadata.warnedSteps).toBe(1);
  });

  it('sets transition type from context', async () => {
    const pipeline = new ValidationPipeline();
    const result = await pipeline.execute(makeContext({ transition: 'review' }));
    expect(result.transition).toBe('review');
  });

  it('passes context to each step', async () => {
    const step = makeStep('Check', { passed: true });
    const pipeline = new ValidationPipeline().addStep(step);
    const ctx = makeContext({ issueNumber: 99 });

    await pipeline.execute(ctx);
    expect(step.validate).toHaveBeenCalledWith(ctx);
  });
});
