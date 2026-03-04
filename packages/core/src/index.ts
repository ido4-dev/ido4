/**
 * @ido4/core — Development Governance Platform core domain layer.
 *
 * Zero CLI dependencies. Used by @ido4/mcp (MCP server) and optionally by @ido4/cli.
 */

// Container
export { ServiceContainer } from './container/service-container.js';
export type { ServiceContainerConfig } from './container/service-container.js';

// Interfaces (all service contracts)
export type {
  IGraphQLClient,
  IIssueRepository,
  IProjectRepository,
  IRepositoryRepository,
  IEpicRepository,
  ITaskService,
  ITaskTransitionValidator,
  IWaveService,
  IEpicService,
  IEpicValidator,
  IDependencyService,
  IProjectConfig,
  IWorkflowConfig,
  IGitWorkflowConfig,
  TaskData,
  TaskDetailOptions,
  PaginationOptions,
  ProjectItem,
  PullRequestInfo,
  UserInfo,
  WaveSummary,
  WaveStatusData,
  WaveCreateResult,
  WaveAssignResult,
  WaveCompletionResult,
  EpicIntegrityResult,
  DependencyAnalysisResult,
  DependencyNode,
  DependencyValidationResult,
  AllTransitionsResult,
  TaskTransitionRequest,
  BlockTaskRequest,
  ReturnTaskRequest,
  GetTaskRequest,
  TaskTransitionResult,
  Suggestion,
  Warning,
  AuditEntry,
} from './container/interfaces.js';

// Domain types
export type {
  TransitionType,
  ValidationResult,
  ValidationStepResult,
  ValidationStep,
  ValidationContext,
  WorkflowStatusKey,
  WorkflowStatusValue,
} from './domains/tasks/types.js';

export { WORKFLOW_STATUSES } from './domains/tasks/types.js';

// Errors
export {
  Ido4Error,
  ValidationError,
  BusinessRuleError,
  GitHubAPIError,
  RateLimitError,
  ConfigurationError,
  NotFoundError,
} from './shared/errors/index.js';
