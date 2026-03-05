import { describe, it, expect } from 'vitest';
import { GraphQLErrorMapper } from '../../../../src/infrastructure/github/core/error-mapper.js';
import { GitHubAPIError, RateLimitError, NotFoundError } from '../../../../src/shared/errors/index.js';
import type { OctokitGraphQLError } from '../../../../src/infrastructure/github/core/types.js';

describe('GraphQLErrorMapper', () => {
  describe('mapError', () => {
    it('maps RATE_LIMITED error to RateLimitError', () => {
      const error: OctokitGraphQLError = {
        message: 'rate limited',
        response: {
          errors: [{ message: 'API rate limit exceeded', type: 'RATE_LIMITED' }],
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-limit': '5000',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          },
        },
      };

      expect(() => GraphQLErrorMapper.mapError(error, 'query')).toThrow(RateLimitError);
    });

    it('maps NOT_FOUND error to NotFoundError', () => {
      const error: OctokitGraphQLError = {
        message: 'not found',
        response: {
          errors: [{
            message: 'Could not resolve to a Repository',
            type: 'NOT_FOUND',
            path: ['repository'],
          }],
        },
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundError);
        expect((e as NotFoundError).context.resource).toBe('repository');
      }
    });

    it('maps FORBIDDEN error to GitHubAPIError with statusCode 403', () => {
      const error: OctokitGraphQLError = {
        message: 'forbidden',
        response: {
          errors: [{ message: 'Resource not accessible by integration', type: 'FORBIDDEN' }],
        },
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).statusCode).toBe(403);
        expect((e as GitHubAPIError).retryable).toBe(false);
      }
    });

    it('maps UNPROCESSABLE error to GitHubAPIError with statusCode 422', () => {
      const error: OctokitGraphQLError = {
        message: 'unprocessable',
        response: {
          errors: [{ message: 'Variable invalid', type: 'UNPROCESSABLE' }],
        },
      };

      try {
        GraphQLErrorMapper.mapError(error, 'mutate');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).statusCode).toBe(422);
        expect((e as GitHubAPIError).retryable).toBe(false);
      }
    });

    it('maps generic GraphQL error to GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'something failed',
        response: {
          errors: [{ message: 'Internal error', type: 'INTERNAL' }],
        },
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).message).toBe('Internal error');
      }
    });

    it('maps ENOTFOUND network error to retryable GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'getaddrinfo ENOTFOUND api.github.com',
        code: 'ENOTFOUND',
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).retryable).toBe(true);
      }
    });

    it('maps ECONNREFUSED to retryable GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'connect ECONNREFUSED',
        code: 'ECONNREFUSED',
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).retryable).toBe(true);
      }
    });

    it('maps ETIMEDOUT to retryable GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'request timed out',
        code: 'ETIMEDOUT',
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).retryable).toBe(true);
      }
    });

    it('maps HTTP 500 status to retryable GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'Server error',
        status: 500,
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).statusCode).toBe(500);
        expect((e as GitHubAPIError).retryable).toBe(true);
      }
    });

    it('maps HTTP 401 status to non-retryable GitHubAPIError', () => {
      const error: OctokitGraphQLError = {
        message: 'Bad credentials',
        status: 401,
      };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).statusCode).toBe(401);
        expect((e as GitHubAPIError).retryable).toBe(false);
      }
    });

    it('maps HTTP 429 status to RateLimitError', () => {
      const error: OctokitGraphQLError = {
        message: 'rate limited',
        status: 429,
        response: { headers: {} },
      };

      expect(() => GraphQLErrorMapper.mapError(error, 'query')).toThrow(RateLimitError);
    });

    it('maps unknown error to GitHubAPIError', () => {
      const error = { unexpected: true };

      try {
        GraphQLErrorMapper.mapError(error, 'query');
      } catch (e) {
        expect(e).toBeInstanceOf(GitHubAPIError);
        expect((e as GitHubAPIError).message).toContain('Unexpected');
      }
    });

    it('preserves original error as cause when it is an Error', () => {
      const original = new Error('original');
      (original as OctokitGraphQLError).status = 503;

      try {
        GraphQLErrorMapper.mapError(original, 'query');
      } catch (e) {
        expect((e as GitHubAPIError).cause).toBe(original);
      }
    });
  });

  describe('extractRateLimitState', () => {
    it('parses valid rate limit headers', () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 3600;
      const result = GraphQLErrorMapper.extractRateLimitState({
        'x-ratelimit-remaining': '42',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': String(resetUnix),
      });

      expect(result).not.toBeNull();
      expect(result!.remaining).toBe(42);
      expect(result!.limit).toBe(5000);
      expect(result!.resetAt.getTime()).toBe(resetUnix * 1000);
    });

    it('returns null when headers are missing', () => {
      expect(GraphQLErrorMapper.extractRateLimitState({})).toBeNull();
    });

    it('returns null when headers have non-numeric values', () => {
      expect(GraphQLErrorMapper.extractRateLimitState({
        'x-ratelimit-remaining': 'abc',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': '123',
      })).toBeNull();
    });
  });

  describe('isRetryable', () => {
    it('returns true for RateLimitError', () => {
      const error = new RateLimitError({
        message: 'rate limited',
        resetAt: new Date(),
      });
      expect(GraphQLErrorMapper.isRetryable(error)).toBe(true);
    });

    it('returns true for retryable GitHubAPIError', () => {
      const error = new GitHubAPIError({
        message: 'server error',
        statusCode: 500,
        retryable: true,
      });
      expect(GraphQLErrorMapper.isRetryable(error)).toBe(true);
    });

    it('returns false for non-retryable GitHubAPIError', () => {
      const error = new GitHubAPIError({
        message: 'forbidden',
        statusCode: 403,
        retryable: false,
      });
      expect(GraphQLErrorMapper.isRetryable(error)).toBe(false);
    });

    it('returns true for network error codes', () => {
      expect(GraphQLErrorMapper.isRetryable({ code: 'ENOTFOUND', message: '' })).toBe(true);
      expect(GraphQLErrorMapper.isRetryable({ code: 'ECONNREFUSED', message: '' })).toBe(true);
      expect(GraphQLErrorMapper.isRetryable({ code: 'ETIMEDOUT', message: '' })).toBe(true);
    });

    it('returns true for 5xx status', () => {
      expect(GraphQLErrorMapper.isRetryable({ status: 500, message: '' })).toBe(true);
      expect(GraphQLErrorMapper.isRetryable({ status: 502, message: '' })).toBe(true);
    });

    it('returns false for 4xx status (non-429)', () => {
      expect(GraphQLErrorMapper.isRetryable({ status: 403, message: '' })).toBe(false);
      expect(GraphQLErrorMapper.isRetryable({ status: 404, message: '' })).toBe(false);
    });

    it('returns true for RATE_LIMITED GraphQL error type', () => {
      expect(GraphQLErrorMapper.isRetryable({
        message: '',
        response: { errors: [{ message: '', type: 'RATE_LIMITED' }] },
      })).toBe(true);
    });

    it('returns false for unknown error shape', () => {
      expect(GraphQLErrorMapper.isRetryable({})).toBe(false);
      expect(GraphQLErrorMapper.isRetryable(null)).toBe(false);
    });
  });
});
