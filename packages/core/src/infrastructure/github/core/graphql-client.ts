/**
 * GitHubGraphQLClient — Resilient GitHub GraphQL API client.
 *
 * Features: exponential backoff with jitter, rate limit tracking,
 * preemptive throttling, cursor-based pagination, variable sanitization.
 *
 * Wraps @octokit/graphql as the HTTP transport.
 */

import { graphql } from '@octokit/graphql';
import type { IGraphQLClient } from '../../../container/interfaces.js';
import type { ILogger } from '../../../shared/logger.js';
import { GraphQLErrorMapper } from './error-mapper.js';
import type {
  ICredentialManager,
  RateLimitState,
  RetryConfig,
  PageInfo,
  PaginatedQueryOptions,
} from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';

type GraphQLFunction = typeof graphql;

export class GitHubGraphQLClient implements IGraphQLClient {
  private octokitClient: GraphQLFunction | undefined;
  private rateLimitState: RateLimitState | undefined;
  private readonly retryConfig: RetryConfig;

  constructor(
    private readonly credentialManager: ICredentialManager,
    private readonly logger: ILogger,
    config?: Partial<RetryConfig>,
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async query<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry('query', queryString, variables);
  }

  async mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry('mutate', mutation, variables);
  }

  /**
   * Execute a query with custom headers (e.g., GraphQL-Features: sub_issues).
   * Package-internal — not part of IGraphQLClient interface.
   */
  async queryWithHeaders<T>(
    queryString: string,
    variables?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.executeWithRetry('query', queryString, variables, headers);
  }

  /**
   * Execute a mutation with custom headers (e.g., GraphQL-Features: sub_issues).
   * Package-internal — not part of IGraphQLClient interface.
   */
  async mutateWithHeaders<T>(
    mutation: string,
    variables?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.executeWithRetry('mutate', mutation, variables, headers);
  }

  /**
   * Fetch all pages of a paginated query.
   * Uses cursor-based pagination following GitHub's connection pattern.
   */
  async queryAllPages<TNode>(
    queryString: string,
    variables: Record<string, unknown>,
    extractNodes: (data: unknown) => TNode[],
    extractPageInfo: (data: unknown) => PageInfo,
    options?: PaginatedQueryOptions,
  ): Promise<TNode[]> {
    const allNodes: TNode[] = [];
    let cursor: string | null = null;
    const pageSize = options?.pageSize ?? 100;
    const maxPages = options?.maxPages ?? 10;

    for (let page = 0; page < maxPages; page++) {
      const pageVars = { ...variables, first: pageSize, after: cursor };
      const result = await this.query<unknown>(queryString, pageVars);

      const nodes = extractNodes(result);
      allNodes.push(...nodes);

      const pageInfo = extractPageInfo(result);
      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
      cursor = pageInfo.endCursor;
    }

    return allNodes;
  }

  /** Expose rate limit state for monitoring/testing */
  getRateLimitState(): RateLimitState | undefined {
    return this.rateLimitState ? { ...this.rateLimitState } : undefined;
  }

  private async executeWithRetry<T>(
    operationType: 'query' | 'mutate',
    queryString: string,
    variables?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    const maxRetries = this.retryConfig.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Preemptive rate limit check
      await this.preemptiveThrottle();

      try {
        const client = await this.ensureClient();
        const sanitized = this.sanitizeVariables(variables ?? {});

        let result: unknown;
        if (headers && Object.keys(headers).length > 0) {
          result = await client(queryString, {
            ...sanitized,
            headers,
          });
        } else {
          result = await client(queryString, sanitized);
        }

        return result as T;
      } catch (error: unknown) {
        lastError = error;

        // Update rate limit state from error response
        this.updateRateLimitFromError(error);

        // Check if retryable
        if (attempt < maxRetries && GraphQLErrorMapper.isRetryable(error)) {
          const delay = this.calculateDelay(attempt);
          this.logger.warn('GraphQL request failed, retrying', {
            attempt: attempt + 1,
            maxRetries,
            delayMs: delay,
            operationType,
          });
          await this.sleep(delay);
          continue;
        }

        // Not retryable or exhausted retries — map and throw
        GraphQLErrorMapper.mapError(error, operationType);
      }
    }

    // Should never reach here, but safety net
    GraphQLErrorMapper.mapError(lastError, operationType);
  }

  private async ensureClient(): Promise<GraphQLFunction> {
    if (this.octokitClient) return this.octokitClient;

    const token = await this.credentialManager.getToken();
    this.octokitClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
        'user-agent': 'ido4-mcp/0.1.0',
      },
    });

    return this.octokitClient;
  }

  private async preemptiveThrottle(): Promise<void> {
    if (!this.rateLimitState || this.rateLimitState.remaining > 5) return;

    const waitMs = Math.max(0, this.rateLimitState.resetAt.getTime() - Date.now());
    if (waitMs > 0 && waitMs < 60_000) {
      this.logger.warn('Preemptive rate limit throttle', {
        waitMs,
        remaining: this.rateLimitState.remaining,
      });
      await this.sleep(waitMs);
    }
  }

  private updateRateLimitFromError(error: unknown): void {
    const gqlError = error as { response?: { headers?: Record<string, string> } };
    const headers = gqlError?.response?.headers;
    if (headers) {
      const state = GraphQLErrorMapper.extractRateLimitState(headers);
      if (state) {
        this.rateLimitState = state;
      }
    }
  }

  private calculateDelay(attempt: number): number {
    const { baseDelayMs, maxDelayMs, jitterFactor } = this.retryConfig;

    // Exponential: 1s, 2s, 4s, 8s...
    const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

    // Random jitter: ±factor of exponential delay
    const jitterRange = exponential * jitterFactor;
    const randomJitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, Math.round(exponential + randomJitter));
  }

  private sanitizeVariables(variables: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (value === undefined) continue;
      sanitized[key] = value;
    }
    return sanitized;
  }

  /** Overridable sleep for testing */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
