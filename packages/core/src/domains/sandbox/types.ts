/**
 * Sandbox domain types — definitions for governed sandbox environments.
 *
 * v2 architecture: Sandbox creation uses the ingestion pipeline to create
 * issues from a technical spec, then applies post-ingestion state simulation
 * and violation injection. Scenarios are lightweight definitions referencing
 * a shared technical spec, not hardcoded task lists.
 */

// ─── Scenario Config (Input to ScenarioBuilder) ───

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  profileId: string;
  technicalSpecContent: string;

  /** Execution container layout (waves/sprints/cycles) */
  executionContainers: Array<{
    name: string;
    containerType: string;
    state: 'completed' | 'active' | 'planned';
    description?: string;
    metadata?: Record<string, unknown>;
  }>;

  /** Grouping containers with explicit state (e.g., bets in Shape Up). Optional. */
  groupingContainers?: Array<{
    name: string;
    containerType: string;
    state: 'active' | 'killed';
  }>;

  /** Number of tasks to leave unassigned (cooldown/backlog). Optional. */
  cooldownCount?: number;
}

// ─── v2 Scenario Types (Pipeline-Based — output of ScenarioBuilder) ───

export interface SandboxScenario {
  id: string;
  name: string;
  description: string;
  profileId: string;
  narrative: ScenarioNarrative;

  /** Technical spec content in ingestion format (## Capability: + ### PREFIX-NN:) */
  technicalSpecContent: string;

  /** Execution container instances (waves/sprints/cycles/bets/scopes) */
  containerInstances: ContainerInstanceDefinition[];

  /** Post-ingestion: assign tasks to execution containers. taskRef → { containerTypeId: value } */
  containerAssignments: Record<string, Record<string, string>>;

  /** Post-ingestion: transition tasks to target states. taskRef → status key */
  taskStates: Record<string, string>;

  /** Methodology-specific violation injections applied after state simulation */
  violations: ViolationInjection[];

  /** Backdated audit trail events */
  auditEvents: AuditSeedEvent[];

  /** Agent registrations and task locks */
  agents?: AgentSeedDefinition;

  /** PRs to seed (with real code if patchContent provided) */
  prSeeds?: PRSeedDefinition[];

  /** Context comments per task. taskRef → comment strings (supports #TASK_REF resolution) */
  contextComments: Record<string, string[]>;

  /** Governance memory seed written to .ido4/sandbox-memory-seed.md */
  memorySeed: string;
}

export interface ScenarioNarrative {
  /** One-paragraph project setup — what this team is building and where they are */
  setup: string;
  /** The tension — what's going wrong and why it matters */
  tension: string;
  /** Per-violation context — why this specific violation happened in this story */
  violationContext: Record<string, string>;
  /** What governance should surface when skills analyze this scenario */
  expectedFindings: string[];
  /** What fixing the violations looks like */
  resolution: string;
}

export interface ViolationInjection {
  /** Violation type identifier (EPIC_INTEGRITY, FALSE_STATUS, etc.) */
  type: string;
  /** Task ref to apply the violation to */
  taskRef: string;
  /** The action that creates the violation */
  action: ViolationAction;
  /** Human-readable description of what this violation represents */
  description: string;
}

export type ViolationAction =
  | { kind: 'wrong_container'; containerType: string; wrongValue: string }
  | { kind: 'false_status'; status: string }
  | { kind: 'label'; labels: string[] };

export interface PRSeedDefinition {
  taskRef: string;
  branchName: string;
  prTitle: string;
  /** File path for the PR content (e.g., src/notifications/retry-policy.ts) */
  filePath?: string;
  /** File content for real code changes (vs default .sandbox/ stub) */
  patchContent?: string;
}

// ─── Shared Types (Used by Both v1 and v2) ───

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

// ─── v1 Types (Deprecated — kept for backward compatibility during transition) ───

/** @deprecated Use ContainerInstanceDefinition instead */
export interface WaveDefinition {
  name: string;
  description: string;
  state: 'completed' | 'active' | 'planned';
}

/** @deprecated Use ContainerInstanceDefinition instead */
export interface EpicDefinition {
  ref: string;
  title: string;
  body: string;
}

/** @deprecated Replaced by technical spec ingestion in v2 */
export interface ParentIssueDefinition {
  ref: string;
  title: string;
  body: string;
}

/** @deprecated Replaced by technical spec ingestion + post-ingestion state simulation in v2 */
export interface SandboxTaskDefinition {
  ref: string;
  title: string;
  body: string;
  containers: Record<string, string>;
  parentRef?: string;
  status: string;
  labels?: string[];
  effort?: string;
  riskLevel?: string;
  aiSuitability?: string;
  dependencyRefs?: string[];
  governanceSignal?: string;
  seedPR?: { branchName: string; prTitle: string };
  contextComments?: string[];
}

/** @deprecated Use TaskDefinition from v1 only. Kept for old scenario compatibility. */
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
    capabilities: number;
    tasks: number;
    subIssueRelationships: number;
    containerAssignments: number;
    stateTransitions: number;
    violations: number;
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

// ─── Orphan Sandbox Cleanup (Phase 5 OBS-09) ───
//
// Project V2 doesn't cascade-delete with the repository at the GitHub API
// level. When a user deletes a sandbox repo via `gh repo delete` without
// running destroy_sandbox first, the linked Project V2 outlives the repo
// and accumulates on the user's account. Orphan-cleanup discovers and
// deletes those abandoned projects.

export interface OrphanSandboxProject {
  /** Project V2 node ID */
  projectId: string;
  /** Project V2 number (display) */
  projectNumber: number;
  /** Project V2 title (e.g., "ido4 Sandbox — Hydro Governance") */
  title: string;
  /** Project URL */
  url: string;
  /** Linked repository (owner/name) if any; null if no linked repo or repo deleted */
  linkedRepository: { owner: string; name: string; nameWithOwner: string } | null;
  /** Whether the linked repository still exists. False = orphan candidate. */
  repositoryExists: boolean;
}

export interface ListOrphanSandboxesResult {
  /** All ido4 Sandbox-titled projects on the user's account */
  candidates: OrphanSandboxProject[];
  /** Subset that are orphans (linked repo doesn't exist OR no linked repo) */
  orphans: OrphanSandboxProject[];
}

export interface DeleteOrphanSandboxResult {
  success: boolean;
  projectId: string;
  /** True if the project was actually deleted; false if safety check rejected. */
  deleted: boolean;
  /** Reason set when deleted=false (e.g., title doesn't contain "Sandbox"). */
  reason?: string;
}

// ─── Service Interface ───

export interface ISandboxService {
  createSandbox(options: SandboxCreateOptions): Promise<SandboxCreateResult>;
  destroySandbox(projectRoot: string): Promise<SandboxDestroyResult>;
  resetSandbox(options: SandboxCreateOptions): Promise<SandboxResetResult>;
  /** Phase 5 OBS-09: discover ido4 Sandbox projects on the user's account
   *  whose linked repo no longer exists. Read-only; no mutations. */
  listOrphanSandboxes(): Promise<ListOrphanSandboxesResult>;
  /** Phase 5 OBS-09: delete one orphan sandbox project. Gated by sandbox-title
   *  safety check (project title must contain "Sandbox"). */
  deleteOrphanSandbox(projectId: string): Promise<DeleteOrphanSandboxResult>;
}
