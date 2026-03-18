/**
 * Sandbox domain types — definitions for governed sandbox environments.
 *
 * These types are methodology-agnostic. Container types, parent issues,
 * and task structures are expressed generically and resolved at runtime
 * via the profile's container definitions.
 */

// ─── Scenario Definition Types ───

/** @deprecated Use ContainerInstanceDefinition instead */
export interface WaveDefinition {
  name: string;
  description: string;
  state: 'completed' | 'active' | 'planned';
}

/** @deprecated Use ParentIssueDefinition instead */
export interface EpicDefinition {
  ref: string;
  title: string;
  body: string;
}

/** @deprecated Use SandboxTaskDefinition instead */
export interface TaskDefinition {
  ref: string;
  title: string;
  body: string;
  epicRef: string;
  wave: string;
  status: string;
  effort: string;
  riskLevel: string;
  aiSuitability: string;
  dependencyRefs?: string[];
  governanceSignal?: string;
  seedPR?: { branchName: string; prTitle: string };
  contextComments?: string[];
}

// ─── Generic Scenario Types ───

export interface ContainerInstanceDefinition {
  ref: string;
  /** Matches a profile container type ID (wave, sprint, cycle, bet, scope) */
  containerType: string;
  /** Actual container name (wave-001-foundation, Sprint 14, cycle-003) */
  name: string;
  description?: string;
  state: 'completed' | 'active' | 'planned' | 'killed';
  /** Extra metadata, e.g. { startDate: '2026-02-04' } for circuit breaker */
  metadata?: Record<string, unknown>;
}

export interface ParentIssueDefinition {
  ref: string;
  title: string;
  body: string;
}

export interface SandboxTaskDefinition {
  ref: string;
  title: string;
  body: string;
  /** containerTypeId → containerInstanceName */
  containers: Record<string, string>;
  /** For sub-issue relationships (epicRef, betRef) */
  parentRef?: string;
  status: string;
  /** For Scrum type labels (type:story, type:bug, etc.) */
  labels?: string[];
  effort?: string;
  riskLevel?: string;
  aiSuitability?: string;
  dependencyRefs?: string[];
  governanceSignal?: string;
  seedPR?: { branchName: string; prTitle: string };
  contextComments?: string[];
}

export interface AuditSeedEvent {
  taskRef: string;
  transition: string;
  fromStatus: string;
  toStatus: string;
  daysAgo: number;
  hoursOffset?: number;
  actor?: string;
}

export interface AgentSeedDefinition {
  agents: Array<{ agentId: string; name: string; role: 'coding'; capabilities: string[] }>;
  locks?: Array<{ agentId: string; taskRef: string }>;
}

export interface SandboxScenario {
  id: string;
  name: string;
  description: string;
  profileId: string;
  containerInstances: ContainerInstanceDefinition[];
  parentIssues: ParentIssueDefinition[];
  tasks: SandboxTaskDefinition[];
  auditEvents: AuditSeedEvent[];
  agents?: AgentSeedDefinition;
  memorySeed: string;
}

// ─── Service Types ───

export interface SandboxCreateOptions {
  /** GitHub repository in owner/repo format */
  repository: string;
  /** Absolute path to sandbox project root */
  projectRoot: string;
  /** Scenario to use (defaults to 'hydro-governance') */
  scenarioId?: string;
}

export interface SandboxCreateResult {
  success: boolean;
  project: {
    id: string;
    number: number;
    title: string;
    url: string;
    repository: string;
  };
  scenario: string;
  created: {
    parentIssues: number;
    containerInstances: number;
    tasks: number;
    subIssueRelationships: number;
    closedTasks: number;
    pullRequests: number;
    contextComments: number;
    auditEvents: number;
    registeredAgents: number;
  };
  configPath: string;
}

export interface SandboxDestroyResult {
  success: boolean;
  projectId: string;
  issuesClosed: number;
  projectDeleted: boolean;
  configRemoved: boolean;
}

export interface SandboxResetResult {
  destroyed: SandboxDestroyResult;
  created: SandboxCreateResult;
}

export interface SeededPRArtifact {
  prId: string;
  refId: string;
  branchName: string;
  taskRef: string;
}

// ─── Service Interface ───

export interface ISandboxService {
  createSandbox(options: SandboxCreateOptions): Promise<SandboxCreateResult>;
  destroySandbox(projectRoot: string): Promise<SandboxDestroyResult>;
  resetSandbox(options: SandboxCreateOptions): Promise<SandboxResetResult>;
}
