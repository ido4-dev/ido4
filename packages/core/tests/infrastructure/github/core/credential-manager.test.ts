import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialManager } from '../../../../src/infrastructure/github/core/credential-manager.js';
import { ConfigurationError } from '../../../../src/shared/errors/index.js';
import { TestLogger } from '../../../helpers/test-logger.js';

// Mock child_process.execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
const mockExecFile = vi.mocked(execFile);

describe('CredentialManager', () => {
  let logger: TestLogger;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    logger = new TestLogger();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN;
    process.env.GH_TOKEN = originalEnv.GH_TOKEN;
  });

  describe('getToken', () => {
    it('returns tokenOverride when provided', async () => {
      const cm = new CredentialManager(logger, 'ghp_override123456789012345678901234567890');

      const token = await cm.getToken();
      expect(token).toBe('ghp_override123456789012345678901234567890');
    });

    it('does not check env or CLI when override is provided', async () => {
      process.env.GITHUB_TOKEN = 'ghp_env_token';
      const cm = new CredentialManager(logger, 'ghp_override123456789012345678901234567890');

      const token = await cm.getToken();
      expect(token).toBe('ghp_override123456789012345678901234567890');
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('reads GITHUB_TOKEN from env when no override', async () => {
      process.env.GITHUB_TOKEN = 'ghp_envtoken12345678901234567890123456';
      const cm = new CredentialManager(logger);

      const token = await cm.getToken();
      expect(token).toBe('ghp_envtoken12345678901234567890123456');
    });

    it('reads GH_TOKEN as fallback when GITHUB_TOKEN not set', async () => {
      process.env.GH_TOKEN = 'ghp_ghtoken123456789012345678901234567';
      const cm = new CredentialManager(logger);

      const token = await cm.getToken();
      expect(token).toBe('ghp_ghtoken123456789012345678901234567');
    });

    it('prefers GITHUB_TOKEN over GH_TOKEN', async () => {
      process.env.GITHUB_TOKEN = 'ghp_first_token2345678901234567890123';
      process.env.GH_TOKEN = 'ghp_second_token234567890123456789012';
      const cm = new CredentialManager(logger);

      const token = await cm.getToken();
      expect(token).toBe('ghp_first_token2345678901234567890123');
    });

    it('falls back to gh CLI when no env vars set', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, 'ghp_clitoken1234567890123456789012345\n', '');
        return {} as ReturnType<typeof execFile>;
      });

      const cm = new CredentialManager(logger);
      const token = await cm.getToken();
      expect(token).toBe('ghp_clitoken1234567890123456789012345');
      expect(mockExecFile).toHaveBeenCalledWith(
        'gh', ['auth', 'token'],
        expect.objectContaining({ timeout: 10_000 }),
        expect.any(Function),
      );
    });

    it('throws ConfigurationError when no token found anywhere', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error('gh not found'), '', '');
        return {} as ReturnType<typeof execFile>;
      });

      const cm = new CredentialManager(logger);
      await expect(cm.getToken()).rejects.toThrow(ConfigurationError);
    });

    it('caches token after first resolution', async () => {
      process.env.GITHUB_TOKEN = 'ghp_cached_token234567890123456789012';
      const cm = new CredentialManager(logger);

      const token1 = await cm.getToken();
      delete process.env.GITHUB_TOKEN;
      const token2 = await cm.getToken();

      expect(token1).toBe(token2);
      expect(token2).toBe('ghp_cached_token234567890123456789012');
    });

    it('handles gh CLI returning empty stdout', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, '', '');
        return {} as ReturnType<typeof execFile>;
      });

      const cm = new CredentialManager(logger);
      await expect(cm.getToken()).rejects.toThrow(ConfigurationError);
    });
  });

  describe('identifyTokenType', () => {
    it('identifies classic token', () => {
      expect(CredentialManager.identifyTokenType('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe('classic');
    });

    it('identifies fine-grained token', () => {
      const pat = 'github_pat_' + 'a'.repeat(22) + '_' + 'b'.repeat(59);
      expect(CredentialManager.identifyTokenType(pat)).toBe('fine-grained');
    });

    it('identifies OAuth token', () => {
      expect(CredentialManager.identifyTokenType('gho_abcdefghijklmnopqrstuvwxyz1234567890')).toBe('oauth');
    });

    it('returns unknown for unrecognized format', () => {
      expect(CredentialManager.identifyTokenType('some_random_token')).toBe('unknown');
    });
  });

  describe('sanitizeForLogging', () => {
    it('shows prefix and type for valid token', () => {
      const result = CredentialManager.sanitizeForLogging('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      expect(result).toContain('ghp_');
      expect(result).toContain('classic');
      expect(result).not.toContain('abcdefghij');
    });

    it('returns masked value for short token', () => {
      expect(CredentialManager.sanitizeForLogging('short')).toBe('***');
    });
  });
});
