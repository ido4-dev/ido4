/**
 * Hydro Pipeline Resolution — verifies that every step name in HYDRO_PROFILE.pipelines
 * resolves in the ValidationStepRegistry. This proves the profile is ready for
 * Phase 3 when it drives the BRE.
 */

import { describe, it, expect } from 'vitest';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import { ValidationStepRegistry } from '../../src/domains/tasks/validation-step-registry.js';
import { registerAllBuiltinSteps } from '../../src/domains/tasks/validation-steps/index.js';

describe('Hydro Pipeline Resolution', () => {
  const registry = new ValidationStepRegistry();
  registerAllBuiltinSteps(registry);

  for (const [action, pipeline] of Object.entries(HYDRO_PROFILE.pipelines)) {
    for (const stepName of pipeline.steps) {
      it(`resolves step "${stepName}" in ${action} pipeline`, () => {
        expect(registry.has(stepName)).toBe(true);
      });
    }
  }

  it('all Hydro pipeline steps resolve', () => {
    const allSteps = Object.values(HYDRO_PROFILE.pipelines).flatMap((p) => p.steps);
    const unresolved = allSteps.filter((s) => !registry.has(s));
    expect(unresolved).toEqual([]);
  });
});

describe('Shape Up Pipeline Resolution', () => {
  const registry = new ValidationStepRegistry();
  registerAllBuiltinSteps(registry);

  it('all Shape Up pipeline steps resolve', () => {
    const allSteps = Object.values(SHAPE_UP_PROFILE.pipelines).flatMap((p) => p.steps);
    const unresolved = allSteps.filter((s) => !registry.has(s));
    expect(unresolved).toEqual([]);
  });
});
