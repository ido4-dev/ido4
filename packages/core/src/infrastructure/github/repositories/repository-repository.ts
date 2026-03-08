/**
 * GitHubRepositoryRepository — Implements IRepositoryRepository against GitHub GraphQL API.
 *
 * Handles PR operations, branch merge status, and PR reviews.
 */

import type {
  IRepositoryRepository,
  PullRequestInfo,
  PullRequestReviewData,
  DefaultBranchInfo,
  IProjectConfig,
  StatusCheckData,
  CodeScanningAlert,
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
  GET_DEFAULT_BRANCH,
  CREATE_REF,
  CREATE_PULL_REQUEST,
  CLOSE_PULL_REQUEST,
  DELETE_REF,
  GET_COMMIT_STATUS_CHECKS,
  GET_VULNERABILITY_ALERTS,
  CREATE_COMMIT_ON_BRANCH,
} from '../queries/index.js';
import type {
  GetPullRequestResponse,
  GetBranchMergeStatusResponse,
  GetPRReviewsResponse,
  FindPRForIssueResponse,
  GetDefaultBranchResponse,
  CreateRefResponse,
  CreatePullRequestResponse,
  ClosePullRequestResponse,
  DeleteRefResponse,
  GetCommitStatusChecksResponse,
  GetCodeScanningAlertsResponse,
  CreateCommitOnBranchResponse,
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

  async checkContainerBranchMerged(waveName: string): Promise<boolean> {
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

  async getDefaultBranchInfo(): Promise<DefaultBranchInfo> {
    const data = await this.client.query<GetDefaultBranchResponse>(
      GET_DEFAULT_BRANCH,
      { owner: this.owner, repo: this.repo },
    );

    const ref = data.repository.defaultBranchRef;
    if (!ref) {
      throw new GitHubAPIError({
        message: 'Repository has no default branch',
        statusCode: 422,
        context: { repository: this.config.project.repository },
      });
    }

    return {
      repositoryId: data.repository.id,
      branchName: ref.name,
      oid: ref.target.oid,
    };
  }

  async createBranch(repositoryId: string, branchName: string, fromOid: string): Promise<{ refId: string }> {
    const data = await this.client.mutate<CreateRefResponse>(CREATE_REF, {
      repositoryId,
      name: `refs/heads/${branchName}`,
      oid: fromOid,
    });

    this.logger.info('Branch created', { branchName, refId: data.createRef.ref.id });
    return { refId: data.createRef.ref.id };
  }

  async createPullRequest(
    repositoryId: string,
    options: { title: string; body: string; baseBranch: string; headBranch: string },
  ): Promise<{ id: string; number: number; url: string }> {
    const data = await this.client.mutate<CreatePullRequestResponse>(CREATE_PULL_REQUEST, {
      repositoryId,
      title: options.title,
      body: options.body,
      baseRefName: options.baseBranch,
      headRefName: options.headBranch,
    });

    const pr = data.createPullRequest.pullRequest;
    this.logger.info('Pull request created', { prNumber: pr.number, url: pr.url });
    return { id: pr.id, number: pr.number, url: pr.url };
  }

  async closePullRequest(prId: string): Promise<void> {
    await this.client.mutate<ClosePullRequestResponse>(CLOSE_PULL_REQUEST, {
      pullRequestId: prId,
    });
    this.logger.info('Pull request closed', { prId });
  }

  async deleteBranch(refId: string): Promise<void> {
    await this.client.mutate<DeleteRefResponse>(DELETE_REF, { refId });
    this.logger.info('Branch deleted', { refId });
  }

  async createCommitOnBranch(
    repositoryNameWithOwner: string,
    branchName: string,
    expectedHeadOid: string,
    filePath: string,
    fileContents: string,
    message: string,
  ): Promise<{ oid: string }> {
    const base64Contents = Buffer.from(fileContents).toString('base64');
    const data = await this.client.mutate<CreateCommitOnBranchResponse>(CREATE_COMMIT_ON_BRANCH, {
      repositoryNameWithOwner,
      branchName,
      expectedHeadOid,
      headline: message,
      filePath,
      fileContents: base64Contents,
    });

    this.logger.info('Commit created on branch', { branchName, oid: data.createCommitOnBranch.commit.oid });
    return { oid: data.createCommitOnBranch.commit.oid };
  }

  async getCommitStatusChecks(prNumber: number): Promise<StatusCheckData[]> {
    const data = await this.client.query<GetCommitStatusChecksResponse>(
      GET_COMMIT_STATUS_CHECKS,
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

    const lastCommit = pr.commits.nodes[0];
    if (!lastCommit?.commit.statusCheckRollup) {
      return [];
    }

    return lastCommit.commit.statusCheckRollup.contexts.nodes.map((ctx) => ({
      name: ctx.name ?? ctx.context ?? 'unknown',
      state: ctx.state ?? ctx.status ?? 'UNKNOWN',
      conclusion: ctx.conclusion ?? null,
    }));
  }

  async getVulnerabilityAlerts(): Promise<CodeScanningAlert[]> {
    const data = await this.client.query<GetCodeScanningAlertsResponse>(
      GET_VULNERABILITY_ALERTS,
      { owner: this.owner, repo: this.repo },
    );

    return data.repository.vulnerabilityAlerts.nodes.map((alert) => ({
      severity: alert.securityVulnerability.severity,
      summary: alert.securityVulnerability.advisory.summary,
    }));
  }
}
