/**
 * CredentialManager — Async GitHub token resolution.
 *
 * Resolution chain: tokenOverride → GITHUB_TOKEN → GH_TOKEN → gh CLI
 * Instance-based (not static like CLI). No interactive OAuth. No execSync.
 */

import { execFile } from 'node:child_process';
import type { ILogger } from '../../../shared/logger.js';
import { ConfigurationError } from '../../../shared/errors/index.js';
import type { ICredentialManager } from './types.js';

/** Token format patterns */
const TOKEN_PATTERNS = {
  classic: /^ghp_[a-zA-Z0-9]{36}$/,
  fineGrained: /^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/,
  oauth: /^gho_[a-zA-Z0-9]{36}$/,
} as const;

export type TokenType = 'classic' | 'fine-grained' | 'oauth' | 'unknown';

export class CredentialManager implements ICredentialManager {
  private cachedToken: string | undefined;

  constructor(
    private readonly logger: ILogger,
    private readonly tokenOverride?: string,
  ) {}

  /**
   * Resolve a GitHub token through the chain.
   * Caches after first successful resolution.
   */
  async getToken(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;

    const token = await this.resolveToken();
    this.cachedToken = token;
    return token;
  }

  /**
   * Validate a token's format and identify its type.
   */
  static identifyTokenType(token: string): TokenType {
    if (TOKEN_PATTERNS.classic.test(token)) return 'classic';
    if (TOKEN_PATTERNS.fineGrained.test(token)) return 'fine-grained';
    if (TOKEN_PATTERNS.oauth.test(token)) return 'oauth';
    return 'unknown';
  }

  /**
   * Sanitize a token for safe logging (show first 4 chars + type).
   */
  static sanitizeForLogging(token: string): string {
    if (token.length < 8) return '***';
    const type = CredentialManager.identifyTokenType(token);
    return `${token.slice(0, 4)}...*** (${type})`;
  }

  private async resolveToken(): Promise<string> {
    // 1. Token override (from ServiceContainerConfig.githubToken)
    if (this.tokenOverride) {
      this.logger.debug('Using provided token override', {
        tokenType: CredentialManager.identifyTokenType(this.tokenOverride),
      });
      return this.tokenOverride;
    }

    // 2. GITHUB_TOKEN environment variable
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      this.logger.debug('Using GITHUB_TOKEN from environment', {
        tokenType: CredentialManager.identifyTokenType(githubToken),
      });
      return githubToken;
    }

    // 3. GH_TOKEN environment variable
    const ghToken = process.env.GH_TOKEN;
    if (ghToken) {
      this.logger.debug('Using GH_TOKEN from environment', {
        tokenType: CredentialManager.identifyTokenType(ghToken),
      });
      return ghToken;
    }

    // 4. gh CLI
    const cliToken = await this.getGitHubCliToken();
    if (cliToken) {
      this.logger.debug('Using token from gh CLI', {
        tokenType: CredentialManager.identifyTokenType(cliToken),
      });
      return cliToken;
    }

    // 5. Nothing found
    throw new ConfigurationError({
      message: 'No GitHub token found. Provide a token via GITHUB_TOKEN env var, GH_TOKEN env var, or install/authenticate the gh CLI.',
      remediation: 'Set GITHUB_TOKEN or GH_TOKEN environment variable, or run `gh auth login`.',
    });
  }

  private getGitHubCliToken(): Promise<string | null> {
    return new Promise((resolve) => {
      execFile('gh', ['auth', 'token'], { timeout: 10_000 }, (error, stdout) => {
        if (error) {
          this.logger.debug('gh CLI token lookup failed', {
            code: (error as NodeJS.ErrnoException).code,
          });
          resolve(null);
          return;
        }

        const token = stdout.trim();
        if (token.length > 0) {
          resolve(token);
        } else {
          resolve(null);
        }
      });
    });
  }
}
