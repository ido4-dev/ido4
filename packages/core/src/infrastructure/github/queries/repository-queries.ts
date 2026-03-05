/**
 * GraphQL queries for RepositoryRepository.
 *
 * Co-locates query strings with their response type interfaces.
 */

// ─── Response Types ───

export interface GetPullRequestResponse {
  repository: {
    pullRequest: {
      id: string;
      state: string;
      mergeable: string;
      title: string;
      headRefName: string;
    } | null;
  };
}

export interface MergePullRequestResponse {
  mergePullRequest: {
    pullRequest: {
      id: string;
      state: string;
      merged: boolean;
    };
  };
}

export interface GetBranchMergeStatusResponse {
  repository: {
    ref: {
      name: string;
      target: {
        oid: string;
      };
    } | null;
    defaultBranchRef: {
      name: string;
      target: {
        oid: string;
        history: {
          nodes: Array<{ oid: string }>;
        };
      };
    } | null;
  };
}

export interface GetPRReviewsResponse {
  repository: {
    pullRequest: {
      reviews: {
        nodes: Array<{
          id: string;
          author: { login: string } | null;
          state: string;
          body: string;
          submittedAt: string;
        }>;
      };
    } | null;
  };
}

// ─── Queries ───

export const GET_PULL_REQUEST = `
  query GetPullRequest($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        id
        state
        mergeable
        title
        headRefName
      }
    }
  }
`;

export const MERGE_PULL_REQUEST = `
  mutation MergePullRequest($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
    mergePullRequest(input: {
      pullRequestId: $pullRequestId
      mergeMethod: $mergeMethod
    }) {
      pullRequest {
        id
        state
        merged
      }
    }
  }
`;

export const FIND_PR_FOR_ISSUE_REPO = `
  query FindPullRequestForIssueRepo($owner: String!, $repo: String!) {
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

export const GET_BRANCH_MERGE_STATUS = `
  query GetBranchMergeStatus($owner: String!, $name: String!, $branchName: String!) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $branchName) {
        name
        target {
          oid
        }
      }
      defaultBranchRef {
        name
        target {
          oid
          ... on Commit {
            history(first: 100) {
              nodes {
                oid
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_PR_REVIEWS = `
  query GetPRReviews($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviews(first: 50) {
          nodes {
            id
            author {
              login
            }
            state
            body
            submittedAt
          }
        }
      }
    }
  }
`;
