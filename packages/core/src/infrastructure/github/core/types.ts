/**
 * Infrastructure-internal types for the GitHub GraphQL layer.
 *
 * These types are NOT exported to domain consumers.
 * Domain code depends on interfaces in container/interfaces.ts.
 */

/** Contract for token resolution — used by GraphQL client */
export interface ICredentialManager {
  getToken(): Promise<string>;
}

/** Rate limit state tracked from GitHub API response headers */
export interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in ms for first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in ms, caps exponential growth (default: 8000) */
  maxDelayMs: number;
  /** Random jitter factor, ±percentage of delay (default: 0.25 = 25%) */
  jitterFactor: number;
}

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG: Readonly<RetryConfig> = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  jitterFactor: 0.25,
});

/** Pagination cursor from GitHub GraphQL responses */
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Options for queryAllPages helper */
export interface PaginatedQueryOptions {
  /** Items per page (default: 100) */
  pageSize?: number;
  /** Safety cap on maximum pages to fetch (default: 10) */
  maxPages?: number;
}

/**
 * Shape of @octokit/graphql errors — used for error classification.
 * Not an exact type match but covers the fields we inspect.
 */
export interface OctokitGraphQLError {
  response?: {
    status?: number;
    errors?: Array<{
      message: string;
      type?: string;
      path?: string[];
      locations?: Array<{ line: number; column: number }>;
      extensions?: Record<string, unknown>;
    }>;
    headers?: Record<string, string>;
    data?: Record<string, unknown>;
  };
  status?: number;
  code?: string;
  message: string;
}
