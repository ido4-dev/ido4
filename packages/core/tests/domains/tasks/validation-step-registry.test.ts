import { describe, it, expect, vi } from 'vitest';
import { ValidationStepRegistry } from '../../../src/domains/tasks/validation-step-registry.js';
import type { StepDependencies } from '../../../src/domains/tasks/validation-step-registry.js';
import type { ValidationStep, ValidationStepResult, ValidationContext } from '../../../src/domains/tasks/types.js';
import { registerAllBuiltinSteps } from '../../../src/domains/tasks/validation-steps/index.js';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';

class MockStep implements ValidationStep {
  readonly name = 'MockStep';
  async validate(_context: ValidationContext): Promise<ValidationStepResult> {
    return { stepName: this.name, passed: true, message: 'ok', severity: 'info' };
  }
}

function createMockDeps(): StepDependencies {
  return {
    issueRepository: {} as StepDependencies['issueRepository'],
    integrityValidator: {} as StepDependencies['integrityValidator'],
    repositoryRepository: {} as StepDependencies['repositoryRepository'],
    projectConfig: {} as StepDependencies['projectConfig'],
    workflowConfig: {} as StepDependencies['workflowConfig'],
    gitWorkflowConfig: {} as StepDependencies['gitWorkflowConfig'],
    profile: HYDRO_PROFILE,
  };
}

describe('ValidationStepRegistry', () => {
  describe('register and create', () => {
    it('registers and creates a step', () => {
      const registry = new ValidationStepRegistry();
      registry.register('MockStep', () => new MockStep());

      const step = registry.create('MockStep', createMockDeps());
      expect(step.name).toBe('MockStep');
    });

    it('passes dependencies to factory', () => {
      const registry = new ValidationStepRegistry();
      const factory = vi.fn(() => new MockStep());
      registry.register('MockStep', factory);

      const deps = createMockDeps();
      registry.create('MockStep', deps);

      expect(factory).toHaveBeenCalledWith(deps, undefined);
    });

    it('throws NotFoundError for unknown step', () => {
      const registry = new ValidationStepRegistry();
      expect(() => registry.create('UnknownStep', createMockDeps()))
        .toThrow(NotFoundError);
    });
  });

  describe('parameterized names', () => {
    it('parses StepName:PARAM correctly', () => {
      const result = ValidationStepRegistry.parseName('StatusTransitionValidation:IN_PROGRESS');
      expect(result.stepName).toBe('StatusTransitionValidation');
      expect(result.param).toBe('IN_PROGRESS');
    });

    it('handles no parameter', () => {
      const result = ValidationStepRegistry.parseName('SimpleStep');
      expect(result.stepName).toBe('SimpleStep');
      expect(result.param).toBeUndefined();
    });

    it('passes param to factory when creating parameterized step', () => {
      const registry = new ValidationStepRegistry();
      const factory = vi.fn(() => new MockStep());
      registry.register('StatusTransitionValidation', factory);

      registry.create('StatusTransitionValidation:IN_PROGRESS', createMockDeps());
      expect(factory).toHaveBeenCalledWith(createMockDeps(), 'IN_PROGRESS');
    });
  });

  describe('has', () => {
    it('returns true for registered step', () => {
      const registry = new ValidationStepRegistry();
      registry.register('TestStep', () => new MockStep());

      expect(registry.has('TestStep')).toBe(true);
    });

    it('returns true for parameterized version of registered step', () => {
      const registry = new ValidationStepRegistry();
      registry.register('StatusTransitionValidation', () => new MockStep());

      expect(registry.has('StatusTransitionValidation:IN_PROGRESS')).toBe(true);
    });

    it('returns false for unregistered step', () => {
      const registry = new ValidationStepRegistry();
      expect(registry.has('Unknown')).toBe(false);
    });
  });

  describe('getRegisteredNames', () => {
    it('returns all registered step names', () => {
      const registry = new ValidationStepRegistry();
      registry.register('Step1', () => new MockStep());
      registry.register('Step2', () => new MockStep());

      expect(registry.getRegisteredNames()).toEqual(['Step1', 'Step2']);
    });
  });

  describe('registerAllBuiltinSteps', () => {
    it('registers all 34 built-in validation steps', () => {
      const registry = new ValidationStepRegistry();
      registerAllBuiltinSteps(registry);

      const names = registry.getRegisteredNames();
      expect(names).toHaveLength(34);

      // Verify key steps exist
      expect(registry.has('StatusTransitionValidation')).toBe(true);
      expect(registry.has('EpicIntegrityValidation')).toBe(true);
      expect(registry.has('DependencyValidation')).toBe(true);
      expect(registry.has('ImplementationReadinessValidation')).toBe(true);
      expect(registry.has('SubtaskCompletionValidation')).toBe(true);
      expect(registry.has('TaskLockValidation')).toBe(true);
      // New generic profile-driven steps
      expect(registry.has('SourceStatusValidation')).toBe(true);
      expect(registry.has('ContainerAssignmentValidation')).toBe(true);
      expect(registry.has('ContainerIntegrityValidation')).toBe(true);
      expect(registry.has('ContainerSingularityValidation')).toBe(true);
      expect(registry.has('CircuitBreakerValidation')).toBe(true);
      expect(registry.has('SpecCompletenessValidation')).toBe(true);
      expect(registry.has('ContextCompletenessValidation')).toBe(true);
    });

    it('can create parameterized StatusTransitionValidation step', () => {
      const registry = new ValidationStepRegistry();
      registerAllBuiltinSteps(registry);

      const step = registry.create('StatusTransitionValidation:IN_PROGRESS', createMockDeps());
      expect(step.name).toBe('StatusTransitionValidation');
    });

    it('can create all stateless steps', () => {
      const registry = new ValidationStepRegistry();
      registerAllBuiltinSteps(registry);

      const statelessSteps = [
        'RefineFromBacklogValidation',
        'ReadyFromRefinementOrBacklogValidation',
        'StartFromReadyForDevValidation',
        'TaskAlreadyCompletedValidation',
        'TaskAlreadyBlockedValidation',
        'TaskNotBlockedValidation',
        'TaskBlockedValidation',
        'StatusAlreadyDoneValidation',
        'BackwardTransitionValidation',
        'BaseTaskFieldsValidation',
        'AcceptanceCriteriaValidation',
        'EffortEstimationValidation',
        'DependencyIdentificationValidation',
        'WaveAssignmentValidation',
        'AISuitabilityValidation',
        'RiskLevelValidation',
        'FastTrackValidation',
        'ApprovalRequirementValidation',
      ];

      for (const name of statelessSteps) {
        const step = registry.create(name, createMockDeps());
        expect(step.name, `Step ${name} should have correct name`).toBe(name);
      }
    });
  });
});
