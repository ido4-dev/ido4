/**
 * GraphQLErrorMapper — Classifies @octokit/graphql errors into ido4 error types.
 *
 * Centralizes all error classification so the GraphQL client and repositories
 * don't need to understand raw @octokit error shapes.
 */

import { GitHubAPIError, RateLimitError, NotFoundError } from '../../../shared/errors/index.js';
import type { RateLimitState, OctokitGraphQLError } from './types.js';

export class GraphQLErrorMapper {
  /**
   * Map an @octokit/graphql error to the appropriate ido4 error.
   * Always throws — never returns.
   */
  static mapError(error: unknown, operation: string): never {
    const gqlError = error as OctokitGraphQLError;

    // 1. GraphQL-level errors (response.errors array)
    const firstError = gqlError?.response?.errors?.[0];
    if (firstError) {
      const errorType = firstError.type;
      const headers = gqlError.response?.headers ?? {};

      if (errorType === 'RATE_LIMITED') {
        const resetAt = GraphQLErrorMapper.parseResetDate(headers);
        throw new RateLimitError({
          message: `GitHub API rate limit exceeded during ${operation}`,
          resetAt,
          context: {
            operation,
            remaining: GraphQLErrorMapper.parseHeader(headers, 'x-ratelimit-remaining'),
          },
        });
      }

      if (errorType === 'NOT_FOUND') {
        const resourcePath = firstError.path?.join('.') ?? 'unknown';
        throw new NotFoundError({
          message: firstError.message || `Resource not found during ${operation}`,
          resource: resourcePath,
          identifier: resourcePath,
          remediation: 'Verify the resource exists and you have access.',
        });
      }

      if (errorType === 'FORBIDDEN') {
        throw new GitHubAPIError({
          message: firstError.message || `Access forbidden during ${operation}`,
          statusCode: 403,
          retryable: false,
          context: { operation },
          remediation: 'Check your token permissions.',
        });
      }

      if (errorType === 'UNPROCESSABLE') {
        throw new GitHubAPIError({
          message: firstError.message || `Unprocessable entity during ${operation}`,
          statusCode: 422,
          retryable: false,
          context: {
            operation,
            errors: gqlError.response?.errors?.map((e) => e.message),
          },
          remediation: 'Check the request parameters.',
        });
      }

      // Generic GraphQL error with errors array
      throw new GitHubAPIError({
        message: firstError.message || `GitHub API error during ${operation}`,
        statusCode: gqlError.response?.status,
        retryable: false,
        context: { operation, errorType },
        cause: error instanceof Error ? error : undefined,
      });
    }

    // 2. Network errors
    const code = gqlError?.code;
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
      throw new GitHubAPIError({
        message: `Network error during ${operation}: ${gqlError.message || code}`,
        retryable: true,
        context: { operation, code },
        remediation: 'Check your network connection.',
        cause: error instanceof Error ? error : undefined,
      });
    }

    // 3. Timeout errors
    if (code === 'TIMEOUT' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      throw new GitHubAPIError({
        message: `Request timed out during ${operation}`,
        retryable: true,
        context: { operation, code },
        remediation: 'The request may succeed on retry.',
        cause: error instanceof Error ? error : undefined,
      });
    }

    // 4. HTTP status errors (e.g., 5xx from response)
    const status = gqlError?.status ?? gqlError?.response?.status;
    if (typeof status === 'number') {
      if (status === 401) {
        throw new GitHubAPIError({
          message: `Authentication failed during ${operation}`,
          statusCode: 401,
          retryable: false,
          context: { operation },
          remediation: 'Check your GitHub token is valid and not expired.',
          cause: error instanceof Error ? error : undefined,
        });
      }

      if (status === 429) {
        const headers = gqlError?.response?.headers ?? {};
        const resetAt = GraphQLErrorMapper.parseResetDate(headers);
        throw new RateLimitError({
          message: `GitHub API rate limit exceeded during ${operation}`,
          resetAt,
          context: { operation },
        });
      }

      throw new GitHubAPIError({
        message: gqlError.message || `HTTP ${status} error during ${operation}`,
        statusCode: status,
        retryable: status >= 500,
        context: { operation },
        cause: error instanceof Error ? error : undefined,
      });
    }

    // 5. Unknown error shape
    const message = gqlError?.message ?? (error instanceof Error ? error.message : 'Unknown error');
    throw new GitHubAPIError({
      message: `Unexpected GitHub API error during ${operation}: ${message}`,
      retryable: false,
      context: { operation },
      cause: error instanceof Error ? error : undefined,
    });
  }

  /**
   * Extract rate limit state from response headers.
   * Returns null if the required headers are missing.
   */
  static extractRateLimitState(headers: Record<string, string>): RateLimitState | null {
    const remaining = GraphQLErrorMapper.parseHeader(headers, 'x-ratelimit-remaining');
    const limit = GraphQLErrorMapper.parseHeader(headers, 'x-ratelimit-limit');
    const resetUnix = GraphQLErrorMapper.parseHeader(headers, 'x-ratelimit-reset');

    if (remaining === null || limit === null || resetUnix === null) {
      return null;
    }

    return {
      remaining,
      limit,
      resetAt: new Date(resetUnix * 1000),
    };
  }

  /**
   * Determine if an error is retryable.
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof RateLimitError) return true;
    if (error instanceof GitHubAPIError) return error.retryable;

    const gqlError = error as OctokitGraphQLError;

    // Check for retryable error codes
    const code = gqlError?.code;
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET' ||
        code === 'TIMEOUT' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      return true;
    }

    // Check for retryable HTTP status
    const status = gqlError?.status ?? gqlError?.response?.status;
    if (typeof status === 'number') {
      return status === 429 || status >= 500;
    }

    // Check for rate limit in GraphQL errors
    const errorType = gqlError?.response?.errors?.[0]?.type;
    if (errorType === 'RATE_LIMITED') return true;

    return false;
  }

  /** Parse a numeric header value. Returns null if missing or unparsable. */
  private static parseHeader(headers: Record<string, string>, name: string): number | null {
    const value = headers[name];
    if (value === undefined || value === null) return null;
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? null : num;
  }

  /** Parse reset date from headers, defaulting to 60s from now if missing. */
  private static parseResetDate(headers: Record<string, string>): Date {
    const resetUnix = GraphQLErrorMapper.parseHeader(headers, 'x-ratelimit-reset');
    if (resetUnix !== null) {
      return new Date(resetUnix * 1000);
    }
    // Default: 60 seconds from now
    return new Date(Date.now() + 60_000);
  }
}
