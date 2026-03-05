import { describe, it, expect } from 'vitest';
import { StatusTransitionValidation } from '../../../../src/domains/tasks/validation-steps/status-transition-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../../helpers/mock-factories.js';

function makeContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData({ status: 'Ready for Dev' }),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
    ...overrides,
  };
}

describe('StatusTransitionValidation', () => {
  it('passes for valid transition', async () => {
    const step = new StatusTransitionValidation('IN_PROGRESS');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'Ready for Dev' }) }));
    expect(result.passed).toBe(true);
  });

  it('fails for invalid transition', async () => {
    const step = new StatusTransitionValidation('IN_PROGRESS');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'Backlog' }) }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('Cannot transition');
  });

  it('includes valid transitions in failure message', async () => {
    const step = new StatusTransitionValidation('DONE');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'Backlog' }) }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('In Refinement');
  });

  it('fails for unknown target status key', async () => {
    const step = new StatusTransitionValidation('NONEXISTENT');
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown target status key');
  });

  it('passes Ready for Dev → In Progress', async () => {
    const step = new StatusTransitionValidation('IN_PROGRESS');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'Ready for Dev' }) }));
    expect(result.passed).toBe(true);
  });

  it('passes In Progress → In Review', async () => {
    const step = new StatusTransitionValidation('IN_REVIEW');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'In Progress' }) }));
    expect(result.passed).toBe(true);
  });

  it('passes In Review → Done', async () => {
    const step = new StatusTransitionValidation('DONE');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'In Review' }) }));
    expect(result.passed).toBe(true);
  });

  it('passes any status → Blocked', async () => {
    const step = new StatusTransitionValidation('BLOCKED');
    const result = await step.validate(makeContext({ task: createMockTaskData({ status: 'In Progress' }) }));
    expect(result.passed).toBe(true);
  });
});
