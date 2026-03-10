/**
 * ProfileConfigLoader — Loads methodology profile from project configuration.
 *
 * Reads `.ido4/methodology-profile.json`, resolves `extends` via ProfileRegistry,
 * and validates. Throws if no profile file exists — a methodology profile is required.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { MethodologyProfile, MethodologyProfileFile } from '../profiles/types.js';
import { ProfileRegistry } from '../profiles/registry.js';
import { ConfigurationError } from '../shared/errors/index.js';

export class ProfileConfigLoader {
  static async load(projectRoot: string): Promise<MethodologyProfile> {
    const configPath = path.join(projectRoot, '.ido4', 'methodology-profile.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return ProfileConfigLoader.parse(content, configPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ConfigurationError({
          message: 'Methodology profile not found. A .ido4/methodology-profile.json file is required.',
          context: { configPath },
          remediation: 'Run project initialization to create a methodology profile, or create .ido4/methodology-profile.json manually.',
        });
      }
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError({
        message: `Failed to load methodology profile: ${error instanceof Error ? error.message : String(error)}`,
        context: { configPath },
        remediation: 'Fix the methodology-profile.json file.',
      });
    }
  }

  private static parse(content: string, configPath: string): MethodologyProfile {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ConfigurationError({
        message: 'Invalid JSON in methodology profile',
        context: { configPath },
        remediation: 'Fix the JSON syntax in methodology-profile.json.',
      });
    }

    const file = parsed as MethodologyProfileFile;

    if (!file.id) {
      throw new ConfigurationError({
        message: 'Methodology profile missing required "id" field',
        context: { configPath },
        remediation: 'Add an "id" field to methodology-profile.json.',
      });
    }

    return ProfileRegistry.resolve(file);
  }
}
