import { describe, it, expect } from 'vitest';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import { WORKFLOW_STATUSES } from '../../src/domains/tasks/types.js';
import { DEFAULT_METHODOLOGY } from '../../src/config/methodology-config.js';
import type { MethodologyProfile } from '../../src/profiles/types.js';

function assertProfileComplete(profile: MethodologyProfile): void {
  expect(profile.id).toBeTruthy();
  expect(profile.name).toBeTruthy();
  expect(profile.version).toBeTruthy();
  expect(profile.description).toBeTruthy();
  expect(profile.states.length).toBeGreaterThan(0);
  expect(profile.transitions.length).toBeGreaterThan(0);
  expect(profile.semantics.initialState).toBeTruthy();
  expect(profile.semantics.terminalStates.length).toBeGreaterThan(0);
  expect(profile.containers.length).toBeGreaterThan(0);
  expect(profile.workItems.types.length).toBeGreaterThan(0);
  expect(Object.keys(profile.pipelines).length).toBeGreaterThan(0);
  expect(profile.compliance.lifecycle.length).toBeGreaterThan(0);
  expect(Object.keys(profile.compliance.weights).length).toBeGreaterThan(0);
  expect(profile.behaviors.closingTransitions.length).toBeGreaterThan(0);
}

describe('Profile Types — structural completeness', () => {
  it('Hydro profile has all required fields', () => {
    assertProfileComplete(HYDRO_PROFILE);
  });

  it('Shape Up profile has all required fields', () => {
    assertProfileComplete(SHAPE_UP_PROFILE);
  });

  it('Scrum profile has all required fields', () => {
    assertProfileComplete(SCRUM_PROFILE);
  });

  it('Hydro states match current WORKFLOW_STATUSES', () => {
    const profileKeys = HYDRO_PROFILE.states.map((s) => s.key);
    const currentKeys = Object.keys(WORKFLOW_STATUSES);
    expect(profileKeys.sort()).toEqual(currentKeys.sort());

    // Names match too
    for (const state of HYDRO_PROFILE.states) {
      const current = WORKFLOW_STATUSES[state.key as keyof typeof WORKFLOW_STATUSES];
      expect(current).toBeDefined();
      expect(state.name).toBe(current);
    }
  });

  it('Hydro pipeline action keys match DEFAULT_METHODOLOGY pipeline keys', () => {
    const profileKeys = Object.keys(HYDRO_PROFILE.pipelines).sort();
    const currentKeys = Object.keys(DEFAULT_METHODOLOGY.pipelines).sort();
    expect(profileKeys).toEqual(currentKeys);
  });

  it('Hydro transitions cover all current transition pairs', () => {
    // The profile must have transitions for: refine, ready, start, review, approve, complete, block, unblock, return
    const actions = [...new Set(HYDRO_PROFILE.transitions.map((t) => t.action))];
    expect(actions).toContain('refine');
    expect(actions).toContain('ready');
    expect(actions).toContain('start');
    expect(actions).toContain('review');
    expect(actions).toContain('approve');
    expect(actions).toContain('complete');
    expect(actions).toContain('block');
    expect(actions).toContain('unblock');
    expect(actions).toContain('return');
  });

  it('Shape Up has 3 container types (cycle, bet, scope)', () => {
    const ids = SHAPE_UP_PROFILE.containers.map((c) => c.id);
    expect(ids).toEqual(['cycle', 'bet', 'scope']);
    expect(SHAPE_UP_PROFILE.containers.find((c) => c.id === 'scope')?.parent).toBe('bet');
  });

  it('Shape Up has two terminal states (SHIPPED, KILLED)', () => {
    expect(SHAPE_UP_PROFILE.semantics.terminalStates.sort()).toEqual(['KILLED', 'SHIPPED']);
  });

  it('Scrum has type-scoped pipelines', () => {
    const pipelineKeys = Object.keys(SCRUM_PROFILE.pipelines);
    const typeScopedKeys = pipelineKeys.filter((k) => k.includes(':'));
    expect(typeScopedKeys.sort()).toEqual([
      'approve:spike',
      'approve:tech-debt',
      'plan:bug',
      'plan:spike',
      'plan:story',
      'start:bug',
    ]);
  });

  it('Scrum has 5 work item types', () => {
    const typeIds = SCRUM_PROFILE.workItems.types.map((t) => t.id);
    expect(typeIds).toEqual(['story', 'bug', 'spike', 'chore', 'tech-debt']);
  });
});
