/**
 * GraphQL queries for EpicRepository.
 *
 * Co-locates query strings with their response type interfaces.
 */

// ─── Response Types ───

export interface GetIssueWithTimelineResponse {
  repository: {
    issue: {
      id: string;
      number: number;
      title: string;
      body: string;
      state: string;
      url: string;
      timelineItems: {
        nodes: Array<{
          id?: string;
          subject?: {
            number: number;
            title: string;
            state: string;
          };
        }>;
      };
      subIssues: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          url: string;
        }>;
      };
      subIssuesSummary: {
        total: number;
        completed: number;
        percentCompleted: number;
      };
      trackedIssues: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          repository: {
            owner: { login: string };
            name: string;
          };
        }>;
      };
      trackedInIssues: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          repository: {
            owner: { login: string };
            name: string;
          };
        }>;
      };
    } | null;
  };
}

export interface SearchEpicIssuesResponse {
  search: {
    nodes: Array<{
      id?: string;
      number?: number;
      title?: string;
      body?: string;
      state?: string;
      url?: string;
      repository?: {
        owner: { login: string };
        name: string;
      };
      trackedIssues?: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
        }>;
      };
    }>;
  };
}

// ─── Queries ───

export const GET_ISSUE_WITH_TIMELINE = `
  query GetIssueWithTimeline($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        id
        number
        title
        body
        state
        url
        timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, DISCONNECTED_EVENT]) {
          nodes {
            ... on ConnectedEvent {
              id
              subject {
                ... on Issue {
                  number
                  title
                  state
                }
              }
            }
            ... on DisconnectedEvent {
              id
              subject {
                ... on Issue {
                  number
                  title
                  state
                }
              }
            }
          }
        }
        subIssues(first: 100) {
          nodes {
            number
            title
            state
            url
          }
        }
        subIssuesSummary {
          total
          completed
          percentCompleted
        }
        trackedIssues(first: 100) {
          nodes {
            number
            title
            state
            repository {
              owner {
                login
              }
              name
            }
          }
        }
        trackedInIssues(first: 100) {
          nodes {
            number
            title
            state
            repository {
              owner {
                login
              }
              name
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_EPIC_ISSUES = `
  query SearchEpicIssues($query: String!) {
    search(query: $query, type: ISSUE, first: 100) {
      nodes {
        ... on Issue {
          id
          number
          title
          url
        }
      }
    }
  }
`;
