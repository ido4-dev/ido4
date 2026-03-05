/**
 * ProjectConfigLoader — Load and validate project configuration from .ido4/project-info.json.
 *
 * Changes from CLI:
 * - load() takes explicit projectRoot path (not process.cwd())
 * - Uses scaffold's ConfigurationError
 * - Zod schema validation
 */

import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ConfigurationError } from '../shared/errors/index.js';
import type { IProjectConfig } from '../container/interfaces.js';

const ProjectConfigSchema = z.object({
  project: z.object({
    id: z.string().startsWith('PVT_'),
    number: z.number().int().positive(),
    repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/),
    title: z.string().optional(),
  }),
  fields: z.object({
    status_field_id: z.string().min(1),
    wave_field_id: z.string().min(1),
    epic_field_id: z.string().min(1),
    dependencies_field_id: z.string().min(1),
    ai_suitability_field_id: z.string().min(1),
    risk_level_field_id: z.string().min(1),
    effort_field_id: z.string().min(1),
    ai_context_field_id: z.string().min(1),
  }).passthrough(),
  status_options: z.record(
    z.object({ name: z.string(), id: z.string() }),
  ),
  ai_suitability_options: z.record(
    z.object({ name: z.string(), id: z.string() }),
  ).optional(),
  risk_level_options: z.record(
    z.object({ name: z.string(), id: z.string() }),
  ).optional(),
  effort_options: z.record(
    z.object({ name: z.string(), id: z.string() }),
  ).optional(),
  task_type_options: z.record(
    z.object({ name: z.string(), id: z.string() }),
  ).optional(),
  wave_config: z.object({
    format: z.string(),
    autoDetect: z.boolean(),
  }).optional(),
});

const REQUIRED_STATUSES = [
  'BACKLOG',
  'IN_REFINEMENT',
  'READY_FOR_DEV',
  'BLOCKED',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
] as const;

const CONFIG_FILE = '.ido4/project-info.json';

export class ProjectConfigLoader {
  /**
   * Load project configuration from projectRoot/.ido4/project-info.json.
   *
   * @param projectRoot - Absolute path to project root directory
   * @throws ConfigurationError if file missing, unreadable, or invalid
   */
  static async load(projectRoot: string): Promise<IProjectConfig> {
    const configPath = path.join(projectRoot, CONFIG_FILE);

    let rawContent: string;
    try {
      rawContent = await fs.readFile(configPath, 'utf-8');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        throw new ConfigurationError({
          message: `Project configuration not found at ${configPath}`,
          configFile: configPath,
          remediation: `Run project initialization to create ${CONFIG_FILE}`,
        });
      }
      throw new ConfigurationError({
        message: `Failed to read project configuration: ${error.message}`,
        configFile: configPath,
        remediation: 'Check file permissions and try again',
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new ConfigurationError({
        message: 'Project configuration contains invalid JSON',
        configFile: configPath,
        remediation: 'Fix the JSON syntax in the configuration file',
      });
    }

    const result = ProjectConfigSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new ConfigurationError({
        message: `Invalid project configuration: ${issues}`,
        configFile: configPath,
        remediation: 'Fix the configuration file according to the schema',
      });
    }

    // Validate required statuses
    const missingStatuses = REQUIRED_STATUSES.filter(
      (s) => !result.data.status_options[s],
    );
    if (missingStatuses.length > 0) {
      throw new ConfigurationError({
        message: `Missing required status options: ${missingStatuses.join(', ')}`,
        configFile: configPath,
        remediation: 'Add the missing status options to the configuration',
      });
    }

    // Cast fields to satisfy the index signature — Zod passthrough produces
    // Record<string, unknown> for extra keys, but we know all values are strings
    // because the schema validates the known keys and passthrough only allows
    // what the JSON parser produces (strings).
    const config: IProjectConfig = {
      ...result.data,
      fields: result.data.fields as IProjectConfig['fields'],
    };

    return config;
  }
}
