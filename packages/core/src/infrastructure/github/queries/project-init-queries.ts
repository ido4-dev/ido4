/**
 * GraphQL queries for project initialization.
 *
 * Used by ProjectInitService to create/connect GitHub Projects V2,
 * set up custom fields, and read back field IDs for config generation.
 */

// ─── Response Types ───

export interface RepositoryOwnerResponse {
  repository: {
    id: string;
    owner: {
      id: string;
      login: string;
    };
    projectsV2: {
      nodes: Array<{
        id: string;
        number: number;
        title: string;
        url: string;
      }>;
    };
  };
}

export interface CreateProjectResponse {
  createProjectV2: {
    projectV2: {
      id: string;
      number: number;
      title: string;
      url: string;
      owner: {
        login: string;
      };
    };
  };
}

export interface CreateFieldTextResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType: string;
    };
  };
}

export interface CreateFieldSingleSelectResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType: string;
      options: Array<{
        id: string;
        name: string;
        color: string;
      }>;
    };
  };
}

export interface ProjectFieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface UpdateFieldSingleSelectResponse {
  updateProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      options: Array<{
        id: string;
        name: string;
        color: string;
      }>;
    };
  };
}

export interface GetProjectWithFieldsResponse {
  node: {
    id: string;
    number: number;
    title: string;
    url: string;
    fields: {
      nodes: ProjectFieldNode[];
    };
  };
}

// ─── Queries ───

export const GET_REPOSITORY_OWNER = `
  query GetRepositoryOwner($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      owner {
        id
        ... on User { login }
        ... on Organization { login }
      }
      projectsV2(first: 20) {
        nodes {
          id
          number
          title
          url
        }
      }
    }
  }
`;

export const CREATE_PROJECT = `
  mutation CreateProject($ownerId: ID!, $title: String!) {
    createProjectV2(input: {
      ownerId: $ownerId,
      title: $title
    }) {
      projectV2 {
        id
        number
        title
        url
        owner {
          ... on User { login }
          ... on Organization { login }
        }
      }
    }
  }
`;

export const CREATE_FIELD_TEXT = `
  mutation CreateFieldText($projectId: ID!, $name: String!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      dataType: TEXT,
      name: $name
    }) {
      projectV2Field {
        ... on ProjectV2Field {
          id
          name
          dataType
        }
      }
    }
  }
`;

export const CREATE_FIELD_SINGLE_SELECT = `
  mutation CreateFieldSingleSelect($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
    createProjectV2Field(input: {
      projectId: $projectId,
      dataType: SINGLE_SELECT,
      name: $name,
      singleSelectOptions: $options
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField {
          id
          name
          dataType
          options {
            id
            name
            color
          }
        }
      }
    }
  }
`;

export const UPDATE_FIELD_SINGLE_SELECT = `
  mutation UpdateFieldSingleSelect($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
    updateProjectV2Field(input: {
      fieldId: $fieldId,
      singleSelectOptions: $options
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField {
          id
          name
          options {
            id
            name
            color
          }
        }
      }
    }
  }
`;

export const GET_PROJECT_WITH_FIELDS = `
  query GetProjectWithFields($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        id
        number
        title
        url
        fields(first: 30) {
          nodes {
            ... on ProjectV2Field {
              id
              name
              dataType
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              dataType
              options {
                id
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Field Option Constants ───

export interface FieldOptionInput {
  name: string;
  color: string;
  description?: string;
}

export const FIELD_OPTIONS = {
  AI_SUITABILITY: [
    { name: 'ai-only', color: 'GREEN', description: 'Fully automated AI execution' },
    { name: 'ai-reviewed', color: 'BLUE', description: 'AI execution with human review' },
    { name: 'hybrid', color: 'YELLOW', description: 'Collaborative human-AI execution' },
    { name: 'human-only', color: 'RED', description: 'Manual human execution only' },
  ] satisfies FieldOptionInput[],
  RISK_LEVEL: [
    { name: 'Low', color: 'GREEN', description: 'Minimal impact risk' },
    { name: 'Medium', color: 'YELLOW', description: 'Moderate impact risk' },
    { name: 'High', color: 'ORANGE', description: 'Significant impact risk' },
    { name: 'Critical', color: 'RED', description: 'Critical system impact' },
  ] satisfies FieldOptionInput[],
  EFFORT: [
    { name: 'XS', color: 'GREEN', description: 'Extra small (< 2 hours)' },
    { name: 'S', color: 'BLUE', description: 'Small (2-4 hours)' },
    { name: 'M', color: 'YELLOW', description: 'Medium (4-8 hours)' },
    { name: 'L', color: 'ORANGE', description: 'Large (1-3 days)' },
    { name: 'XL', color: 'RED', description: 'Extra large (> 3 days)' },
  ] satisfies FieldOptionInput[],
  TASK_TYPE: [
    { name: 'Feature', color: 'GREEN', description: 'New functionality' },
    { name: 'Bug', color: 'RED', description: 'Defect fix' },
    { name: 'Enhancement', color: 'BLUE', description: 'Improvement to existing feature' },
    { name: 'Documentation', color: 'GRAY', description: 'Documentation update' },
    { name: 'Testing', color: 'PURPLE', description: 'Test implementation' },
  ] satisfies FieldOptionInput[],
  STATUS: [
    { name: 'Backlog', color: 'GRAY', description: 'Not yet started' },
    { name: 'In Refinement', color: 'BLUE', description: 'Being refined and clarified' },
    { name: 'Ready for Dev', color: 'BLUE', description: 'Ready to start development' },
    { name: 'Blocked', color: 'RED', description: 'Blocked by dependencies' },
    { name: 'In Progress', color: 'YELLOW', description: 'Active development' },
    { name: 'In Review', color: 'ORANGE', description: 'Under review' },
    { name: 'Done', color: 'GREEN', description: 'Completed' },
  ] satisfies FieldOptionInput[],
} as const;

/** Mapping from status display name to config key */
export const STATUS_NAME_TO_KEY: Record<string, string> = {
  'Backlog': 'BACKLOG',
  'In Refinement': 'IN_REFINEMENT',
  'Ready for Dev': 'READY_FOR_DEV',
  'Blocked': 'BLOCKED',
  'In Progress': 'IN_PROGRESS',
  'In Review': 'IN_REVIEW',
  'Done': 'DONE',
};

// ─── Profile-Aware Builders ───

import type { MethodologyProfile } from '../../../profiles/types.js';

/** Color mapping for state categories → GitHub status field colors. */
const STATE_CATEGORY_COLORS: Record<string, string[]> = {
  todo: ['GRAY', 'BLUE', 'PURPLE', 'PINK'],
  active: ['YELLOW', 'ORANGE'],
  done: ['GREEN'],
  blocked: ['RED'],
};

/**
 * Build GitHub status field options from a MethodologyProfile.
 * Assigns colors by state category with rotation within each category.
 */
export function buildStatusOptionsForProfile(profile: MethodologyProfile): FieldOptionInput[] {
  const categoryCounters: Record<string, number> = {};
  return profile.states.map((state) => {
    const colors = STATE_CATEGORY_COLORS[state.category] ?? ['GRAY'];
    const idx = categoryCounters[state.category] ?? 0;
    categoryCounters[state.category] = idx + 1;
    return {
      name: state.name,
      color: colors[idx % colors.length]!,
      description: `${state.category} state`,
    };
  });
}

/**
 * Build status name → config key mapping from a MethodologyProfile.
 * Maps state.name → state.key from profile.states.
 */
export function buildStatusNameToKeyForProfile(profile: MethodologyProfile): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const state of profile.states) {
    mapping[state.name] = state.key;
  }
  return mapping;
}

/** Mapping from single-select field display names to config keys */
export const OPTION_NAME_TO_KEY: Record<string, Record<string, string>> = {
  'AI Suitability': {
    'ai-only': 'AI_ONLY',
    'ai-reviewed': 'AI_REVIEWED',
    'hybrid': 'HYBRID',
    'human-only': 'HUMAN_ONLY',
  },
  'Risk Level': {
    'Low': 'LOW',
    'Medium': 'MEDIUM',
    'High': 'HIGH',
    'Critical': 'CRITICAL',
  },
  'Effort': {
    'XS': 'XS',
    'S': 'S',
    'M': 'M',
    'L': 'L',
    'XL': 'XL',
  },
  'Task Type': {
    'Feature': 'FEATURE',
    'Bug': 'BUG',
    'Enhancement': 'ENHANCEMENT',
    'Documentation': 'DOCUMENTATION',
    'Testing': 'TESTING',
  },
};
