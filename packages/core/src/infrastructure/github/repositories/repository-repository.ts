/**
 * GitHubRepositoryRepository — Implements IRepositoryRepository against GitHub GraphQL API.
 *
 * Handles PR operations, branch merge status, and PR reviews.
 */

import type {
  IRepositoryRepository,
  PullRequestInfo,
  PullRequestReviewData,
  IProjectConfig,
} from '../../../container/interfaces.js';
import type { ILogger } from '../../../shared/logger.js';
import type { GitHubGraphQLClient } from '../core/graphql-client.js';
import { GitHubAPIError, NotFoundError } from '../../../shared/errors/index.js';
import {
  GET_PULL_REQUEST,
  MERGE_PULL_REQUEST,
  FIND_PR_FOR_ISSUE_REPO,
  GET_BRANCH_MERGE_STATUS,
  GET_PR_REVIEWS,
} from '../queries/index.js';
import type {
  GetPullRequestResponse,
  GetBranchMergeStatusResponse,
  GetPRReviewsResponse,
  FindPRForIssueResponse,
} from '../queries/index.js';

const MERGE_METHODS: Record<string, string> = {
  merge: 'MERGE',
  squash: 'SQUASH',
  rebase: 'REBASE',
};

export class GitHubRepositoryRepository implements IRepositoryRepository {
  constructor(
    private readonly client: GitHubGraphQLClient,
    private readonly config: IProjectConfig,
    private readonly logger: ILogger,
  ) {}

  private get owner(): string {
    return this.config.project.repository.split('/')[0]!;
  }

  private get repo(): string {
    return this.config.project.repository.split('/')[1]!;
  }

  async mergePullRequest(prNumber: number, mergeMethod?: string): Promise<void> {
    const data = await this.client.query<GetPullRequestResponse>(
      GET_PULL_REQUEST,
      { owner: this.owner, repo: this.repo, prNumber },
    );

    const pr = data.repository.pullRequest;
    if (!pr) {
      throw new NotFoundError({
        message: `Pull request #${prNumber} not found`,
        resource: 'pullRequest',
        identifier: prNumber,
      });
    }

    if (pr.state !== 'OPEN') {
      throw new GitHubAPIError({
        message: `Pull request #${prNumber} is not open (state: ${pr.state})`,
        statusCode: 422,
        context: { prNumber, state: pr.state },
      });
    }

    if (pr.mergeable === 'CONFLICTING') {
      throw new GitHubAPIError({
        message: `Pull request #${prNumber} has merge conflicts`,
        statusCode: 422,
        context: { prNumber, mergeable: pr.mergeable },
        remediation: 'Resolve merge conflicts before merging.',
      });
    }

    const method = MERGE_METHODS[mergeMethod ?? 'squash'] ?? 'SQUASH';

    await this.client.mutate(MERGE_PULL_REQUEST, {
      pullRequestId: pr.id,
      mergeMethod: method,
    });

    this.logger.info('Pull request merged', { prNumber, method });
  }

  async findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null> {
    const data = await this.client.query<FindPRForIssueResponse>(
      FIND_PR_FOR_ISSUE_REPO,
      { owner: this.owner, repo: this.repo },
    );

    const prs = data.repository.pullRequests.nodes;

    // Check closingIssuesReferences
    for (const pr of prs) {
      if (pr.closingIssuesReferences.nodes.some((ref) => ref.number === issueNumber)) {
        return {
          number: pr.number,
          title: pr.title,
          url: pr.url,
          state: pr.state,
          merged: pr.merged,
          headRefName: pr.headRefName,
        };
      }
    }

    // Check title/body mentions
    const issueRef = `#${issueNumber}`;
    for (const pr of prs) {
      if (pr.title.includes(issueRef) || pr.body.includes(issueRef)) {
        return {
          number: pr.number,
          title: pr.title,
          url: pr.url,
          state: pr.state,
          merged: pr.merged,
          headRefName: pr.headRefName,
        };
      }
    }

    return null;
  }

  async checkWaveBranchMerged(waveName: string): Promise<boolean> {
    const branchName = `refs/heads/${waveName}`;

    const data = await this.client.query<GetBranchMergeStatusResponse>(
      GET_BRANCH_MERGE_STATUS,
      { owner: this.owner, name: this.repo, branchName },
    );

    // If branch doesn't exist, consider it merged (deleted after merge)
    if (!data.repository.ref) {
      return true;
    }

    // Check if the branch tip commit is in the default branch history
    const branchTip = data.repository.ref.target.oid;
    const defaultHistory = data.repository.defaultBranchRef?.target.history?.nodes ?? [];

    return defaultHistory.some((commit) => commit.oid === branchTip);
  }

  async getPullRequestReviews(prNumber: number): Promise<PullRequestReviewData[]> {
    const data = await this.client.query<GetPRReviewsResponse>(
      GET_PR_REVIEWS,
      { owner: this.owner, repo: this.repo, prNumber },
    );

    const pr = data.repository.pullRequest;
    if (!pr) {
      throw new NotFoundError({
        message: `Pull request #${prNumber} not found`,
        resource: 'pullRequest',
        identifier: prNumber,
      });
    }

    return pr.reviews.nodes.map((review) => ({
      id: review.id,
      author: review.author?.login ?? 'unknown',
      state: review.state as PullRequestReviewData['state'],
      body: review.body,
      submittedAt: review.submittedAt,
    }));
  }
}
