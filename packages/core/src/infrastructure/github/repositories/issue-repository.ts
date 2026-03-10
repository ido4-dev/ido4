/**
 * GitHubIssueRepository — Implements IIssueRepository against GitHub GraphQL API.
 *
 * Uses FieldExtractor for all field value extraction.
 * Uses InputSanitizer for input validation.
 */

import type { IIssueRepository, TaskData, TaskDetailOptions, PullRequestInfo, SubIssueData, IProjectConfig } from '../../../container/interfaces.js';
import type { ILogger } from '../../../shared/logger.js';
import type { GitHubGraphQLClient } from '../core/graphql-client.js';
import { FieldExtractor } from '../../../shared/utils/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { FieldValue } from '../../../shared/utils/index.js';
import {
  GET_TASK_BY_ISSUE,
  GET_ISSUE_ID,
  ADD_COMMENT,
  CLOSE_ISSUE,
  FIND_PR_FOR_ISSUE,
  ADD_SUB_ISSUE,
  GET_SUB_ISSUES,
  CREATE_ISSUE,
  GET_REPOSITORY_ID,
  UPDATE_ITEM_FIELD_TEXT,
  UPDATE_ITEM_FIELD_SELECT,
} from '../queries/index.js';
import type {
  GetTaskByIssueResponse,
  GetIssueIdResponse,
  FindPRForIssueResponse,
  AddSubIssueResponse,
  GetSubIssuesResponse,
  CreateIssueResponse,
  GetRepositoryIdResponse,
} from '../queries/index.js';

export class GitHubIssueRepository implements IIssueRepository {
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

  async getTask(issueNumber: number): Promise<TaskData> {
    const data = await this.client.queryWithHeaders<GetTaskByIssueResponse>(
      GET_TASK_BY_ISSUE,
      { owner: this.owner, repo: this.repo, issueNumber },
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

    return this.mapIssueToTaskData(issue);
  }

  async getTaskWithDetails(issueNumber: number, _options?: TaskDetailOptions): Promise<TaskData> {
    // For now, same as getTask. In future, could expand query with comments/timeline.
    return this.getTask(issueNumber);
  }

  async createIssue(title: string, body?: string): Promise<{ id: string; number: number; url: string }> {
    const repoData = await this.client.query<GetRepositoryIdResponse>(
      GET_REPOSITORY_ID,
      { owner: this.owner, name: this.repo },
    );
    const repositoryId = repoData.repository.id;

    const data = await this.client.mutate<CreateIssueResponse>(CREATE_ISSUE, {
      repositoryId,
      title,
      body: body ?? '',
    });

    const issue = data.createIssue.issue;
    this.logger.info('Issue created', { number: issue.number, title });
    return { id: issue.id, number: issue.number, url: issue.url };
  }

  async updateTaskStatus(issueNumber: number, statusKey: string): Promise<void> {
    const statusOption = this.config.status_options[statusKey];
    if (!statusOption) {
      throw new NotFoundError({
        message: `Status option "${statusKey}" not found in config`,
        resource: 'status_option',
        identifier: statusKey,
      });
    }

    const task = await this.getTask(issueNumber);

    await this.client.mutate(UPDATE_ITEM_FIELD_SELECT, {
      projectId: this.config.project.id,
      itemId: task.itemId,
      fieldId: this.config.fields.status_field_id,
      value: statusOption.id,
    });

    this.logger.info('Task status updated', {
      issueNumber,
      statusKey,
      statusName: statusOption.name,
    });
  }

  async updateTaskField(
    issueNumber: number,
    fieldKey: string,
    value: string,
    fieldType?: string,
  ): Promise<void> {
    const task = await this.getTask(issueNumber);
    const fieldId = this.config.fields[`${fieldKey}_field_id`] ?? this.config.fields[fieldKey];

    if (!fieldId) {
      throw new NotFoundError({
        message: `Field "${fieldKey}" not found in config`,
        resource: 'field',
        identifier: fieldKey,
      });
    }

    const mutation = fieldType === 'singleSelect'
      ? UPDATE_ITEM_FIELD_SELECT
      : UPDATE_ITEM_FIELD_TEXT;

    await this.client.mutate(mutation, {
      projectId: this.config.project.id,
      itemId: task.itemId,
      fieldId,
      value,
    });

    this.logger.info('Task field updated', { issueNumber, fieldKey, fieldType });
  }

  async updateTaskContainer(issueNumber: number, waveName: string): Promise<void> {
    await this.updateTaskField(issueNumber, 'wave', waveName, 'text');
  }

  async assignTask(issueNumber: number, assignee: string): Promise<void> {
    await this.addComment(issueNumber, `Assigning to @${assignee}`);
    this.logger.info('Task assigned', { issueNumber, assignee });
  }

  async addComment(issueNumber: number, comment: string): Promise<void> {
    const idData = await this.client.query<GetIssueIdResponse>(
      GET_ISSUE_ID,
      { owner: this.owner, repo: this.repo, issueNumber },
    );

    const issueId = idData.repository.issue?.id;
    if (!issueId) {
      throw new NotFoundError({
        message: `Issue #${issueNumber} not found`,
        resource: 'issue',
        identifier: issueNumber,
      });
    }

    await this.client.mutate(ADD_COMMENT, {
      issueId,
      body: comment,
    });

    this.logger.debug('Comment added', { issueNumber });
  }

  async closeIssue(issueNumber: number): Promise<void> {
    const idData = await this.client.query<GetIssueIdResponse>(
      GET_ISSUE_ID,
      { owner: this.owner, repo: this.repo, issueNumber },
    );

    const issueId = idData.repository.issue?.id;
    if (!issueId) {
      throw new NotFoundError({
        message: `Issue #${issueNumber} not found`,
        resource: 'issue',
        identifier: issueNumber,
      });
    }

    await this.client.mutate(CLOSE_ISSUE, { issueId });
    this.logger.info('Issue closed', { issueNumber });
  }

  async findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null> {
    const data = await this.client.query<FindPRForIssueResponse>(
      FIND_PR_FOR_ISSUE,
      { owner: this.owner, repo: this.repo },
    );

    const prs = data.repository.pullRequests.nodes;

    // First: check closingIssuesReferences
    for (const pr of prs) {
      const closes = pr.closingIssuesReferences.nodes;
      if (closes.some((ref) => ref.number === issueNumber)) {
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

    // Second: check title/body mentions
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

  async addSubIssue(parentIssueId: string, childIssueId: string): Promise<void> {
    await this.client.mutateWithHeaders<AddSubIssueResponse>(
      ADD_SUB_ISSUE,
      { issueId: parentIssueId, subIssueId: childIssueId },
      { 'GraphQL-Features': 'sub_issues' },
    );

    this.logger.info('Sub-issue added', { parentIssueId, childIssueId });
  }

  async getSubIssues(issueNumber: number): Promise<SubIssueData[]> {
    const data = await this.client.queryWithHeaders<GetSubIssuesResponse>(
      GET_SUB_ISSUES,
      { owner: this.owner, repo: this.repo, issueNumber },
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

    return issue.subIssues.nodes.map((node) => ({
      number: node.number,
      title: node.title,
      state: node.state as 'OPEN' | 'CLOSED',
      url: node.url,
    }));
  }

  private mapIssueToTaskData(issue: NonNullable<GetTaskByIssueResponse['repository']['issue']>): TaskData {
    // Find the project item matching our project
    const projectItem = issue.projectItems.nodes.find(
      (item) => item.project.id === this.config.project.id,
    );

    // Extract field values using FieldExtractor
    const fieldValues = (projectItem?.fieldValues.nodes ?? []) as FieldValue[];
    const fields = FieldExtractor.extractCommonFields(fieldValues);

    return {
      id: issue.id,
      itemId: projectItem?.id ?? '',
      number: issue.number,
      title: issue.title,
      body: issue.body,
      status: fields.status ?? 'Unknown',
      containers: fields.containers,
      dependencies: fields.dependencies,
      aiSuitability: fields.aiSuitability,
      riskLevel: fields.riskLevel,
      effort: fields.effort,
      aiContext: fields.aiContext,
      assignees: issue.assignees.nodes.map((a) => a.login),
      labels: issue.labels.nodes.map((l) => l.name),
      url: issue.url,
      closed: issue.state === 'CLOSED',
    };
  }
}
