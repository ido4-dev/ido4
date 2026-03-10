/**
 * Container Validations — tests for the 4 new generic BRE steps:
 * - SourceStatusValidation
 * - ContainerAssignmentValidation
 * - ContainerIntegrityValidation
 * - ContainerSingularityValidation
 */

import { describe, it, expect, vi } from 'vitest';
import { SourceStatusValidation } from '../../../../src/domains/tasks/validation-steps/source-status-validation.js';
import { ContainerAssignmentValidation } from '../../../../src/domains/tasks/validation-steps/container-assignment-validation.js';
import { ContainerIntegrityValidation } from '../../../../src/domains/tasks/validation-steps/container-integrity-validation.js';
import { ContainerSingularityValidation } from '../../../../src/domains/tasks/validation-steps/container-singularity-validation.js';
import { HYDRO_PROFILE } from '../../../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../../../src/profiles/shape-up.js';
import { createMockTaskData, createMockProjectConfig, createMockWorkflowConfig, createMockGitWorkflowConfig } from '../../../helpers/mock-factories.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import type { StepDependencies } from '../../../../src/domains/tasks/validation-step-registry.js';

function makeContext(overrides: Partial<ValidationContext['task']> = {}): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData(overrides),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
    gitWorkflowConfig: createMockGitWorkflowConfig(),
  };
}

function makeDeps(overrides: Partial<StepDependencies> = {}): StepDependencies {
  return {
    issueRepository: {} as StepDependencies['issueRepository'],
    integrityValidator: {
      validateAssignmentIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
    } as unknown as StepDependencies['integrityValidator'],
    repositoryRepository: {} as StepDependencies['repositoryRepository'],
    projectConfig: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
    gitWorkflowConfig: createMockGitWorkflowConfig(),
    profile: HYDRO_PROFILE,
    ...overrides,
  };
}

// ─── SourceStatusValidation ───

describe('SourceStatusValidation', () => {
  it('passes when task is in the allowed status (single key)', async () => {
    const step = new SourceStatusValidation('BACKLOG');
    const result = await step.validate(makeContext({ status: 'Backlog' }));
    expect(result.passed).toBe(true);
  });

  it('fails when task is NOT in the allowed status', async () => {
    const step = new SourceStatusValidation('BACKLOG');
    const result = await step.validate(makeContext({ status: 'In Progress' }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('"Backlog"');
  });

  it('passes when task matches one of multiple allowed statuses', async () => {
    const step = new SourceStatusValidation('IN_REFINEMENT,BACKLOG');
    const result = await step.validate(makeContext({ status: 'Backlog' }));
    expect(result.passed).toBe(true);
  });

  it('passes for second allowed status', async () => {
    const step = new SourceStatusValidation('IN_REFINEMENT,BACKLOG');
    const result = await step.validate(makeContext({ status: 'In Refinement' }));
    expect(result.passed).toBe(true);
  });

  it('fails for status not in allowed list', async () => {
    const step = new SourceStatusValidation('IN_REFINEMENT,BACKLOG');
    const result = await step.validate(makeContext({ status: 'In Progress' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('"In Refinement"');
    expect(result.message).toContain('"Backlog"');
  });

  it('has correct step name', () => {
    const step = new SourceStatusValidation('BACKLOG');
    expect(step.name).toBe('SourceStatusValidation');
  });
});

// ─── ContainerAssignmentValidation ───

describe('ContainerAssignmentValidation', () => {
  it('passes when task has the container assigned', async () => {
    const step = new ContainerAssignmentValidation('wave');
    const result = await step.validate(makeContext({ containers: { wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('wave-001');
  });

  it('fails when container is missing', async () => {
    const step = new ContainerAssignmentValidation('wave');
    const result = await step.validate(makeContext({ containers: {} }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('wave');
  });

  it('fails when container is empty string', async () => {
    const step = new ContainerAssignmentValidation('wave');
    const result = await step.validate(makeContext({ containers: { wave: '' } }));
    expect(result.passed).toBe(false);
  });

  it('works with non-wave container types', async () => {
    const step = new ContainerAssignmentValidation('cycle');
    const result = await step.validate(makeContext({ containers: { cycle: 'cycle-001' } }));
    expect(result.passed).toBe(true);
  });

  it('has correct step name', () => {
    const step = new ContainerAssignmentValidation('wave');
    expect(step.name).toBe('ContainerAssignmentValidation');
  });
});

// ─── ContainerIntegrityValidation ───

describe('ContainerIntegrityValidation', () => {
  it('passes when no profile is configured', async () => {
    const deps = makeDeps({ profile: undefined });
    const step = new ContainerIntegrityValidation('epic-wave-integrity', deps);
    const result = await step.validate(makeContext({ containers: { epic: 'Auth', wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('skipped');
  });

  it('passes when rule not found in profile', async () => {
    const deps = makeDeps();
    const step = new ContainerIntegrityValidation('nonexistent-rule', deps);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
  });

  it('passes when task has no groupBy container', async () => {
    const deps = makeDeps();
    const step = new ContainerIntegrityValidation('epic-wave-integrity', deps);
    const result = await step.validate(makeContext({ containers: { wave: 'wave-001' } })); // no epic
    expect(result.passed).toBe(true);
    expect(result.message).toContain('not applicable');
  });

  it('passes when task has no mustMatch container', async () => {
    const deps = makeDeps();
    const step = new ContainerIntegrityValidation('epic-wave-integrity', deps);
    const result = await step.validate(makeContext({ containers: { epic: 'Auth' } })); // no wave
    expect(result.passed).toBe(true);
    expect(result.message).toContain('cannot be verified');
  });

  it('passes when integrity is maintained', async () => {
    const deps = makeDeps();
    const step = new ContainerIntegrityValidation('epic-wave-integrity', deps);
    const result = await step.validate(makeContext({ containers: { epic: 'Auth', wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
  });

  it('fails when integrity is violated', async () => {
    const integrityValidator = {
      validateAssignmentIntegrity: vi.fn().mockResolvedValue({
        maintained: false,
        violations: ['Epic "Auth" split across wave-001, wave-002'],
      }),
    };
    const deps = makeDeps({ integrityValidator: integrityValidator as any });
    const step = new ContainerIntegrityValidation('epic-wave-integrity', deps);
    const result = await step.validate(makeContext({ containers: { epic: 'Auth', wave: 'wave-001' } }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('split');
  });

  it('works with Shape Up bet-cycle-integrity rule', async () => {
    const deps = makeDeps({ profile: SHAPE_UP_PROFILE });
    const step = new ContainerIntegrityValidation('bet-cycle-integrity', deps);
    const result = await step.validate(makeContext({ containers: { bet: 'notifications', cycle: 'cycle-001' } }));
    expect(result.passed).toBe(true);
  });
});

// ─── ContainerSingularityValidation ───

describe('ContainerSingularityValidation', () => {
  it('passes when no profile is configured', async () => {
    const deps = makeDeps({ profile: undefined });
    const step = new ContainerSingularityValidation('wave', deps);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
  });

  it('passes when container type not found in profile', async () => {
    const deps = makeDeps();
    const step = new ContainerSingularityValidation('nonexistent', deps);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
  });

  it('passes when container type does not require singularity', async () => {
    const deps = makeDeps();
    const step = new ContainerSingularityValidation('epic', deps); // epic has no singularity
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
    expect(result.message).toContain('does not require singularity');
  });

  it('passes when container type has singularity enabled', async () => {
    const deps = makeDeps();
    const step = new ContainerSingularityValidation('wave', deps); // wave has singularity=true
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
    expect(result.message).toContain('singularity enforcement enabled');
  });

  it('works with Shape Up cycle singularity', async () => {
    const deps = makeDeps({ profile: SHAPE_UP_PROFILE });
    const step = new ContainerSingularityValidation('cycle', deps);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
    expect(result.message).toContain('singularity enforcement enabled');
  });
});
