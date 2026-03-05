import { describe, it, expect } from 'vitest';
import { TaskAlreadyCompletedValidation } from '../../../../src/domains/tasks/validation-steps/task-already-completed-validation.js';
import { TaskAlreadyBlockedValidation } from '../../../../src/domains/tasks/validation-steps/task-already-blocked-validation.js';
import { TaskNotBlockedValidation } from '../../../../src/domains/tasks/validation-steps/task-not-blocked-validation.js';
import { TaskBlockedValidation } from '../../../../src/domains/tasks/validation-steps/task-blocked-validation.js';
import { StatusAlreadyDoneValidation } from '../../../../src/domains/tasks/validation-steps/status-already-done-validation.js';
import { BackwardTransitionValidation } from '../../../../src/domains/tasks/validation-steps/backward-transition-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../../helpers/mock-factories.js';

function makeContext(status: string): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'block',
    task: createMockTaskData({ status }),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

describe('TaskAlreadyCompletedValidation', () => {
  const step = new TaskAlreadyCompletedValidation();

  it('fails when task is Done', async () => {
    const result = await step.validate(makeContext('Done'));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('passes when task is not Done', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(true);
  });
});

describe('TaskAlreadyBlockedValidation', () => {
  const step = new TaskAlreadyBlockedValidation();

  it('fails when task is Blocked', async () => {
    const result = await step.validate(makeContext('Blocked'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('unblock');
  });

  it('passes when task is not Blocked', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(true);
  });
});

describe('TaskNotBlockedValidation', () => {
  const step = new TaskNotBlockedValidation();

  it('fails when task is NOT Blocked', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not blocked');
  });

  it('passes when task IS Blocked', async () => {
    const result = await step.validate(makeContext('Blocked'));
    expect(result.passed).toBe(true);
  });
});

describe('TaskBlockedValidation', () => {
  const step = new TaskBlockedValidation();

  it('fails when task is Blocked (for return transition)', async () => {
    const result = await step.validate(makeContext('Blocked'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('unblock');
  });

  it('passes when task is not Blocked', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(true);
  });
});

describe('StatusAlreadyDoneValidation', () => {
  const step = new StatusAlreadyDoneValidation();

  it('passes when task is Done', async () => {
    const result = await step.validate(makeContext('Done'));
    expect(result.passed).toBe(true);
  });

  it('fails when task is not Done', async () => {
    const result = await step.validate(makeContext('In Review'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('approve');
  });
});

describe('BackwardTransitionValidation', () => {
  const step = new BackwardTransitionValidation();

  it('passes for Ready for Dev (returns to In Refinement)', async () => {
    const result = await step.validate(makeContext('Ready for Dev'));
    expect(result.passed).toBe(true);
    expect(result.details?.to).toBe('In Refinement');
  });

  it('passes for In Progress (returns to Ready for Dev)', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(true);
  });

  it('passes for In Review (returns to In Progress)', async () => {
    const result = await step.validate(makeContext('In Review'));
    expect(result.passed).toBe(true);
  });

  it('fails for Backlog (no return path)', async () => {
    const result = await step.validate(makeContext('Backlog'));
    expect(result.passed).toBe(false);
  });

  it('fails for Done (no return path)', async () => {
    const result = await step.validate(makeContext('Done'));
    expect(result.passed).toBe(false);
  });
});
