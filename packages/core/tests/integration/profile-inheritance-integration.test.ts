/**
 * Profile Inheritance Integration Test — Extends Mechanism
 *
 * Verifies that ProfileRegistry.resolve() correctly handles the `extends`
 * mechanism for MethodologyProfileFile:
 *   - Base profile fields are inherited when not overridden
 *   - Shallow merge for nested objects (semantics, workItems, compliance, behaviors)
 *   - Shallow merge for pipelines (custom pipelines ADD to base, don't replace)
 *   - Array fields (principles) are replaced wholesale when provided
 *   - Validation catches inconsistencies in the resolved profile
 */

import { describe, it, expect } from 'vitest';
import { ProfileRegistry } from '../../src/profiles/registry.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import type { MethodologyProfileFile } from '../../src/profiles/types.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';

describe('ProfileRegistry.resolve() — extends mechanism', () => {
  it('extends Scrum with a custom pipeline override', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'my-team',
      pipelines: {
        'approve:custom': {
          steps: ['StatusTransitionValidation:DONE', 'PRReviewValidation:3'],
        },
      },
    };

    const profile = ProfileRegistry.resolve(file);

    // ID is overridden
    expect(profile.id).toBe('my-team');

    // All Scrum defaults inherited
    expect(profile.states).toEqual(SCRUM_PROFILE.states);
    expect(profile.transitions).toEqual(SCRUM_PROFILE.transitions);
    expect(profile.semantics).toEqual(SCRUM_PROFILE.semantics);
    expect(profile.containers).toEqual(SCRUM_PROFILE.containers);
    expect(profile.workItems).toEqual(SCRUM_PROFILE.workItems);

    // Custom pipeline exists with specified steps
    expect(profile.pipelines['approve:custom']).toEqual({
      steps: ['StatusTransitionValidation:DONE', 'PRReviewValidation:3'],
    });

    // Base Scrum pipelines still present (shallow merge adds, doesn't replace)
    expect(profile.pipelines['plan']).toEqual(SCRUM_PROFILE.pipelines['plan']);
    expect(profile.pipelines['start']).toEqual(SCRUM_PROFILE.pipelines['start']);
    expect(profile.pipelines['review']).toEqual(SCRUM_PROFILE.pipelines['review']);
    expect(profile.pipelines['approve']).toEqual(SCRUM_PROFILE.pipelines['approve']);
  });

  it('extends Scrum with compliance weight overrides', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'quality-team',
      compliance: {
        weights: {
          brePassRate: 0.30,
          qualityGates: 0.35,
          processAdherence: 0.25,
          flowEfficiency: 0.10,
        },
      },
    };

    const profile = ProfileRegistry.resolve(file);

    // Overridden weights are used
    expect(profile.compliance.weights.qualityGates).toBe(0.35);
    expect(profile.compliance.weights.brePassRate).toBe(0.30);
    expect(profile.compliance.weights.processAdherence).toBe(0.25);
    expect(profile.compliance.weights.flowEfficiency).toBe(0.10);

    // Other config inherited from Scrum
    expect(profile.states).toEqual(SCRUM_PROFILE.states);
    expect(profile.transitions).toEqual(SCRUM_PROFILE.transitions);
    expect(profile.containers).toEqual(SCRUM_PROFILE.containers);

    // Lifecycle inherited from Scrum (shallow merge: weights override replaces lifecycle)
    expect(profile.compliance.lifecycle).toEqual(['plan', 'start', 'review', 'approve']);
  });

  it('extends Shape Up with an additional principle', () => {
    const file: MethodologyProfileFile = {
      extends: 'shape-up',
      id: 'strict-shape-up',
      principles: [
        ...SHAPE_UP_PROFILE.principles,
        {
          id: 'no-scope-creep',
          name: 'No Scope Creep',
          description: 'Do not add tasks after cycle starts',
          severity: 'warning' as const,
        },
      ],
    };

    const profile = ProfileRegistry.resolve(file);

    // Shape Up defaults inherited
    expect(profile.states).toEqual(SHAPE_UP_PROFILE.states);
    expect(profile.transitions).toEqual(SHAPE_UP_PROFILE.transitions);
    expect(profile.containers).toEqual(SHAPE_UP_PROFILE.containers);

    // Principles include both original Shape Up principles AND the new one
    expect(profile.principles).toHaveLength(SHAPE_UP_PROFILE.principles.length + 1);
    expect(profile.principles).toHaveLength(5);

    // Original principles present
    for (const original of SHAPE_UP_PROFILE.principles) {
      expect(profile.principles).toContainEqual(original);
    }

    // New principle present
    expect(profile.principles).toContainEqual({
      id: 'no-scope-creep',
      name: 'No Scope Creep',
      description: 'Do not add tasks after cycle starts',
      severity: 'warning',
    });
  });

  it('throws ConfigurationError when extended profile has invalid semantics', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'broken-team',
      semantics: { initialState: 'NONEXISTENT' },
    };

    expect(() => ProfileRegistry.resolve(file)).toThrow(ConfigurationError);
    expect(() => ProfileRegistry.resolve(file)).toThrow(/NONEXISTENT/);
  });
});
