/**
 * GitWorkflowConfig — Implements IGitWorkflowConfig with Zod schema validation.
 *
 * Loads from .ido4/git-workflow.json. Private constructor — use load() or create().
 */

import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IGitWorkflowConfig } from '../container/interfaces.js';
import { ConfigurationError } from '../shared/errors/index.js';

const GitWorkflowSchema = z.object({
  enabled: z.boolean(),
  require_pr_for_review: z.boolean(),
  show_git_suggestions: z.boolean(),
  detect_git_context: z.boolean(),
});

type GitWorkflowData = z.infer<typeof GitWorkflowSchema>;

const DEFAULT_CONFIG: GitWorkflowData = {
  enabled: true,
  require_pr_for_review: true,
  show_git_suggestions: true,
  detect_git_context: true,
};

const CONFIG_FILE = '.ido4/git-workflow.json';

export class GitWorkflowConfig implements IGitWorkflowConfig {
  private readonly config: GitWorkflowData;

  private constructor(config: GitWorkflowData) {
    this.config = config;
  }

  /**
   * Load from projectRoot/.ido4/git-workflow.json.
   * Returns defaults if file doesn't exist.
   */
  static async load(projectRoot: string): Promise<GitWorkflowConfig> {
    const configPath = path.join(projectRoot, CONFIG_FILE);

    let rawContent: string;
    try {
      rawContent = await fs.readFile(configPath, 'utf-8');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return new GitWorkflowConfig({ ...DEFAULT_CONFIG });
      }
      throw new ConfigurationError({
        message: `Failed to read git workflow configuration: ${error.message}`,
        configFile: configPath,
        remediation: 'Check file permissions or delete the file to use defaults',
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new ConfigurationError({
        message: 'Git workflow configuration contains invalid JSON',
        configFile: configPath,
        remediation: 'Fix the JSON syntax or delete the file to use defaults',
      });
    }

    const result = GitWorkflowSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new ConfigurationError({
        message: `Invalid git workflow configuration: ${issues}`,
        configFile: configPath,
        remediation: 'Fix the configuration or delete the file to use defaults',
      });
    }

    return new GitWorkflowConfig(result.data);
  }

  /** Create from a plain object (for testing). */
  static create(config: Partial<GitWorkflowData> = {}): GitWorkflowConfig {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const result = GitWorkflowSchema.safeParse(merged);
    if (!result.success) {
      throw new ConfigurationError({
        message: `Invalid git workflow config: ${result.error.message}`,
        remediation: 'Provide valid boolean values for all fields',
      });
    }
    return new GitWorkflowConfig(result.data);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  requiresPRForReview(): boolean {
    return this.config.enabled && this.config.require_pr_for_review;
  }

  shouldShowGitSuggestions(): boolean {
    return this.config.enabled && this.config.show_git_suggestions;
  }

  shouldDetectGitContext(): boolean {
    return this.config.enabled && this.config.detect_git_context;
  }

  toJSON(): GitWorkflowData {
    return { ...this.config };
  }
}
