import { describe, it, expect } from 'vitest';
import { handleErrors } from '../../src/helpers/error-handler.js';
import { toCallToolResult } from '../../src/helpers/response.js';
import {
  ValidationError,
  NotFoundError,
  GitHubAPIError,
  RateLimitError,
  BusinessRuleError,
  ConfigurationError,
} from '@ido4/core';

describe('handleErrors', () => {
  it('passes through successful results', async () => {
    const result = await handleErrors(async () => toCallToolResult({ ok: true }));
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.ok).toBe(true);
  });

  it('handles ValidationError', async () => {
    const result = await handleErrors(async () => {
      throw new ValidationError({ message: 'Invalid transition', remediation: 'Use a valid status' });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.message).toBe('Invalid transition');
    expect(parsed.code).toBe('VALIDATION_ERROR');
    expect(parsed.remediation).toBe('Use a valid status');
  });

  it('handles NotFoundError', async () => {
    const result = await handleErrors(async () => {
      throw new NotFoundError({ message: 'Issue not found', resource: 'issue', identifier: 999 });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('NOT_FOUND');
  });

  it('handles GitHubAPIError with retryable flag', async () => {
    const result = await handleErrors(async () => {
      throw new GitHubAPIError({ message: 'Server error', statusCode: 502, retryable: true });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('GITHUB_API_ERROR');
    expect(parsed.retryable).toBe(true);
  });

  it('handles RateLimitError', async () => {
    const result = await handleErrors(async () => {
      throw new RateLimitError({
        message: 'Rate limited',
        resetAt: new Date('2025-01-01T12:00:00Z'),
      });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.retryable).toBe(true);
    expect(parsed.remediation).toContain('2025-01-01');
  });

  it('handles BusinessRuleError', async () => {
    const result = await handleErrors(async () => {
      throw new BusinessRuleError({
        message: 'Epic integrity violation',
        rule: 'EPIC_INTEGRITY',
        remediation: 'Move all epic tasks to the same wave',
      });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(parsed.remediation).toBe('Move all epic tasks to the same wave');
  });

  it('handles ConfigurationError', async () => {
    const result = await handleErrors(async () => {
      throw new ConfigurationError({ message: 'Missing config', configFile: '.ido4/project-info.json' });
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('CONFIGURATION_ERROR');
  });

  it('handles generic Error', async () => {
    const result = await handleErrors(async () => {
      throw new Error('Something unexpected');
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.message).toBe('Something unexpected');
    expect(parsed.code).toBe('INTERNAL_ERROR');
  });

  it('handles non-Error throws', async () => {
    const result = await handleErrors(async (): Promise<ReturnType<typeof toCallToolResult>> => {
      throw 'string error';
    });
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.message).toBe('Unknown error');
    expect(parsed.code).toBe('INTERNAL_ERROR');
  });
});
