/**
 * GitHubProjectRepository — Implements IProjectRepository against GitHub GraphQL API.
 *
 * Uses queryAllPages for pagination of project items.
 * Uses FieldExtractor for field value extraction.
 */

import type {
  IProjectRepository,
  ProjectItem,
  PaginationOptions,
  WaveStatusData,
  UserInfo,
  TaskData,
  IProjectConfig,
} from '../../../container/interfaces.js';
import type { ILogger } from '../../../shared/logger.js';
import type { GitHubGraphQLClient } from '../core/graphql-client.js';
import { FieldExtractor } from '../../../shared/utils/index.js';
import type { FieldValue } from '../../../shared/utils/index.js';
import {
  GET_PROJECT_ITEMS,
  UPDATE_ITEM_FIELD_TEXT,
  UPDATE_ITEM_FIELD_SELECT,
  GET_CURRENT_USER,
} from '../queries/index.js';
import type {
  GetProjectItemsResponse,
  ProjectItemNode,
  GetCurrentUserResponse,
} from '../queries/index.js';

export class GitHubProjectRepository implements IProjectRepository {
  constructor(
    private readonly client: GitHubGraphQLClient,
    private readonly config: IProjectConfig,
    private readonly logger: ILogger,
  ) {}

  async getProjectItems(options?: PaginationOptions): Promise<ProjectItem[]> {
    const nodes = await this.client.queryAllPages<ProjectItemNode>(
      GET_PROJECT_ITEMS,
      { projectId: this.config.project.id },
      (data) => (data as GetProjectItemsResponse).node.items.nodes,
      (data) => (data as GetProjectItemsResponse).node.items.pageInfo,
      { pageSize: options?.limit ?? 100 },
    );

    return nodes
      .filter((node) => node.content !== null)
      .map((node) => this.mapProjectItemNode(node));
  }

  async updateItemField(
    itemId: string,
    fieldId: string,
    value: string,
    fieldType?: string,
  ): Promise<void> {
    const mutation = fieldType === 'singleSelect'
      ? UPDATE_ITEM_FIELD_SELECT
      : UPDATE_ITEM_FIELD_TEXT;

    await this.client.mutate(mutation, {
      projectId: this.config.project.id,
      itemId,
      fieldId,
      value,
    });

    this.logger.debug('Item field updated', { itemId, fieldId, fieldType });
  }

  async getWaveStatus(wave: string): Promise<WaveStatusData> {
    const items = await this.getProjectItems();

    const waveTasks: TaskData[] = [];
    for (const item of items) {
      if (item.fieldValues.Wave === wave) {
        waveTasks.push({
          id: item.id,
          itemId: item.id,
          number: item.content.number,
          title: item.content.title,
          body: item.content.body,
          status: item.fieldValues.Status ?? 'Unknown',
          wave,
          url: item.content.url,
          closed: item.content.closed,
        });
      }
    }

    const total = waveTasks.length;
    const completed = waveTasks.filter((t) => t.status === 'Done').length;
    const inProgress = waveTasks.filter((t) => t.status === 'In Progress').length;
    const blocked = waveTasks.filter((t) => t.status === 'Blocked').length;
    const ready = waveTasks.filter((t) => t.status === 'Ready for Dev').length;

    return {
      name: wave,
      tasks: waveTasks,
      metrics: { total, completed, inProgress, blocked, ready },
    };
  }

  async getCurrentUser(): Promise<UserInfo> {
    const data = await this.client.query<GetCurrentUserResponse>(GET_CURRENT_USER);
    return {
      login: data.viewer.login,
      id: data.viewer.id,
    };
  }

  private mapProjectItemNode(node: ProjectItemNode): ProjectItem {
    const content = node.content!;
    const fieldValues = (node.fieldValues.nodes ?? []) as FieldValue[];

    // Build fieldValues record from all field values
    const fieldRecord: Record<string, string> = {};
    for (const fv of fieldValues) {
      if (fv.field?.name) {
        const value = FieldExtractor.getFieldValue(fieldValues, fv.field.name);
        if (value !== undefined) {
          fieldRecord[fv.field.name] = value;
        }
      }
    }

    return {
      id: node.id,
      content: {
        number: content.number,
        title: content.title,
        body: content.body,
        url: content.url,
        closed: content.state === 'CLOSED',
      },
      fieldValues: fieldRecord,
    };
  }
}
