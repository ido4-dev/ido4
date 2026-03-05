import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubGraphQLClient } from '../../../../src/infrastructure/github/core/graphql-client.js';
import { GitHubAPIError, RateLimitError, NotFoundError } from '../../../../src/shared/errors/index.js';
import { TestLogger } from '../../../helpers/test-logger.js';
import type { ICredentialManager, OctokitGraphQLError } from '../../../../src/infrastructure/github/core/types.js';

// Mock @octokit/graphql
vi.mock('@octokit/graphql', () => {
  const mockGraphql = vi.fn();
  mockGraphql.defaults = vi.fn(() => mockGraphql);
  return { graphql: mockGraphql };
});

import { graphql } from '@octokit/graphql';
const mockGraphql = vi.mocked(graphql);

function createMockCredentialManager(token = 'ghp_test1234567890abcdefghijklmnopqrstuv'): ICredentialManager {
  return { getToken: vi.fn().mockResolvedValue(token) };
}

/** Test subclass that overrides sleep to be instant */
class TestableGraphQLClient extends GitHubGraphQLClient {
  sleepCalls: number[] = [];

  protected override sleep(ms: number): Promise<void> {
    this.sleepCalls.push(ms);
    return Promise.resolve();
  }
}

describe('GitHubGraphQLClient', () => {
  let logger: TestLogger;
  let credentialManager: ICredentialManager;

  beforeEach(() => {
    logger = new TestLogger();
    credentialManager = createMockCredentialManager();
    vi.clearAllMocks();
    // Reset defaults mock to return the main mock
    (graphql.defaults as ReturnType<typeof vi.fn>).mockReturnValue(mockGraphql);
  });

  describe('query', () => {
    it('returns data on successful query', async () => {
      const expected = { repository: { name: 'test' } };
      mockGraphql.mockResolvedValueOnce(expected);

      const client = new TestableGraphQLClient(credentialManager, logger);
      const result = await client.query<typeof expected>('query { repository { name } }');

      expect(result).toEqual(expected);
    });

    it('passes sanitized variables to @octokit', async () => {
      mockGraphql.mockResolvedValueOnce({ data: true });

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.query('query ($a: String!) { node(id: $a) { id } }', {
        a: 'value',
        b: undefined,
        c: 'other',
      });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        { a: 'value', c: 'other' },
      );
    });
  });

  describe('mutate', () => {
    it('returns data on successful mutation', async () => {
      const expected = { updateField: { success: true } };
      mockGraphql.mockResolvedValueOnce(expected);

      const client = new TestableGraphQLClient(credentialManager, logger);
      const result = await client.mutate<typeof expected>('mutation { updateField { success } }');

      expect(result).toEqual(expected);
    });
  });

  describe('lazy initialization', () => {
    it('creates client on first call via credentialManager', async () => {
      mockGraphql.mockResolvedValueOnce({});

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.query('query { viewer { login } }');

      expect(credentialManager.getToken).toHaveBeenCalledOnce();
      expect(graphql.defaults).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: expect.stringContaining('token'),
          }),
        }),
      );
    });

    it('reuses client on subsequent calls', async () => {
      mockGraphql.mockResolvedValue({});

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.query('query { a }');
      await client.query('query { b }');

      expect(credentialManager.getToken).toHaveBeenCalledOnce();
    });
  });

  describe('retry logic', () => {
    it('retries on 500 server error', async () => {
      const error: OctokitGraphQLError = { message: 'Internal Server Error', status: 500 };
      const success = { data: 'recovered' };

      mockGraphql
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(success);

      const client = new TestableGraphQLClient(credentialManager, logger);
      const result = await client.query('query { test }');

      expect(result).toEqual(success);
      expect(mockGraphql).toHaveBeenCalledTimes(2);
    });

    it('retries on 502 bad gateway', async () => {
      const error: OctokitGraphQLError = { message: 'Bad Gateway', status: 502 };
      const success = { data: true };

      mockGraphql
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(success);

      const client = new TestableGraphQLClient(credentialManager, logger);
      const result = await client.query('query { test }');

      expect(result).toEqual(success);
    });

    it('retries on rate limit error', async () => {
      const error: OctokitGraphQLError = {
        message: 'rate limited',
        response: {
          errors: [{ message: 'rate limited', type: 'RATE_LIMITED' }],
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-limit': '5000',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          },
        },
      };
      const success = { data: true };

      mockGraphql
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(success);

      const client = new TestableGraphQLClient(credentialManager, logger);
      const result = await client.query('query { test }');

      expect(result).toEqual(success);
    });

    it('does NOT retry on 403 forbidden', async () => {
      const error: OctokitGraphQLError = {
        message: 'forbidden',
        response: {
          errors: [{ message: 'Resource not accessible', type: 'FORBIDDEN' }],
        },
      };

      mockGraphql.mockRejectedValueOnce(error);

      const client = new TestableGraphQLClient(credentialManager, logger);
      await expect(client.query('query { test }')).rejects.toThrow(GitHubAPIError);
      expect(mockGraphql).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on NOT_FOUND', async () => {
      const error: OctokitGraphQLError = {
        message: 'not found',
        response: {
          errors: [{ message: 'Not found', type: 'NOT_FOUND', path: ['repository'] }],
        },
      };

      mockGraphql.mockRejectedValueOnce(error);

      const client = new TestableGraphQLClient(credentialManager, logger);
      await expect(client.query('query { test }')).rejects.toThrow(NotFoundError);
      expect(mockGraphql).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries then maps error', async () => {
      const error: OctokitGraphQLError = { message: 'Server Error', status: 500 };

      mockGraphql.mockRejectedValue(error);

      const client = new TestableGraphQLClient(credentialManager, logger, { maxRetries: 2 });
      await expect(client.query('query { test }')).rejects.toThrow(GitHubAPIError);

      // initial + 2 retries = 3 attempts
      expect(mockGraphql).toHaveBeenCalledTimes(3);
    });

    it('uses exponential backoff with increasing delays', async () => {
      const error: OctokitGraphQLError = { message: 'Server Error', status: 500 };
      mockGraphql.mockRejectedValue(error);

      // Use fixed jitter for predictable test
      const client = new TestableGraphQLClient(credentialManager, logger, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 8000,
        jitterFactor: 0, // no jitter for deterministic test
      });

      await expect(client.query('query { test }')).rejects.toThrow();

      // Should have 3 sleep calls with increasing delays
      expect(client.sleepCalls).toHaveLength(3);
      expect(client.sleepCalls[0]).toBe(1000); // 1000 * 2^0
      expect(client.sleepCalls[1]).toBe(2000); // 1000 * 2^1
      expect(client.sleepCalls[2]).toBe(4000); // 1000 * 2^2
    });

    it('caps delay at maxDelayMs', async () => {
      const error: OctokitGraphQLError = { message: 'Server Error', status: 500 };
      mockGraphql.mockRejectedValue(error);

      const client = new TestableGraphQLClient(credentialManager, logger, {
        maxRetries: 4,
        baseDelayMs: 1000,
        maxDelayMs: 4000,
        jitterFactor: 0,
      });

      await expect(client.query('query { test }')).rejects.toThrow();

      expect(client.sleepCalls[0]).toBe(1000);
      expect(client.sleepCalls[1]).toBe(2000);
      expect(client.sleepCalls[2]).toBe(4000); // capped
      expect(client.sleepCalls[3]).toBe(4000); // stays capped
    });
  });

  describe('queryWithHeaders', () => {
    it('passes custom headers to @octokit', async () => {
      mockGraphql.mockResolvedValueOnce({ data: true });

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.queryWithHeaders('query { test }', {}, {
        'GraphQL-Features': 'sub_issues',
      });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'GraphQL-Features': 'sub_issues' },
        }),
      );
    });
  });

  describe('queryAllPages', () => {
    it('fetches all pages and concatenates results', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          items: { nodes: [{ id: 1 }, { id: 2 }], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
        })
        .mockResolvedValueOnce({
          items: { nodes: [{ id: 3 }], pageInfo: { hasNextPage: false, endCursor: null } },
        });

      const client = new TestableGraphQLClient(credentialManager, logger);
      const results = await client.queryAllPages<{ id: number }>(
        'query ($first: Int!, $after: String) { items { nodes { id } pageInfo { hasNextPage endCursor } } }',
        {},
        (data) => (data as { items: { nodes: { id: number }[] } }).items.nodes,
        (data) => (data as { items: { pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).items.pageInfo,
      );

      expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(mockGraphql).toHaveBeenCalledTimes(2);
    });

    it('stops at maxPages safety cap', async () => {
      // Always returns hasNextPage: true
      mockGraphql.mockResolvedValue({
        items: { nodes: [{ id: 1 }], pageInfo: { hasNextPage: true, endCursor: 'next' } },
      });

      const client = new TestableGraphQLClient(credentialManager, logger);
      const results = await client.queryAllPages<{ id: number }>(
        'query { items { nodes { id } pageInfo { hasNextPage endCursor } } }',
        {},
        (data) => (data as { items: { nodes: { id: number }[] } }).items.nodes,
        (data) => (data as { items: { pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).items.pageInfo,
        { maxPages: 3 },
      );

      expect(results).toHaveLength(3);
      expect(mockGraphql).toHaveBeenCalledTimes(3);
    });

    it('passes cursor to subsequent pages', async () => {
      mockGraphql
        .mockResolvedValueOnce({
          items: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'cursor_abc' } },
        })
        .mockResolvedValueOnce({
          items: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
        });

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.queryAllPages<unknown>(
        'query ($first: Int!, $after: String) { items { nodes { id } } }',
        { owner: 'test' },
        (data) => (data as { items: { nodes: unknown[] } }).items.nodes,
        (data) => (data as { items: { pageInfo: { hasNextPage: boolean; endCursor: string | null } } }).items.pageInfo,
      );

      // Second call should include cursor
      expect(mockGraphql).toHaveBeenCalledTimes(2);
      const secondCallVars = mockGraphql.mock.calls[1][1] as Record<string, unknown>;
      expect(secondCallVars.after).toBe('cursor_abc');
    });
  });

  describe('preemptive throttle', () => {
    it('throttles when remaining is low', async () => {
      // First call: trigger rate limit response with low remaining
      const rateLimitError: OctokitGraphQLError = {
        message: 'error',
        status: 500,
        response: {
          headers: {
            'x-ratelimit-remaining': '2',
            'x-ratelimit-limit': '5000',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 5),
          },
        },
      };

      mockGraphql
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: 'ok' })
        .mockResolvedValueOnce({ next: 'call' });

      const client = new TestableGraphQLClient(credentialManager, logger);

      // First call will fail and update rate limit state
      const result = await client.query('query { test }');
      expect(result).toEqual({ data: 'ok' });

      // Second call should trigger preemptive throttle
      await client.query('query { test2 }');

      // Verify throttle sleep was called (between error retry sleep and preemptive)
      expect(client.sleepCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('variable sanitization', () => {
    it('strips undefined values from variables', async () => {
      mockGraphql.mockResolvedValueOnce({});

      const client = new TestableGraphQLClient(credentialManager, logger);
      await client.query('query { test }', {
        keep: 'value',
        remove: undefined,
        alsoKeep: null,
        zero: 0,
        empty: '',
      });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        { keep: 'value', alsoKeep: null, zero: 0, empty: '' },
      );
    });
  });
});
