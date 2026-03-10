import { describe, it, expect } from 'vitest';
import { ProfileRegistry } from '../../src/profiles/registry.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import type { MethodologyProfile } from '../../src/profiles/types.js';

function cloneProfile(profile: MethodologyProfile): MethodologyProfile {
  return JSON.parse(JSON.stringify(profile));
}

describe('ProfileRegistry.validate — valid profiles', () => {
  it('Hydro profile passes validation', () => {
    expect(() => ProfileRegistry.validate(HYDRO_PROFILE)).not.toThrow();
  });

  it('Shape Up profile passes validation', () => {
    expect(() => ProfileRegistry.validate(SHAPE_UP_PROFILE)).not.toThrow();
  });

  it('Scrum profile passes validation', () => {
    expect(() => ProfileRegistry.validate(SCRUM_PROFILE)).not.toThrow();
  });
});

describe('ProfileRegistry.validate — state machine errors', () => {
  it('rejects profile with unknown initialState', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.semantics.initialState = 'NONEXISTENT';
    expect(() => ProfileRegistry.validate(profile)).toThrow('initialState "NONEXISTENT" is not a valid state key');
  });

  it('rejects profile with terminalState not in states', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.semantics.terminalStates = ['DONE', 'ARCHIVED'];
    expect(() => ProfileRegistry.validate(profile)).toThrow('terminalState "ARCHIVED" not found in states');
  });

  it('rejects profile with done-category state not in terminalStates', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    // Add a 'done' state but don't add it to terminalStates
    profile.states.push({ key: 'ARCHIVED', name: 'Archived', category: 'done' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('State "ARCHIVED" has category \'done\' but is not in terminalStates');
  });

  it('rejects profile with terminalState lacking done category', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    // Add a non-done state to terminalStates
    profile.semantics.terminalStates = ['DONE', 'BACKLOG'];
    expect(() => ProfileRegistry.validate(profile)).toThrow('terminalState "BACKLOG" does not have category \'done\'');
  });

  it('rejects profile with duplicate state keys', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.states.push({ key: 'BACKLOG', name: 'Duplicate', category: 'todo' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('Duplicate state keys detected');
  });

  it('rejects profile with transition referencing unknown from-state', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.transitions.push({ action: 'test', from: ['UNKNOWN'], to: 'DONE', label: 'test' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('Transition "test": from state "UNKNOWN" not found');
  });

  it('rejects profile with transition referencing unknown to-state', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.transitions.push({ action: 'test', from: ['BACKLOG'], to: 'UNKNOWN', label: 'test' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('Transition "test": to state "UNKNOWN" not found');
  });
});

describe('ProfileRegistry.validate — container errors', () => {
  it('rejects profile with duplicate container IDs', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.containers.push({ id: 'wave', singular: 'Dup', plural: 'Dups', taskField: 'X' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('Duplicate container type IDs detected');
  });

  it('rejects profile with container referencing unknown parent', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.containers.push({ id: 'child', singular: 'C', plural: 'Cs', taskField: 'X', parent: 'nonexistent' });
    expect(() => ProfileRegistry.validate(profile)).toThrow('Container "child" references unknown parent "nonexistent"');
  });
});

describe('ProfileRegistry.validate — integrity rule errors', () => {
  it('rejects same-container rule with unknown groupBy', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.integrityRules = [{
      id: 'bad-rule', type: 'same-container', groupBy: 'nonexistent', mustMatch: 'wave',
      description: 'test', severity: 'error', principleId: 'test',
    }];
    expect(() => ProfileRegistry.validate(profile)).toThrow('groupBy "nonexistent" not found');
  });

  it('rejects ordering rule with unknown containerType', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.integrityRules = [{
      id: 'bad-rule', type: 'ordering', containerType: 'nonexistent',
      description: 'test', severity: 'error', principleId: 'test',
    }];
    expect(() => ProfileRegistry.validate(profile)).toThrow('containerType "nonexistent" not found');
  });

  it('rejects containment rule with unknown child', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.integrityRules = [{
      id: 'bad-rule', type: 'containment', child: 'nonexistent', parent: 'wave',
      description: 'test', severity: 'error', principleId: 'test',
    }];
    expect(() => ProfileRegistry.validate(profile)).toThrow('child "nonexistent" not found');
  });
});

describe('ProfileRegistry.validate — work item errors', () => {
  it('rejects profile with unknown defaultType', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.workItems.defaultType = 'nonexistent';
    expect(() => ProfileRegistry.validate(profile)).toThrow('defaultType "nonexistent" not found in work item types');
  });
});

describe('ProfileRegistry.validate — compliance errors', () => {
  it('rejects profile with weights not summing to 1.0', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.compliance.weights = { brePassRate: 0.50, qualityGates: 0.50, extra: 0.50 };
    expect(() => ProfileRegistry.validate(profile)).toThrow('Compliance weights sum to 1.5, expected 1.0');
  });

  it('rejects profile with lifecycle action not in transitions', () => {
    const profile = cloneProfile(HYDRO_PROFILE);
    profile.compliance.lifecycle = ['refine', 'ready', 'start', 'review', 'approve', 'nonexistent'];
    expect(() => ProfileRegistry.validate(profile)).toThrow('Compliance lifecycle action "nonexistent" not found in transitions');
  });
});
