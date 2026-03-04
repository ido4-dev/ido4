/**
 * Core service interfaces for dependency injection.
 *
 * All domain services depend on interfaces, not concrete classes.
 * The ServiceContainer wires implementations at initialization.
 */

import type { ValidationResult } from '../domains/tasks/types.js';

// ─── GitHub Infrastructure Interfaces ───

export interface IGraphQLClient {
  query<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
  mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T>;
}

export interface IIssueRepository {
  getTask(issueNumber: number): Promise<TaskData>;
  getTaskWithDetails(issueNumber: number, options?: TaskDetailOptions): Promise<TaskData>;
  updateTaskStatus(issueNumber: number, statusKey: string): Promise<void>;
  updateTaskField(issueNumber: number, fieldKey: string, value: string, fieldType?: string): Promise<void>;
  updateTaskWave(issueNumber: number, waveName: string): Promise<void>;
  assignTask(issueNumber: number, assignee: string): Promise<void>;
  addComment(issueNumber: number, comment: string): Promise<void>;
  closeIssue(issueNumber: number): Promise<void>;
  findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null>;
}

export interface IProjectRepository {
  getProjectItems(options?: PaginationOptions): Promise<ProjectItem[]>;
  updateItemField(itemId: string, fieldId: string, value: string, fieldType?: string): Promise<void>;
  getWaveStatus(wave: string): Promise<WaveStatusData>;
  getCurrentUser(): Promise<UserInfo>;
}

export interface IRepositoryRepository {
  mergePullRequest(prNumber: number, mergeMethod?: string): Promise<void>;
  findPullRequestForIssue(issueNumber: number): Promise<PullRequestInfo | null>;
  checkWaveBranchMerged(waveName: string): Promise<boolean>;
}

export interface IEpicRepository {
  searchEpicIssues(searchTerm: string): Promise<EpicIssueData[]>;
  getIssueWithTimeline(issueNumber: number): Promise<IssueTimelineData>;
}

// ─── Domain Service Interfaces ───

export interface ITaskService {
  startTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  reviewTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  approveTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  blockTask(request: BlockTaskRequest): Promise<TaskTransitionResult>;
  unblockTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  returnTask(request: ReturnTaskRequest): Promise<TaskTransitionResult>;
  refineTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  readyTask(request: TaskTransitionRequest): Promise<TaskTransitionResult>;
  getTask(request: GetTaskRequest): Promise<TaskData>;
  getTaskField(request: GetTaskRequest): Promise<unknown>;
}

export interface ITaskTransitionValidator {
  validateTransition(issueNumber: number, transition: string): Promise<ValidationResult>;
  validateAllTransitions(issueNumber: number): Promise<AllTransitionsResult>;
}

export interface IWaveService {
  listWaves(): Promise<WaveSummary[]>;
  getWaveStatus(waveName: string): Promise<WaveStatusData>;
  createWave(name: string, description?: string): Promise<WaveCreateResult>;
  assignTaskToWave(issueNumber: number, waveName: string): Promise<WaveAssignResult>;
  validateWaveCompletion(waveName: string): Promise<WaveCompletionResult>;
}

export interface IEpicService {
  getTasksInEpic(epicName: string): Promise<TaskData[]>;
  validateEpicIntegrity(task: TaskData): Promise<EpicIntegrityResult>;
}

export interface IEpicValidator {
  validateWaveAssignmentEpicIntegrity(issueNumber: number, waveName: string): Promise<EpicIntegrityResult>;
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
  };
  fields: Record<string, string>;
  status_options: Record<string, { name: string; id: string }>;
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
}

export interface UserInfo {
  login: string;
  id: string;
}

export interface WaveSummary {
  name: string;
  taskCount: number;
  completedCount: number;
  completionPercentage: number;
  status: 'not_started' | 'active' | 'completed';
}

export interface WaveStatusData {
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

export interface WaveCreateResult {
  name: string;
  created: boolean;
}

export interface WaveAssignResult {
  issueNumber: number;
  wave: string;
  epicIntegrity: EpicIntegrityResult;
}

export interface WaveCompletionResult {
  wave: string;
  canComplete: boolean;
  reasons: string[];
  tasks: { number: number; title: string; status: string }[];
}

export interface EpicIntegrityResult {
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
  timelineItems: unknown[];
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

export interface TaskTransitionResult {
  success: boolean;
  issueNumber: number;
  fromStatus: string;
  toStatus: string;
  suggestions: Suggestion[];
  warnings: Warning[];
  auditEntry: AuditEntry;
}

export interface Suggestion {
  action: string;
  description: string;
  parameters: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
}

export interface Warning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AuditEntry {
  timestamp: string;
  transition: string;
  issueNumber: number;
  fromStatus: string;
  toStatus: string;
  actor: string;
  validationStepsRun: number;
  validationStepsPassed: number;
  dryRun: boolean;
}
