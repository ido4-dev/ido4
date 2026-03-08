/**
 * Core service interfaces for dependency injection.
 *
 * All domain services depend on interfaces, not concrete classes.
 * The ServiceContainer wires implementations at initialization.
 */

import type { ValidationResult } from '../domains/tasks/types.js';
import type { ActorIdentity } from '../shared/logger.js';
import type { ToolResponse } from '../shared/tool-response.js';

// ─── GitHub Infrastructure Interfaces ───

export interface IGraphQLClient {
  query<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
  mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface IIssueRepository {
  getTask(issueNumber: number): Promise<TaskData>;
  getTaskWithDetails(issueNumber: number, options?: TaskDetailOptions): Promise<TaskData>;
  createIssue(title: string, body?: string): Promise<{ id: string; number: number; url: string }>;
  updateTaskStatus(issueNumber: number, statusKey: string): Promise<void>;
  updateTaskField(issueNumber: number, fieldKey: string, value: string, fieldType?: string): Promise<void>;
  updateTaskContainer(issueNumber: number, containerName: string): Promise<void>;
  assignTask(issueNumber: number, assignee: string): Promise<void>;
  addComment(issueNumber: number, comment: string): Promise<void>;
  closeIssue(issueNumber: number): Promise<void>;
  addSubIssue(parentIssueId: string, childIssueId: string): Promise<void>;
  findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null>;
  getSubIssues(issueNumber: number): Promise<SubIssueData[]>;
}

export interface IProjectRepository {
  getProjectItems(options?: PaginationOptions): Promise<ProjectItem[]>;
  addItemToProject(contentId: string): Promise<string>;
  updateItemField(itemId: string, fieldId: string, value: string, fieldType?: string): Promise<void>;
  deleteProject(): Promise<void>;
  getContainerStatus(containerName: string): Promise<ContainerStatusData>;
  getCurrentUser(): Promise<UserInfo>;
}

export interface DefaultBranchInfo {
  repositoryId: string;
  branchName: string;
  oid: string;
}

export interface IRepositoryRepository {
  mergePullRequest(prNumber: number, mergeMethod?: string): Promise<void>;
  findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null>;
  checkContainerBranchMerged(containerName: string): Promise<boolean>;
  getPullRequestReviews(prNumber: number): Promise<PullRequestReviewData[]>;
  getDefaultBranchInfo(): Promise<DefaultBranchInfo>;
  createBranch(repositoryId: string, branchName: string, fromOid: string): Promise<{ refId: string }>;
  createPullRequest(repositoryId: string, options: { title: string; body: string; baseBranch: string; headBranch: string }): Promise<{ id: string; number: number; url: string }>;
  closePullRequest(prId: string): Promise<void>;
  deleteBranch(refId: string): Promise<void>;
  createCommitOnBranch(repositoryNameWithOwner: string, branchName: string, expectedHeadOid: string, filePath: string, fileContents: string, message: string): Promise<{ oid: string }>;
  getCommitStatusChecks(prNumber: number): Promise<StatusCheckData[]>;
  getVulnerabilityAlerts(): Promise<CodeScanningAlert[]>;
}

export interface StatusCheckData {
  name: string;
  state: string;
  conclusion: string | null;
}

export interface CodeScanningAlert {
  severity: string;
  summary: string;
}

export interface IEpicRepository {
  searchEpicIssues(searchTerm: string): Promise<EpicIssueData[]>;
  getIssueWithTimeline(issueNumber: number): Promise<IssueTimelineData>;
}

// ─── Domain Service Interfaces ───

export interface ITaskService {
  startTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  reviewTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  approveTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  blockTask(request: BlockTaskRequest): Promise<ToolResponse<TaskTransitionData>>;
  unblockTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  returnTask(request: ReturnTaskRequest): Promise<ToolResponse<TaskTransitionData>>;
  refineTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  readyTask(request: TaskTransitionRequest): Promise<ToolResponse<TaskTransitionData>>;
  getTask(request: GetTaskRequest): Promise<TaskData>;
  getTaskField(request: GetTaskRequest): Promise<unknown>;
  listTasks(request: ListTasksRequest): Promise<ToolResponse<ListTasksData>>;
  createTask(request: CreateTaskRequest): Promise<ToolResponse<CreateTaskData>>;
}

export interface ITaskTransitionValidator {
  validateTransition(issueNumber: number, transition: string): Promise<ValidationResult>;
  validateAllTransitions(issueNumber: number): Promise<AllTransitionsResult>;
}

export interface IContainerService {
  listContainers(): Promise<ContainerSummary[]>;
  getContainerStatus(name: string): Promise<ContainerStatusData>;
  createContainer(name: string, description?: string): Promise<ContainerCreateResult>;
  assignTaskToContainer(issueNumber: number, containerName: string): Promise<ContainerAssignResult>;
  validateContainerCompletion(name: string): Promise<ContainerCompletionResult>;
}

export interface IEpicService {
  getTasksInEpic(epicName: string): Promise<TaskData[]>;
  validateEpicIntegrity(task: TaskData): Promise<IntegrityResult>;
}

export interface IIntegrityValidator {
  validateAssignmentIntegrity(issueNumber: number, containerName: string): Promise<IntegrityResult>;
}

export interface IDependencyService {
  analyzeDependencies(issueNumber: number): Promise<DependencyAnalysisResult>;
  validateDependencies(issueNumber: number): Promise<DependencyValidationResult>;
}

// ─── Configuration Interfaces ───

export interface IProjectConfig {
  project: {
    id: string;
    number: number;
    repository: string;
    title?: string;
    url?: string;
  };
  fields: {
    status_field_id: string;
    wave_field_id: string;
    epic_field_id: string;
    dependencies_field_id: string;
    ai_suitability_field_id: string;
    risk_level_field_id: string;
    effort_field_id: string;
    ai_context_field_id: string;
    [key: string]: string;
  };
  status_options: Record<string, { name: string; id: string }>;
  ai_suitability_options?: Record<string, { name: string; id: string }>;
  risk_level_options?: Record<string, { name: string; id: string }>;
  effort_options?: Record<string, { name: string; id: string }>;
  task_type_options?: Record<string, { name: string; id: string }>;
  wave_config?: {
    format: string;
    autoDetect: boolean;
  };
}

export interface IWorkflowConfig {
  getStatusId(key: string): string;
  getStatusName(key: string): string;
  getFieldId(key: string): string;
  isValidTransition(from: string, to: string): boolean;
  getAllStatusValues(): Record<string, string>;
  /** Returns all valid destination statuses from the given status name */
  getValidNextTransitions(fromStatus: string): string[];
}

export interface IGitWorkflowConfig {
  isEnabled(): boolean;
  requiresPRForReview(): boolean;
  shouldShowGitSuggestions(): boolean;
  shouldDetectGitContext(): boolean;
}

// ─── Data Types ───

export interface TaskData {
  id: string;
  itemId: string;
  number: number;
  title: string;
  body: string;
  status: string;
  wave?: string;
  epic?: string;
  dependencies?: string;
  aiSuitability?: string;
  riskLevel?: string;
  effort?: string;
  taskType?: string;
  aiContext?: string;
  assignees?: string[];
  labels?: string[];
  url?: string;
  closed?: boolean;
}

export interface TaskDetailOptions {
  includeComments?: boolean;
  includeTimeline?: boolean;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface ProjectItem {
  id: string;
  content: {
    number: number;
    title: string;
    body: string;
    url: string;
    closed: boolean;
  };
  fieldValues: Record<string, string>;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  state: string;
  merged: boolean;
  headRefName?: string;
}

export interface UserInfo {
  login: string;
  id: string;
}

export interface ContainerSummary {
  name: string;
  taskCount: number;
  completedCount: number;
  completionPercentage: number;
  status: 'not_started' | 'active' | 'completed';
}

export interface ContainerStatusData {
  name: string;
  tasks: TaskData[];
  metrics: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    ready: number;
  };
}

export interface ContainerCreateResult {
  name: string;
  created: boolean;
}

export interface ContainerAssignResult {
  issueNumber: number;
  container: string;
  integrity: IntegrityResult;
}

export interface ContainerCompletionResult {
  container: string;
  canComplete: boolean;
  reasons: string[];
  tasks: { number: number; title: string; status: string }[];
}

export interface IntegrityResult {
  maintained: boolean;
  violations: string[];
}

export interface EpicIssueData {
  number: number;
  title: string;
  url: string;
}

export interface IssueTimelineData {
  number: number;
  title: string;
  body?: string;
  state?: string;
  url?: string;
  connectedIssues: Array<{ number: number; title: string; state: string }>;
  subIssues: SubIssueData[];
  subIssuesSummary: { total: number; completed: number };
}

export interface SubIssueData {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  url: string;
}

export interface PullRequestReviewData {
  id: string;
  author: string;
  state: 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';
  body: string;
  submittedAt: string;
}

export interface DependencyAnalysisResult {
  issueNumber: number;
  dependencies: DependencyNode[];
  circularDependencies: number[][];
  maxDepth: number;
}

export interface DependencyNode {
  issueNumber: number;
  title: string;
  status: string;
  satisfied: boolean;
  children: DependencyNode[];
}

export interface DependencyValidationResult {
  valid: boolean;
  unsatisfied: number[];
  circular: number[][];
}

export interface AllTransitionsResult {
  issueNumber: number;
  transitions: Record<string, ValidationResult>;
}

export interface TaskTransitionRequest {
  issueNumber: number;
  /** The actor performing this transition — required for governance audit trail */
  actor: ActorIdentity;
  message?: string;
  skipValidation?: boolean;
  dryRun?: boolean;
}

export interface BlockTaskRequest extends TaskTransitionRequest {
  reason: string;
}

export interface ReturnTaskRequest extends TaskTransitionRequest {
  targetStatus: string;
  reason: string;
}

export interface GetTaskRequest {
  issueNumber: number;
  field?: string;
}

/** Data payload for a task transition — governance metadata lives in ToolResponse<T> */
export interface TaskTransitionData {
  issueNumber: number;
  fromStatus: string;
  toStatus: string;
}

export interface Suggestion {
  /** MCP tool name to invoke (e.g., 'start_task', 'assign_wave') */
  action: string;
  description: string;
  parameters: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
  /** When true, agents must request human approval before executing (ADR-14) */
  humanPermissionRequired?: boolean;
}

export interface Warning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AuditValidationDetail {
  stepName: string;
  passed: boolean;
  message?: string;
}

export interface AuditValidationResult {
  stepsRun: number;
  stepsPassed: number;
  stepsFailed: number;
  stepsWarned: number;
  details: AuditValidationDetail[];
}

export interface AuditMetadata {
  wave?: string;
  epic?: string;
  prNumber?: number;
  dryRun?: boolean;
  [key: string]: unknown;
}

export interface AuditEntry {
  timestamp: string;
  transition: string;
  issueNumber: number;
  fromStatus: string;
  toStatus: string;
  /** Structured actor identity — who performed this action (ADR-15) */
  actor: ActorIdentity;
  /** Detailed validation results from the BRE pipeline */
  validationResult: AuditValidationResult;
  /** Contextual metadata for the transition */
  metadata: AuditMetadata;
}

// ─── List / Create Task Interfaces ───

export interface ListTasksRequest {
  /** Filter by status name (e.g., 'In Progress', 'Blocked') */
  status?: string;
  /** Filter by wave name */
  wave?: string;
  /** Filter by assignee login */
  assignee?: string;
}

export interface ListTasksData {
  tasks: TaskData[];
  total: number;
  filters: ListTasksRequest;
}

export interface CreateTaskRequest {
  title: string;
  body?: string;
  /** Initial status key (defaults to 'BACKLOG') */
  initialStatus?: string;
  wave?: string;
  epic?: string;
  aiContext?: string;
  dependencies?: string;
  /** Effort estimate key (XS, S, M, L, XL) */
  effort?: string;
  /** Risk level key (LOW, MEDIUM, HIGH, CRITICAL) */
  riskLevel?: string;
  /** AI suitability key (AI_ONLY, AI_REVIEWED, HYBRID, HUMAN_ONLY) */
  aiSuitability?: string;
  /** Task type key (FEATURE, BUG, ENHANCEMENT, DOCUMENTATION, TESTING) */
  taskType?: string;
  /** The actor performing this action */
  actor: ActorIdentity;
  dryRun?: boolean;
}

export interface CreateTaskData {
  issueNumber: number;
  issueId: string;
  itemId: string;
  url: string;
  title: string;
  status: string;
  fieldsSet: string[];
}

// ─── Project Init Interfaces ───

export interface ProjectInitOptions {
  /** 'create' = new project, 'connect' = existing project */
  mode: 'create' | 'connect';
  /** GitHub repository in owner/repo format */
  repository?: string;
  /** Project name (for create mode) */
  projectName?: string;
  /** Existing project ID (for connect mode, starts with PVT_) */
  projectId?: string;
  /** Absolute path to project root (where .ido4/ will be created) */
  projectRoot: string;
}

export interface ProjectInitResult {
  success: boolean;
  project: {
    id: string;
    number: number;
    title: string;
    url: string;
    repository: string;
  };
  fieldsCreated: string[];
  configPath: string;
}

export interface IProjectInitService {
  initializeProject(options: ProjectInitOptions): Promise<ProjectInitResult>;
  detectRepository(projectRoot: string): Promise<string>;
}

// ─── Audit Service Interface (re-exported from domain) ───

export type {
  IAuditService,
  IAuditStore,
  SerializedDomainEvent,
  PersistedAuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditSummary,
  AuditSummaryOptions,
} from '../domains/audit/index.js';

// ─── Agent Service Interface (re-exported from domain) ───

export type {
  IAgentService,
  IAgentStore,
  AgentRegistration,
  RegisteredAgent,
  TaskLock,
  AgentStoreData,
} from '../domains/agents/index.js';

// ─── Analytics Service Interface (re-exported from domain) ───

export type {
  IAnalyticsService,
  AnalyticsOptions,
  ContainerAnalytics,
  ProjectAnalytics,
  TaskCycleTime,
} from '../domains/analytics/index.js';

// ─── Compliance Service Interface (re-exported from domain) ───

export type {
  IComplianceService,
  ComplianceScoreOptions,
  ComplianceScore,
  CategoryScore,
} from '../domains/compliance/index.js';

// ─── Work Distribution Service Interface (re-exported from domain) ───

export type {
  IWorkDistributionService,
  WorkRecommendation,
  TaskRecommendation,
  ScoreBreakdown,
  HandoffResult,
} from '../domains/distribution/index.js';

// ─── Merge Readiness Service Interface (re-exported from domain) ───

export type {
  IMergeReadinessService,
  MergeGateConfig,
  MergeReadinessResult,
  MergeCheck,
} from '../domains/gate/index.js';
