/**
 * Sandbox domain types — definitions for governed sandbox environments.
 */

// ─── Scenario Definition Types ───

export interface WaveDefinition {
  name: string;
  description: string;
  state: 'completed' | 'active' | 'planned';
}

export interface EpicDefinition {
  ref: string;
  title: string;
  body: string;
}

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
  /** Seed a PR for this task — creates a branch and PR during sandbox setup */
  seedPR?: { branchName: string; prTitle: string };
  /** Comments added to the issue during sandbox setup — use #T_REF placeholders for task cross-references */
  contextComments?: string[];
}

export interface SandboxScenario {
  id: string;
  name: string;
  description: string;
  waves: WaveDefinition[];
  epics: EpicDefinition[];
  tasks: TaskDefinition[];
}

// ─── Service Types ───

export interface SandboxCreateOptions {
  /** GitHub repository in owner/repo format */
  repository: string;
  /** Absolute path to sandbox project root */
  projectRoot: string;
  /** Scenario to use (defaults to 'governance-showcase') */
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
    epics: number;
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
