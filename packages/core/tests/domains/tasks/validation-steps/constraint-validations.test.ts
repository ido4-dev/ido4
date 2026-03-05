import { describe, it, expect } from 'vitest';
import { AISuitabilityValidation } from '../../../../src/domains/tasks/validation-steps/ai-suitability-validation.js';
import { RiskLevelValidation } from '../../../../src/domains/tasks/validation-steps/risk-level-validation.js';
import { FastTrackValidation } from '../../../../src/domains/tasks/validation-steps/fast-track-validation.js';
import { ApprovalRequirementValidation } from '../../../../src/domains/tasks/validation-steps/approval-requirement-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig } from '../../../helpers/mock-factories.js';

function makeContext(taskOverrides: Record<string, unknown> = {}): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData(taskOverrides),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

describe('AISuitabilityValidation', () => {
  const step = new AISuitabilityValidation();

  it('fails for human-only tasks', async () => {
    const result = await step.validate(makeContext({ aiSuitability: 'human-only' }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('passes for ai-only tasks', async () => {
    const result = await step.validate(makeContext({ aiSuitability: 'ai-only' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('passes with warning for ai-reviewed tasks', async () => {
    const result = await step.validate(makeContext({ aiSuitability: 'ai-reviewed' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('passes with warning for hybrid tasks', async () => {
    const result = await step.validate(makeContext({ aiSuitability: 'hybrid' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('passes with warning when undefined', async () => {
    const result = await step.validate(makeContext({ aiSuitability: undefined }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });
});

describe('RiskLevelValidation', () => {
  const step = new RiskLevelValidation();

  it('warns for High risk', async () => {
    const result = await step.validate(makeContext({ riskLevel: 'High' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('passes for Low risk', async () => {
    const result = await step.validate(makeContext({ riskLevel: 'Low' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('warns when risk level is undefined', async () => {
    const result = await step.validate(makeContext({ riskLevel: undefined }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });
});

describe('FastTrackValidation', () => {
  const step = new FastTrackValidation();

  it('passes for small effort from Backlog', async () => {
    const result = await step.validate(makeContext({ status: 'Backlog', effort: 'Small' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('passes with warning for large effort from Backlog', async () => {
    const result = await step.validate(makeContext({ status: 'Backlog', effort: 'Large' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('passes silently when not from Backlog', async () => {
    const result = await step.validate(makeContext({ status: 'In Refinement' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });
});

describe('ApprovalRequirementValidation', () => {
  const step = new ApprovalRequirementValidation();

  it('warns for high-risk tasks', async () => {
    const result = await step.validate(makeContext({ riskLevel: 'High' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('warns for ai-reviewed tasks', async () => {
    const result = await step.validate(makeContext({ aiSuitability: 'ai-reviewed' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('passes without warning for low-risk ai-only', async () => {
    const result = await step.validate(makeContext({ riskLevel: 'Low', aiSuitability: 'ai-only' }));
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });
});
