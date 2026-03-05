/**
 * Test helpers for GitHub infrastructure tests.
 *
 * Provides mock clients and response builders for repository tests.
 */

import { vi } from 'vitest';
import type { ICredentialManager } from '../../../../src/infrastructure/github/core/types.js';
import type { GitHubGraphQLClient } from '../../../../src/infrastructure/github/core/graphql-client.js';

/** Mock GraphQLClient with all methods as vi.fn() */
export interface MockGraphQLClient {
  query: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
  queryWithHeaders: ReturnType<typeof vi.fn>;
  queryAllPages: ReturnType<typeof vi.fn>;
}

export function createMockGraphQLClient(): MockGraphQLClient {
  return {
    query: vi.fn().mockResolvedValue({}),
    mutate: vi.fn().mockResolvedValue({}),
    queryWithHeaders: vi.fn().mockResolvedValue({}),
    queryAllPages: vi.fn().mockResolvedValue([]),
  };
}

export function createMockCredentialManager(
  token = 'ghp_test1234567890abcdefghijklmnopqrstuv',
): ICredentialManager {
  return {
    getToken: vi.fn().mockResolvedValue(token),
  };
}

/** Build a typical issue response for getTask tests */
export function buildIssueResponse(overrides: {
  issueNumber?: number;
  title?: string;
  status?: string;
  wave?: string;
  epic?: string;
  projectId?: string;
  itemId?: string;
  closed?: boolean;
} = {}) {
  const {
    issueNumber = 42,
    title = 'Test Issue',
    status = 'Backlog',
    wave = 'wave-001-test',
    epic,
    projectId = 'PVT_test_project_001',
    itemId = 'PVTI_item_001',
    closed = false,
  } = overrides;

  const fieldValues: Array<Record<string, unknown>> = [
    { field: { id: 'f1', name: 'Status' }, name: status },
    { field: { id: 'f2', name: 'Wave' }, text: wave },
    { field: { id: 'f3', name: 'Dependencies' }, text: 'No dependencies' },
    { field: { id: 'f4', name: 'AI Suitability' }, name: 'ai-only' },
    { field: { id: 'f5', name: 'Risk Level' }, name: 'Low' },
    { field: { id: 'f6', name: 'Effort' }, name: 'Medium' },
    { field: { id: 'f7', name: 'AI Context' }, text: 'Test context' },
  ];

  if (epic) {
    fieldValues.push({ field: { id: 'f8', name: 'Epic' }, text: epic });
  }

  return {
    repository: {
      issue: {
        id: `I_test_${issueNumber}`,
        number: issueNumber,
        title,
        body: 'Test issue body',
        state: closed ? 'CLOSED' : 'OPEN',
        url: `https://github.com/test-org/test-repo/issues/${issueNumber}`,
        parent: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        projectItems: {
          nodes: [{
            id: itemId,
            project: { id: projectId, number: 1 },
            fieldValues: { nodes: fieldValues },
          }],
        },
      },
    },
  };
}

/** Build a project items response for pagination tests */
export function buildProjectItemsResponse(
  items: Array<{
    id?: string;
    number?: number;
    title?: string;
    status?: string;
    wave?: string;
  }>,
  hasNextPage = false,
  endCursor: string | null = null,
) {
  return {
    node: {
      items: {
        nodes: items.map((item, i) => ({
          id: item.id ?? `PVTI_${i}`,
          type: 'ISSUE',
          fieldValues: {
            nodes: [
              { field: { id: 'f1', name: 'Status' }, name: item.status ?? 'Backlog' },
              { field: { id: 'f2', name: 'Wave' }, text: item.wave ?? 'wave-001-test' },
            ],
          },
          content: {
            id: `I_${i}`,
            number: item.number ?? i + 1,
            title: item.title ?? `Item ${i}`,
            url: `https://github.com/test/repo/issues/${item.number ?? i + 1}`,
            state: 'OPEN',
            body: '',
            assignees: { nodes: [] },
          },
        })),
        pageInfo: { hasNextPage, endCursor },
      },
    },
  };
}
