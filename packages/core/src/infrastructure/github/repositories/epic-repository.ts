/**
 * GitHubEpicRepository — Implements IEpicRepository against GitHub GraphQL API.
 *
 * Folds SearchRepository functionality directly — no separate search class.
 * Uses sub_issues preview header for timeline queries.
 */

import type {
  IEpicRepository,
  EpicIssueData,
  IssueTimelineData,
  IProjectConfig,
} from '../../../container/interfaces.js';
import type { ILogger } from '../../../shared/logger.js';
import type { GitHubGraphQLClient } from '../core/graphql-client.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import {
  GET_ISSUE_WITH_TIMELINE,
  SEARCH_EPIC_ISSUES,
} from '../queries/index.js';
import type {
  GetIssueWithTimelineResponse,
  SearchEpicIssuesResponse,
} from '../queries/index.js';

export class GitHubEpicRepository implements IEpicRepository {
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

  async searchEpicIssues(searchTerm: string): Promise<EpicIssueData[]> {
    const searchQuery = `repo:${this.owner}/${this.repo} is:issue "${searchTerm}" in:title`;

    const data = await this.client.query<SearchEpicIssuesResponse>(
      SEARCH_EPIC_ISSUES,
      { query: searchQuery },
    );

    const results = data.search.nodes
      .filter((node) => node.number !== undefined && node.title !== undefined)
      .map((node) => ({
        number: node.number!,
        title: node.title!,
        url: node.url ?? '',
      }));

    this.logger.debug('Epic issues search completed', {
      searchTerm,
      resultCount: results.length,
    });

    return results;
  }

  async getIssueWithTimeline(issueNumber: number): Promise<IssueTimelineData> {
    const data = await this.client.queryWithHeaders<GetIssueWithTimelineResponse>(
      GET_ISSUE_WITH_TIMELINE,
      { owner: this.owner, name: this.repo, number: issueNumber },
      { 'GraphQL-Features': 'sub_issues' },
    );

    const issue = data.repository.issue;
    if (!issue) {
      throw new NotFoundError({
        message: `Issue #${issueNumber} not found`,
        resource: 'issue',
        identifier: issueNumber,
      });
    }

    // Extract connected issues from timeline events
    // Only CONNECTED events matter (DISCONNECTED removes connections)
    const connectedIssues: Array<{ number: number; title: string; state: string }> = [];
    for (const event of issue.timelineItems.nodes) {
      if (event.subject) {
        connectedIssues.push({
          number: event.subject.number,
          title: event.subject.title,
          state: event.subject.state,
        });
      }
    }

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      url: issue.url,
      connectedIssues,
      subIssues: issue.subIssues.nodes.map((node) => ({
        number: node.number,
        title: node.title,
        state: node.state as 'OPEN' | 'CLOSED',
        url: node.url,
      })),
      subIssuesSummary: {
        total: issue.subIssuesSummary.total,
        completed: issue.subIssuesSummary.completed,
      },
    };
  }
}
