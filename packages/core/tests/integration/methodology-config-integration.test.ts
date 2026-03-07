/**
 * Integration test: Configurable Methodology
 *
 * Verifies that:
 * 1. Default methodology produces same pipelines as the original hardcoded switch
 * 2. Custom methodology.json changes which BRE steps run
 * 3. Missing methodology.json falls back to defaults (regression guard)
 * 4. ValidationStepRegistry + MethodologyConfig work together end-to-end
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  MethodologyConfig,
  MethodologyConfigLoader,
  DEFAULT_METHODOLOGY,
} from '../../src/config/methodology-config.js';
import type { MethodologyDefinition } from '../../src/config/methodology-config.js';
import { ValidationStepRegistry } from '../../src/domains/tasks/validation-step-registry.js';
import { registerAllBuiltinSteps } from '../../src/domains/tasks/validation-steps/index.js';

describe('Methodology Config Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'methodology-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('default methodology has all 9 transitions', () => {
    const config = new MethodologyConfig(DEFAULT_METHODOLOGY);
    const transitions = config.getTransitions();

    expect(transitions).toContain('refine');
    expect(transitions).toContain('ready');
    expect(transitions).toContain('start');
    expect(transitions).toContain('review');
    expect(transitions).toContain('approve');
    expect(transitions).toContain('complete');
    expect(transitions).toContain('block');
    expect(transitions).toContain('unblock');
    expect(transitions).toContain('return');
    expect(transitions).toHaveLength(9);
  });

  it('default methodology pipeline step counts match original switch', () => {
    const config = new MethodologyConfig(DEFAULT_METHODOLOGY);

    // These counts are from the original hardcoded switch statement
    expect(config.getStepsForTransition('refine')).toHaveLength(4);
    expect(config.getStepsForTransition('ready')).toHaveLength(7);
    expect(config.getStepsForTransition('start')).toHaveLength(7);
    expect(config.getStepsForTransition('review')).toHaveLength(3);
    expect(config.getStepsForTransition('approve')).toHaveLength(3);
    expect(config.getStepsForTransition('complete')).toHaveLength(2);
    expect(config.getStepsForTransition('block')).toHaveLength(3);
    expect(config.getStepsForTransition('unblock')).toHaveLength(3);
    expect(config.getStepsForTransition('return')).toHaveLength(3);
  });

  it('all default methodology steps can be instantiated from registry', () => {
    const config = new MethodologyConfig(DEFAULT_METHODOLOGY);
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockDeps = {
      issueRepository: {} as any,
      epicValidator: {} as any,
      repositoryRepository: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
    };

    // Every step referenced in the default methodology MUST be in the registry
    for (const transition of config.getTransitions()) {
      const steps = config.getStepsForTransition(transition);
      for (const stepName of steps) {
        expect(registry.has(stepName), `Missing step "${stepName}" for transition "${transition}"`).toBe(true);
        const step = registry.create(stepName, mockDeps);
        expect(step).toBeDefined();
        expect(typeof step.validate).toBe('function');
      }
    }
  });

  it('missing methodology.json falls back to defaults', async () => {
    // tmpDir has no .ido4/methodology.json
    const config = await MethodologyConfigLoader.load(tmpDir);

    // Should behave identically to DEFAULT_METHODOLOGY
    const defaultConfig = new MethodologyConfig(DEFAULT_METHODOLOGY);

    for (const transition of defaultConfig.getTransitions()) {
      const defaultSteps = defaultConfig.getStepsForTransition(transition);
      const loadedSteps = config.getStepsForTransition(transition);
      expect(loadedSteps, `Transition "${transition}" should match default`).toEqual(defaultSteps);
    }
  });

  it('custom methodology.json changes BRE pipeline', async () => {
    // Create a custom methodology that adds quality gates to approve
    const custom: MethodologyDefinition = {
      version: '1.0',
      name: 'Custom Governance',
      pipelines: {
        ...DEFAULT_METHODOLOGY.pipelines,
        approve: {
          steps: [
            'StatusTransitionValidation:DONE',
            'ApprovalRequirementValidation',
            'PRReviewValidation',
            'TestCoverageValidation',
            'SecurityScanValidation',
            'EpicIntegrityValidation',
          ],
        },
      },
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify(custom, null, 2),
    );

    const config = await MethodologyConfigLoader.load(tmpDir);

    // approve now has 6 steps instead of 3
    const approveSteps = config.getStepsForTransition('approve');
    expect(approveSteps).toHaveLength(6);
    expect(approveSteps).toContain('PRReviewValidation');
    expect(approveSteps).toContain('TestCoverageValidation');
    expect(approveSteps).toContain('SecurityScanValidation');

    // Other transitions remain unchanged
    expect(config.getStepsForTransition('start')).toHaveLength(7);
  });

  it('custom methodology with TaskLockValidation adds agent protection to start', async () => {
    const custom: MethodologyDefinition = {
      version: '1.0',
      name: 'Agent-Aware Governance',
      pipelines: {
        ...DEFAULT_METHODOLOGY.pipelines,
        start: {
          steps: [
            'TaskLockValidation', // <-- agent conflict check
            ...DEFAULT_METHODOLOGY.pipelines.start!.steps,
          ],
        },
      },
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify(custom, null, 2),
    );

    const config = await MethodologyConfigLoader.load(tmpDir);
    const startSteps = config.getStepsForTransition('start');
    expect(startSteps[0]).toBe('TaskLockValidation');
    expect(startSteps).toHaveLength(8); // 1 + original 7

    // Verify registry can create it
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);
    expect(registry.has('TaskLockValidation')).toBe(true);
  });

  it('invalid methodology.json throws ConfigurationError', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      'not json at all!!!',
    );

    await expect(MethodologyConfigLoader.load(tmpDir)).rejects.toThrow('Invalid JSON');
  });

  it('methodology missing required fields throws ConfigurationError', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology.json'),
      JSON.stringify({ version: '1.0' }), // missing name and pipelines
    );

    await expect(MethodologyConfigLoader.load(tmpDir)).rejects.toThrow('missing required fields');
  });
});
