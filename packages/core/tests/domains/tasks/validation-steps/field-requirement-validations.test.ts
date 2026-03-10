import { describe, it, expect } from 'vitest';
import { BaseTaskFieldsValidation } from '../../../../src/domains/tasks/validation-steps/base-task-fields-validation.js';
import { AcceptanceCriteriaValidation } from '../../../../src/domains/tasks/validation-steps/acceptance-criteria-validation.js';
import { EffortEstimationValidation } from '../../../../src/domains/tasks/validation-steps/effort-estimation-validation.js';
import { DependencyIdentificationValidation } from '../../../../src/domains/tasks/validation-steps/dependency-identification-validation.js';
import { WaveAssignmentValidation } from '../../../../src/domains/tasks/validation-steps/wave-assignment-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../../helpers/mock-factories.js';

function makeContext(taskOverrides: Record<string, unknown> = {}): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'ready',
    task: createMockTaskData(taskOverrides),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

describe('BaseTaskFieldsValidation', () => {
  const step = new BaseTaskFieldsValidation();

  it('passes when title and body are present', async () => {
    const result = await step.validate(makeContext({ title: 'Task', body: 'Description' }));
    expect(result.passed).toBe(true);
  });

  it('fails when title is empty', async () => {
    const result = await step.validate(makeContext({ title: '', body: 'Description' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('title');
  });

  it('fails when body is empty', async () => {
    const result = await step.validate(makeContext({ title: 'Task', body: '' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('description');
  });

  it('fails when both are missing', async () => {
    const result = await step.validate(makeContext({ title: '', body: '' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('title');
    expect(result.message).toContain('description');
  });
});

describe('AcceptanceCriteriaValidation', () => {
  const step = new AcceptanceCriteriaValidation();

  it('warns when body is too short', async () => {
    const result = await step.validate(makeContext({ body: 'Short body.' }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('too short');
  });

  it('passes with long body containing AC markers', async () => {
    const body = `## Acceptance Criteria\n\nGiven a user is logged in\nWhen they click logout\nThen they should be redirected to login page\n\n${'x'.repeat(100)}`;
    const result = await step.validate(makeContext({ body }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('passes with warning when long body lacks AC markers', async () => {
    const body = `This is a detailed description that explains what needs to be done.\nIt has multiple lines.\n${'x'.repeat(100)}`;
    const result = await step.validate(makeContext({ body }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });
});

describe('EffortEstimationValidation', () => {
  const step = new EffortEstimationValidation();

  it('passes when effort is set', async () => {
    const result = await step.validate(makeContext({ effort: 'Medium' }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('Medium');
  });

  it('fails when effort is missing', async () => {
    const result = await step.validate(makeContext({ effort: undefined }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });
});

describe('DependencyIdentificationValidation', () => {
  const step = new DependencyIdentificationValidation();

  it('passes when dependencies are identified', async () => {
    const result = await step.validate(makeContext({ dependencies: '#123, #456' }));
    expect(result.passed).toBe(true);
  });

  it('passes when explicitly marked as none', async () => {
    const result = await step.validate(makeContext({ dependencies: 'No dependencies' }));
    expect(result.passed).toBe(true);
  });

  it('fails when dependencies field is empty', async () => {
    const result = await step.validate(makeContext({ dependencies: '' }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });

  it('fails when dependencies field is undefined', async () => {
    const result = await step.validate(makeContext({ dependencies: undefined }));
    expect(result.passed).toBe(false);
  });
});

describe('WaveAssignmentValidation', () => {
  const step = new WaveAssignmentValidation();

  it('passes when wave is assigned', async () => {
    const result = await step.validate(makeContext({ containers: { wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('wave-001');
  });

  it('fails when wave is missing', async () => {
    const result = await step.validate(makeContext({ containers: {} }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('fails when wave is empty string', async () => {
    const result = await step.validate(makeContext({ containers: { wave: '' } }));
    expect(result.passed).toBe(false);
  });
});
