/**
 * GraphQL queries for ProjectRepository.
 *
 * Co-locates query strings with their response type interfaces.
 */

import { FIELD_VALUES_FRAGMENT } from './fragments.js';

// ─── Response Types ───

export interface GetProjectItemsResponse {
  node: {
    items: {
      nodes: Array<ProjectItemNode>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export interface ProjectItemNode {
  id: string;
  type: string;
  fieldValues: {
    nodes: Array<{
      field?: { id: string; name: string };
      text?: string;
      name?: string;
      id?: string;
      number?: number;
    }>;
  };
  content: {
    id: string;
    number: number;
    title: string;
    url: string;
    state: string;
    body: string;
    closed?: boolean;
    assignees: {
      nodes: Array<{ login: string }>;
    };
  } | null;
}

export interface UpdateItemFieldResponse {
  updateProjectV2ItemFieldValue: {
    projectV2Item: {
      id: string;
    };
  };
}

export interface GetCurrentUserResponse {
  viewer: {
    login: string;
    id: string;
  };
}

// ─── Queries ───

export const GET_PROJECT_ITEMS = `
  query GetProjectItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          nodes {
            id
            type
            ${FIELD_VALUES_FRAGMENT}
            content {
              ... on Issue {
                id
                number
                title
                url
                state
                body
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export const UPDATE_ITEM_FIELD_TEXT = `
  mutation UpdateProjectItemFieldText($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $value }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`;

export const UPDATE_ITEM_FIELD_SELECT = `
  mutation UpdateProjectItemFieldSelect($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $value }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
`;

export const GET_CURRENT_USER = `
  query GetCurrentUser {
    viewer {
      login
      id
    }
  }
`;
