import { describe, it, expect } from 'vitest';
import { RefineFromBacklogValidation } from '../../../../src/domains/tasks/validation-steps/refine-from-backlog-validation.js';
import { ReadyFromRefinementOrBacklogValidation } from '../../../../src/domains/tasks/validation-steps/ready-from-refinement-or-backlog-validation.js';
import { StartFromReadyForDevValidation } from '../../../../src/domains/tasks/validation-steps/start-from-ready-for-dev-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../../helpers/mock-factories.js';

function makeContext(status: string): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData({ status }),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

describe('RefineFromBacklogValidation', () => {
  const step = new RefineFromBacklogValidation();

  it('passes when task is in Backlog', async () => {
    const result = await step.validate(makeContext('Backlog'));
    expect(result.passed).toBe(true);
  });

  it('fails when task is In Progress', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Backlog');
    expect(result.message).toContain('return command');
  });

  it('fails when task is In Refinement', async () => {
    const result = await step.validate(makeContext('In Refinement'));
    expect(result.passed).toBe(false);
  });

  it('fails when task is Done', async () => {
    const result = await step.validate(makeContext('Done'));
    expect(result.passed).toBe(false);
  });
});

describe('ReadyFromRefinementOrBacklogValidation', () => {
  const step = new ReadyFromRefinementOrBacklogValidation();

  it('passes when task is In Refinement', async () => {
    const result = await step.validate(makeContext('In Refinement'));
    expect(result.passed).toBe(true);
  });

  it('passes when task is in Backlog (fast-track)', async () => {
    const result = await step.validate(makeContext('Backlog'));
    expect(result.passed).toBe(true);
  });

  it('fails when task is In Progress', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(false);
  });

  it('fails when task is Done', async () => {
    const result = await step.validate(makeContext('Done'));
    expect(result.passed).toBe(false);
  });
});

describe('StartFromReadyForDevValidation', () => {
  const step = new StartFromReadyForDevValidation();

  it('passes when task is Ready for Dev', async () => {
    const result = await step.validate(makeContext('Ready for Dev'));
    expect(result.passed).toBe(true);
  });

  it('fails when task is In Refinement', async () => {
    const result = await step.validate(makeContext('In Refinement'));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Ready for Dev');
  });

  it('fails when task is Backlog', async () => {
    const result = await step.validate(makeContext('Backlog'));
    expect(result.passed).toBe(false);
  });

  it('fails when task is In Progress', async () => {
    const result = await step.validate(makeContext('In Progress'));
    expect(result.passed).toBe(false);
  });
});
