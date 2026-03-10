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
});
