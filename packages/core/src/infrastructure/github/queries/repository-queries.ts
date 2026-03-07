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

export interface GetDefaultBranchResponse {
  repository: {
    id: string;
    defaultBranchRef: {
      name: string;
      target: {
        oid: string;
      };
    };
  };
}

export interface CreateRefResponse {
  createRef: {
    ref: {
      id: string;
      name: string;
    };
  };
}

export interface CreatePullRequestResponse {
  createPullRequest: {
    pullRequest: {
      id: string;
      number: number;
      url: string;
    };
  };
}

export interface ClosePullRequestResponse {
  closePullRequest: {
    pullRequest: {
      id: string;
      state: string;
    };
  };
}

export interface DeleteRefResponse {
  deleteRef: {
    clientMutationId: string | null;
  };
}

export interface GetCommitStatusChecksResponse {
  repository: {
    pullRequest: {
      commits: {
        nodes: Array<{
          commit: {
            statusCheckRollup: {
              contexts: {
                nodes: Array<{
                  __typename: string;
                  name?: string;
                  context?: string;
                  state?: string;
                  conclusion?: string;
                  status?: string;
                }>;
              };
            } | null;
          };
        }>;
      };
    } | null;
  };
}

export interface CreateCommitOnBranchResponse {
  createCommitOnBranch: {
    commit: {
      oid: string;
      url: string;
    };
  };
}

export interface GetCodeScanningAlertsResponse {
  repository: {
    vulnerabilityAlerts: {
      nodes: Array<{
        securityVulnerability: {
          severity: string;
          advisory: {
            summary: string;
          };
        };
      }>;
    };
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

export const GET_DEFAULT_BRANCH = `
  query GetDefaultBranch($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      id
      defaultBranchRef {
        name
        target {
          oid
        }
      }
    }
  }
`;

export const CREATE_REF = `
  mutation CreateRef($repositoryId: ID!, $name: String!, $oid: GitObjectID!) {
    createRef(input: { repositoryId: $repositoryId, name: $name, oid: $oid }) {
      ref {
        id
        name
      }
    }
  }
`;

export const CREATE_PULL_REQUEST = `
  mutation CreatePullRequest($repositoryId: ID!, $title: String!, $body: String!, $baseRefName: String!, $headRefName: String!) {
    createPullRequest(input: {
      repositoryId: $repositoryId
      title: $title
      body: $body
      baseRefName: $baseRefName
      headRefName: $headRefName
    }) {
      pullRequest {
        id
        number
        url
      }
    }
  }
`;

export const CLOSE_PULL_REQUEST = `
  mutation ClosePullRequest($pullRequestId: ID!) {
    closePullRequest(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        state
      }
    }
  }
`;

export const DELETE_REF = `
  mutation DeleteRef($refId: ID!) {
    deleteRef(input: { refId: $refId }) {
      clientMutationId
    }
  }
`;

export const GET_COMMIT_STATUS_CHECKS = `
  query GetCommitStatusChecks($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      conclusion
                      status
                    }
                    ... on StatusContext {
                      context
                      state
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const CREATE_COMMIT_ON_BRANCH = `
  mutation CreateCommitOnBranch(
    $repositoryNameWithOwner: String!,
    $branchName: String!,
    $expectedHeadOid: GitObjectID!,
    $headline: String!,
    $fileContents: Base64String!,
    $filePath: String!
  ) {
    createCommitOnBranch(input: {
      branch: {
        repositoryNameWithOwner: $repositoryNameWithOwner
        branchName: $branchName
      }
      message: { headline: $headline }
      expectedHeadOid: $expectedHeadOid
      fileChanges: {
        additions: [{ path: $filePath, contents: $fileContents }]
      }
    }) {
      commit {
        oid
        url
      }
    }
  }
`;

export const GET_VULNERABILITY_ALERTS = `
  query GetVulnerabilityAlerts($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      vulnerabilityAlerts(first: 100, states: [OPEN]) {
        nodes {
          securityVulnerability {
            severity
            advisory {
              summary
            }
          }
        }
      }
    }
  }
`;
