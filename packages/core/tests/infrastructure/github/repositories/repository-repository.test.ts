import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubRepositoryRepository } from '../../../../src/infrastructure/github/repositories/repository-repository.js';
import { GitHubAPIError, NotFoundError } from '../../../../src/shared/errors/index.js';
import { TestLogger } from '../../../helpers/test-logger.js';
import { createMockProjectConfig } from '../../../helpers/mock-factories.js';
import { createMockGraphQLClient } from '../helpers/graphql-mock.js';
import type { MockGraphQLClient } from '../helpers/graphql-mock.js';

describe('GitHubRepositoryRepository', () => {
  let client: MockGraphQLClient;
  let repo: GitHubRepositoryRepository;
  let logger: TestLogger;

  beforeEach(() => {
    client = createMockGraphQLClient();
    logger = new TestLogger();
    const config = createMockProjectConfig({
      project: { id: 'PVT_test', number: 1, repository: 'test-org/test-repo' },
    });
    repo = new GitHubRepositoryRepository(client as unknown as any, config, logger);
  });

  describe('mergePullRequest', () => {
    it('validates PR is OPEN and merges', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequest: {
            id: 'PR_123',
            state: 'OPEN',
            mergeable: 'MERGEABLE',
            title: 'Test PR',
            headRefName: 'feature',
          },
        },
      });
      client.mutate.mockResolvedValueOnce({});

      await repo.mergePullRequest(10, 'squash');

      expect(client.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          pullRequestId: 'PR_123',
          mergeMethod: 'SQUASH',
        }),
      );
    });

    it('throws NotFoundError when PR not found', async () => {
      client.query.mockResolvedValueOnce({
        repository: { pullRequest: null },
      });

      await expect(repo.mergePullRequest(999)).rejects.toThrow(NotFoundError);
    });

    it('throws GitHubAPIError when PR is not open', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequest: {
            id: 'PR_123',
            state: 'CLOSED',
            mergeable: 'MERGEABLE',
            title: 'Closed PR',
            headRefName: 'feature',
          },
        },
      });

      await expect(repo.mergePullRequest(10)).rejects.toThrow(GitHubAPIError);
    });

    it('throws GitHubAPIError when PR has conflicts', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequest: {
            id: 'PR_123',
            state: 'OPEN',
            mergeable: 'CONFLICTING',
            title: 'Conflicting PR',
            headRefName: 'feature',
          },
        },
      });

      await expect(repo.mergePullRequest(10)).rejects.toThrow(GitHubAPIError);
    });

    it('defaults to SQUASH merge method', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequest: { id: 'PR_1', state: 'OPEN', mergeable: 'MERGEABLE', title: 'PR', headRefName: 'f' },
        },
      });
      client.mutate.mockResolvedValueOnce({});

      await repo.mergePullRequest(10);

      expect(client.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ mergeMethod: 'SQUASH' }),
      );
    });
  });

  describe('findPullRequestForIssue', () => {
    it('returns PullRequestInfo via closingIssuesReferences', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [{
              number: 5,
              title: 'Fix things',
              url: 'https://github.com/test/repo/pull/5',
              state: 'OPEN',
              merged: false,
              headRefName: 'fix-42',
              body: 'Body',
              closingIssuesReferences: { nodes: [{ number: 42 }] },
            }],
          },
        },
      });

      const result = await repo.findPullRequestForIssue(42);
      expect(result).not.toBeNull();
      expect(result!.number).toBe(5);
      expect(result!.body).toBe('Body');
    });

    it('returns null when no PR matches', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [{
              number: 5,
              title: 'Unrelated',
              url: '',
              state: 'OPEN',
              merged: false,
              headRefName: 'other',
              body: 'Nothing',
              closingIssuesReferences: { nodes: [] },
            }],
          },
        },
      });

      const result = await repo.findPullRequestForIssue(42);
      expect(result).toBeNull();
    });
  });

  describe('checkContainerBranchMerged', () => {
    it('returns true when branch does not exist (merged + deleted)', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          ref: null,
          defaultBranchRef: {
            name: 'main',
            target: { oid: 'abc', history: { nodes: [] } },
          },
        },
      });

      expect(await repo.checkContainerBranchMerged('wave-001')).toBe(true);
    });

    it('returns true when branch tip is in default branch history', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          ref: {
            name: 'wave-001',
            target: { oid: 'commit_abc' },
          },
          defaultBranchRef: {
            name: 'main',
            target: {
              oid: 'head_xyz',
              history: {
                nodes: [
                  { oid: 'head_xyz' },
                  { oid: 'commit_abc' },
                  { oid: 'older_commit' },
                ],
              },
            },
          },
        },
      });

      expect(await repo.checkContainerBranchMerged('wave-001')).toBe(true);
    });

    it('returns false when branch exists and not merged', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          ref: {
            name: 'wave-001',
            target: { oid: 'unmerged_commit' },
          },
          defaultBranchRef: {
            name: 'main',
            target: {
              oid: 'head_xyz',
              history: {
                nodes: [{ oid: 'head_xyz' }, { oid: 'other_commit' }],
              },
            },
          },
        },
      });

      expect(await repo.checkContainerBranchMerged('wave-001')).toBe(false);
    });
  });

  describe('getPullRequestReviews', () => {
    it('returns PullRequestReviewData array', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequest: {
            reviews: {
              nodes: [
                {
                  id: 'R_1',
                  author: { login: 'reviewer1' },
                  state: 'APPROVED',
                  body: 'LGTM',
                  submittedAt: '2024-01-01T00:00:00Z',
                },
                {
                  id: 'R_2',
                  author: null,
                  state: 'CHANGES_REQUESTED',
                  body: 'Fix tests',
                  submittedAt: '2024-01-02T00:00:00Z',
                },
              ],
            },
          },
        },
      });

      const reviews = await repo.getPullRequestReviews(10);
      expect(reviews).toHaveLength(2);
      expect(reviews[0]!.state).toBe('APPROVED');
      expect(reviews[0]!.author).toBe('reviewer1');
      expect(reviews[1]!.author).toBe('unknown'); // null author fallback
    });

    it('throws NotFoundError when PR not found', async () => {
      client.query.mockResolvedValueOnce({
        repository: { pullRequest: null },
      });

      await expect(repo.getPullRequestReviews(999)).rejects.toThrow(NotFoundError);
    });
  });
});
