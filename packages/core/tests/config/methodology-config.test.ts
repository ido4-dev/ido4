import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  MethodologyConfig,
  MethodologyConfigLoader,
  DEFAULT_METHODOLOGY,
} from '../../src/config/methodology-config.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';

describe('MethodologyConfig', () => {
  const config = new MethodologyConfig(DEFAULT_METHODOLOGY);

  describe('getStepsForTransition', () => {
    it('returns steps for refine transition', () => {
      const steps = config.getStepsForTransition('refine');
      expect(steps).toEqual([
        'RefineFromBacklogValidation',
        'BaseTaskFieldsValidation',
        'StatusTransitionValidation:IN_REFINEMENT',
        'EpicIntegrityValidation',
      ]);
    });

    it('returns steps for start transition', () => {
      const steps = config.getStepsForTransition('start');
      expect(steps).toContain('StartFromReadyForDevValidation');
      expect(steps).toContain('StatusTransitionValidation:IN_PROGRESS');
      expect(steps).toContain('DependencyValidation');
      expect(steps).toContain('EpicIntegrityValidation');
    });

    it('returns empty array for unknown transition', () => {
      const steps = config.getStepsForTransition('nonexistent');
      expect(steps).toEqual([]);
    });

    it('returns a copy (not original array)', () => {
      const steps1 = config.getStepsForTransition('refine');
      const steps2 = config.getStepsForTransition('refine');
      expect(steps1).toEqual(steps2);
      steps1.push('extra');
      expect(steps2).not.toContain('extra');
    });
  });

  describe('getStepConfig', () => {
    it('returns empty object for unconfigured steps', () => {
      expect(config.getStepConfig('SomeStep')).toEqual({});
    });

    it('returns config when defined', () => {
      const customConfig = new MethodologyConfig({
        ...DEFAULT_METHODOLOGY,
        stepConfig: { PRReviewValidation: { requiredApprovals: 2 } },
      });
      expect(customConfig.getStepConfig('PRReviewValidation')).toEqual({ requiredApprovals: 2 });
    });
  });

  describe('getTransitions', () => {
    it('returns all 9 transitions', () => {
      const transitions = config.getTransitions();
      expect(transitions).toHaveLength(9);
      expect(transitions).toContain('refine');
      expect(transitions).toContain('ready');
      expect(transitions).toContain('start');
      expect(transitions).toContain('review');
      expect(transitions).toContain('approve');
      expect(transitions).toContain('complete');
      expect(transitions).toContain('block');
      expect(transitions).toContain('unblock');
      expect(transitions).toContain('return');
    });
  });

  describe('isStepEnabled', () => {
    it('detects exact step match', () => {
      expect(config.isStepEnabled('refine', 'RefineFromBacklogValidation')).toBe(true);
    });

    it('detects parameterized step match', () => {
      expect(config.isStepEnabled('refine', 'StatusTransitionValidation')).toBe(true);
    });

    it('returns false for non-matching step', () => {
      expect(config.isStepEnabled('refine', 'NonexistentStep')).toBe(false);
    });
  });
});

describe('MethodologyConfigLoader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'methodology-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when file is missing', async () => {
    const config = await MethodologyConfigLoader.load(tmpDir);
    const steps = config.getStepsForTransition('refine');
    expect(steps).toEqual(DEFAULT_METHODOLOGY.pipelines.refine.steps);
  });

  it('loads valid methodology.json', async () => {
    const customDef = {
      version: '1.0',
      name: 'Custom Governance',
      pipelines: {
        refine: { steps: ['BaseTaskFieldsValidation'] },
      },
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify(customDef),
    );

    const config = await MethodologyConfigLoader.load(tmpDir);
    const steps = config.getStepsForTransition('refine');
    expect(steps).toEqual(['BaseTaskFieldsValidation']);
  });

  it('throws ConfigurationError for invalid JSON', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      '{invalid json!!!',
    );

    await expect(MethodologyConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('throws ConfigurationError for missing required fields', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify({ version: '1.0' }),
    );

    await expect(MethodologyConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('throws ConfigurationError for invalid steps (not array)', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify({
        version: '1.0',
        name: 'Bad',
        pipelines: { refine: { steps: 'not-an-array' } },
      }),
    );

    await expect(MethodologyConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('default methodology matches all 9 transitions', async () => {
    const config = await MethodologyConfigLoader.load(tmpDir);
    const transitions = config.getTransitions();
    expect(transitions).toHaveLength(9);
  });
});

describe('MethodologyConfig.fromProfile', () => {
  it('creates config from Hydro profile with same pipelines', () => {
    const config = MethodologyConfig.fromProfile(HYDRO_PROFILE);
    const steps = config.getStepsForTransition('refine');
    expect(steps).toEqual(HYDRO_PROFILE.pipelines.refine.steps);
  });

  it('creates config from Scrum profile', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);
    const steps = config.getStepsForTransition('plan');
    expect(steps).toEqual(SCRUM_PROFILE.pipelines.plan.steps);
  });

  it('returns all transitions from profile pipelines', () => {
    const config = MethodologyConfig.fromProfile(HYDRO_PROFILE);
    const transitions = config.getTransitions();
    expect(transitions).toContain('refine');
    expect(transitions).toContain('approve');
    expect(transitions).toHaveLength(Object.keys(HYDRO_PROFILE.pipelines).length);
  });
});

describe('type-scoped pipeline resolution', () => {
  it('resolves type-scoped pipeline when available (Scrum plan:story)', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);
    const storySteps = config.getStepsForTransition('plan', 'story');
    expect(storySteps).toEqual(SCRUM_PROFILE.pipelines['plan:story'].steps);
    // Different from default plan
    const defaultSteps = config.getStepsForTransition('plan');
    expect(storySteps).not.toEqual(defaultSteps);
  });

  it('falls back to default pipeline when type-scoped not found', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);
    const steps = config.getStepsForTransition('plan', 'chore');
    // No plan:chore exists, falls back to plan
    expect(steps).toEqual(SCRUM_PROFILE.pipelines.plan.steps);
  });

  it('falls back when workItemType is undefined', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);
    const steps = config.getStepsForTransition('plan', undefined);
    expect(steps).toEqual(SCRUM_PROFILE.pipelines.plan.steps);
  });

  it('type-scoped resolution returns empty for unknown transition', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);
    const steps = config.getStepsForTransition('nonexistent', 'story');
    expect(steps).toEqual([]);
  });

  it('Hydro has no type-scoped overrides, always returns default', () => {
    const config = MethodologyConfig.fromProfile(HYDRO_PROFILE);
    const defaultSteps = config.getStepsForTransition('start');
    const typedSteps = config.getStepsForTransition('start', 'task');
    expect(typedSteps).toEqual(defaultSteps);
  });
});

describe('DEFAULT_METHODOLOGY completeness', () => {
  it('every pipeline has at least one step', () => {
    for (const [name, pipeline] of Object.entries(DEFAULT_METHODOLOGY.pipelines)) {
      expect(pipeline.steps.length, `Pipeline "${name}" has no steps`).toBeGreaterThan(0);
    }
  });

  it('approve pipeline includes StatusTransitionValidation:DONE', () => {
    expect(DEFAULT_METHODOLOGY.pipelines.approve.steps).toContain('StatusTransitionValidation:DONE');
  });

  it('start pipeline includes DependencyValidation and WaveAssignmentValidation', () => {
    const startSteps = DEFAULT_METHODOLOGY.pipelines.start.steps;
    expect(startSteps).toContain('DependencyValidation');
    expect(startSteps).toContain('WaveAssignmentValidation');
  });
});
