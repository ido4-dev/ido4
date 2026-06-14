/**
 * Hydro Pipeline Resolution — verifies that every step name in HYDRO_PROFILE.pipelines
 * resolves in the ValidationStepRegistry. This proves the profile is ready for
 * Phase 3 when it drives the BRE.
 */

import { describe, it, expect } from 'vitest';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
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

// P2 — Definition of Done: every methodology's default closing transition must
// gate on an approving PR review, so a task cannot reach a terminal state with
// an open/unreviewed PR (the rubber-stamp closure the synthetic value-judge
// caught). Relaxed type overrides (spike, kill) intentionally opt out.
describe('Closing-transition DoD gate (P2)', () => {
  const cases: Array<[string, Record<string, { steps: string[] }>, string]> = [
    ['Scrum', SCRUM_PROFILE.pipelines, 'approve'],
    ['Hydro', HYDRO_PROFILE.pipelines, 'approve'],
    ['Shape Up', SHAPE_UP_PROFILE.pipelines, 'ship'],
  ];
  for (const [name, pipelines, closing] of cases) {
    it(`${name} default ${closing} pipeline requires an approving PR review`, () => {
      const steps = pipelines[closing]?.steps ?? [];
      expect(steps.some((s) => s.startsWith('PRReviewValidation'))).toBe(true);
    });
  }
});
