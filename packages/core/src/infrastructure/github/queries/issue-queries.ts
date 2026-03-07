/**
 * GraphQL queries for IssueRepository.
 *
 * Co-locates query strings with their response type interfaces.
 */

import { FIELD_VALUES_FRAGMENT } from './fragments.js';

// ─── Response Types ───

export interface GetTaskByIssueResponse {
  repository: {
    issue: {
      id: string;
      number: number;
      title: string;
      body: string;
      state: string;
      url: string;
      parent?: {
        id: string;
        number: number;
        title: string;
        state: string;
      };
      assignees: {
        nodes: Array<{ login: string }>;
      };
      labels: {
        nodes: Array<{ name: string }>;
      };
      projectItems: {
        nodes: Array<{
          id: string;
          project: { id: string; number: number };
          fieldValues: {
            nodes: Array<FieldValueNode>;
          };
        }>;
      };
    } | null;
  };
}

export interface FieldValueNode {
  field?: { id: string; name: string };
  text?: string;
  name?: string;
  id?: string;
  number?: number;
}

export interface GetIssueIdResponse {
  repository: {
    issue: {
      id: string;
    } | null;
  };
}

export interface AddCommentResponse {
  addComment: {
    commentEdge: {
      node: {
        id: string;
        body: string;
      };
    };
  };
}

export interface CloseIssueResponse {
  closeIssue: {
    issue: {
      id: string;
      state: string;
    };
  };
}

export interface FindPRForIssueResponse {
  repository: {
    pullRequests: {
      nodes: Array<{
        number: number;
        title: string;
        url: string;
        state: string;
        merged: boolean;
        headRefName: string;
        body: string;
        closingIssuesReferences: {
          nodes: Array<{ number: number }>;
        };
      }>;
    };
  };
}

export interface GetSubIssuesResponse {
  repository: {
    issue: {
      subIssues: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          url: string;
        }>;
      };
    } | null;
  };
}

export interface CreateIssueResponse {
  createIssue: {
    issue: {
      id: string;
      number: number;
      title: string;
      url: string;
    };
  };
}

export interface AddProjectItemResponse {
  addProjectV2ItemById: {
    item: {
      id: string;
    };
  };
}

export interface GetRepositoryIdResponse {
  repository: {
    id: string;
  };
}

// ─── Queries ───

export const GET_TASK_BY_ISSUE = `
  query GetTaskByIssue($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        id
        number
        title
        body
        state
        url
        parent {
          id
          number
          title
          state
        }
        assignees(first: 10) {
          nodes {
            login
          }
        }
        labels(first: 20) {
          nodes {
            name
          }
        }
        projectItems(first: 10) {
          nodes {
            id
            project {
              id
              number
            }
            ${FIELD_VALUES_FRAGMENT}
          }
        }
      }
    }
  }
`;

export const GET_ISSUE_ID = `
  query GetIssueId($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        id
      }
    }
  }
`;

export const ADD_COMMENT = `
  mutation AddComment($issueId: ID!, $body: String!) {
    addComment(input: {
      subjectId: $issueId
      body: $body
    }) {
      commentEdge {
        node {
          id
          body
        }
      }
    }
  }
`;

export const CLOSE_ISSUE = `
  mutation CloseIssue($issueId: ID!) {
    closeIssue(input: {
      issueId: $issueId
    }) {
      issue {
        id
        state
      }
    }
  }
`;

export const FIND_PR_FOR_ISSUE = `
  query FindPullRequestForIssue($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 10, states: [OPEN], orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          number
          title
          url
          state
          merged
          headRefName
          body
          closingIssuesReferences(first: 10) {
            nodes {
              number
            }
          }
        }
      }
    }
  }
`;

export const CREATE_ISSUE = `
  mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: {
      repositoryId: $repositoryId
      title: $title
      body: $body
    }) {
      issue {
        id
        number
        title
        url
      }
    }
  }
`;

export const ADD_PROJECT_ITEM = `
  mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`;

export const GET_REPOSITORY_ID = `
  query GetRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

export interface AddSubIssueResponse {
  addSubIssue: {
    issue: {
      id: string;
      number: number;
    };
  };
}

export const ADD_SUB_ISSUE = `
  mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
    addSubIssue(input: {
      issueId: $issueId
      subIssueId: $subIssueId
    }) {
      issue {
        id
        number
      }
    }
  }
`;

export const GET_SUB_ISSUES = `
  query GetSubIssues($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        subIssues(first: 100) {
          nodes {
            number
            title
            state
            url
          }
        }
      }
    }
  }
`;
