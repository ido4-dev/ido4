import { describe, it, expect } from 'vitest';
import { ProfileRegistry } from '../../src/profiles/registry.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';

describe('ProfileRegistry', () => {
  it('getBuiltin returns Hydro profile', () => {
    expect(ProfileRegistry.getBuiltin('hydro')).toBe(HYDRO_PROFILE);
  });

  it('getBuiltin returns Shape Up profile', () => {
    expect(ProfileRegistry.getBuiltin('shape-up')).toBe(SHAPE_UP_PROFILE);
  });

  it('getBuiltin returns Scrum profile', () => {
    expect(ProfileRegistry.getBuiltin('scrum')).toBe(SCRUM_PROFILE);
  });

  it('getBuiltin throws ConfigurationError for unknown profile', () => {
    expect(() => ProfileRegistry.getBuiltin('kanban')).toThrow('Unknown methodology profile: "kanban"');
  });

  it('listBuiltin returns all built-in profile IDs', () => {
    expect(ProfileRegistry.listBuiltin()).toEqual(['hydro', 'shape-up', 'scrum']);
  });

  describe('resolve', () => {
    it('resolves built-in profile with extends field', () => {
      const resolved = ProfileRegistry.resolve({ id: 'scrum', extends: 'scrum' });
      expect(resolved.id).toBe('scrum');
      expect(resolved.states.length).toBeGreaterThan(0);
      expect(resolved.transitions.length).toBeGreaterThan(0);
    });

    it('resolves built-in profile with bare id (no extends)', () => {
      // This is the format ProjectInitService writes to methodology-profile.json
      const resolved = ProfileRegistry.resolve({ id: 'scrum' });
      expect(resolved.id).toBe('scrum');
      expect(resolved.states).toEqual(SCRUM_PROFILE.states);
      expect(resolved.transitions).toEqual(SCRUM_PROFILE.transitions);
    });

    it('resolves all three built-in profiles with bare id', () => {
      for (const id of ['hydro', 'shape-up', 'scrum'] as const) {
        const resolved = ProfileRegistry.resolve({ id });
        expect(resolved.id).toBe(id);
        expect(resolved.states.length).toBeGreaterThan(0);
      }
    });

    it('allows overriding name when extending built-in', () => {
      const resolved = ProfileRegistry.resolve({
        id: 'my-scrum',
        extends: 'scrum',
        name: 'Custom Scrum',
      });
      expect(resolved.id).toBe('my-scrum');
      expect(resolved.name).toBe('Custom Scrum');
      expect(resolved.states).toEqual(SCRUM_PROFILE.states);
    });

    it('allows overriding states when extending built-in', () => {
      const customStates = [
        ...SCRUM_PROFILE.states,
        { key: 'TESTING', name: 'Testing', category: 'active' as const },
      ];
      const resolved = ProfileRegistry.resolve({
        id: 'my-scrum',
        extends: 'scrum',
        states: customStates,
      });
      expect(resolved.states).toEqual(customStates);
      expect(resolved.states.length).toBe(SCRUM_PROFILE.states.length + 1);
    });

    it('throws for unknown custom profile without all required fields', () => {
      expect(() => ProfileRegistry.resolve({ id: 'kanban' })).toThrow(
        'Custom profile "kanban" must provide all required fields',
      );
    });

    it('throws for unknown extends target', () => {
      expect(() => ProfileRegistry.resolve({ id: 'my-kanban', extends: 'kanban' })).toThrow(
        'Unknown methodology profile: "kanban"',
      );
    });

    it('validates resolved profile (catches invalid state references)', () => {
      expect(() =>
        ProfileRegistry.resolve({
          id: 'bad-scrum',
          extends: 'scrum',
          semantics: {
            ...SCRUM_PROFILE.semantics,
            initialState: 'NONEXISTENT',
          },
        }),
      ).toThrow('initialState "NONEXISTENT" is not a valid state key');
    });
  });
});
