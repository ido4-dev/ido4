import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProfileConfigLoader } from '../../src/config/profile-loader.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';

describe('ProfileConfigLoader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-loader-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('throws ConfigurationError when no profile file exists', async () => {
    await expect(ProfileConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('loads and validates a custom profile that extends hydro', async () => {
    const customProfile = {
      extends: 'hydro',
      id: 'my-hydro',
      name: 'My Custom Hydro',
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify(customProfile),
    );

    const profile = await ProfileConfigLoader.load(tmpDir);
    expect(profile.id).toBe('my-hydro');
    expect(profile.name).toBe('My Custom Hydro');
    // Inherits everything else from HYDRO
    expect(profile.states).toEqual(HYDRO_PROFILE.states);
    expect(profile.transitions).toEqual(HYDRO_PROFILE.transitions);
    expect(profile.pipelines).toEqual(HYDRO_PROFILE.pipelines);
  });

  it('resolves extends: "scrum" via ProfileRegistry', async () => {
    const customProfile = {
      extends: 'scrum',
      id: 'my-scrum',
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify(customProfile),
    );

    const profile = await ProfileConfigLoader.load(tmpDir);
    expect(profile.id).toBe('my-scrum');
    expect(profile.states).toEqual(SCRUM_PROFILE.states);
    expect(profile.transitions).toEqual(SCRUM_PROFILE.transitions);
  });

  it('deep-merges: arrays are replaced, objects are merged', async () => {
    const customProfile = {
      extends: 'hydro',
      id: 'custom-hydro',
      semantics: {
        readyStates: ['READY_FOR_DEV', 'IN_REFINEMENT'],
      },
    };

    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify(customProfile),
    );

    const profile = await ProfileConfigLoader.load(tmpDir);
    // semantics is merged (spread), so readyStates overrides but other fields remain
    expect(profile.semantics.readyStates).toEqual(['READY_FOR_DEV', 'IN_REFINEMENT']);
    expect(profile.semantics.initialState).toBe('BACKLOG');
    expect(profile.semantics.terminalStates).toEqual(['DONE']);
  });

  it('rejects invalid JSON', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      '{not valid json!!!',
    );

    await expect(ProfileConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('rejects profile file missing id field', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify({ name: 'No ID' }),
    );

    await expect(ProfileConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('rejects profile extending unknown base', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify({ id: 'bad', extends: 'nonexistent-profile' }),
    );

    await expect(ProfileConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });

  it('rejects standalone profile without required fields', async () => {
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.ido4', 'methodology-profile.json'),
      JSON.stringify({ id: 'standalone-incomplete', name: 'Bad' }),
    );

    await expect(ProfileConfigLoader.load(tmpDir))
      .rejects.toThrow(ConfigurationError);
  });
});
