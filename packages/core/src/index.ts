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
  TaskTransitionData,
  Suggestion,
  Warning,
  AuditEntry,
  AuditValidationResult,
  AuditValidationDetail,
  AuditMetadata,
  SubIssueData,
  PullRequestReviewData,
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

// Logger
export type {
  ILogger,
  LogContext,
  AuditContext,
  ActorIdentity,
  PerformanceContext,
  LogEntry,
} from './shared/logger.js';
export { ConsoleLogger } from './shared/console-logger.js';
export { NoopLogger } from './shared/noop-logger.js';

// Actor utilities
export { SYSTEM_ACTOR, serializeActor, parseActor } from './shared/actor.js';

// Tool response
export type { ToolResponse } from './shared/tool-response.js';

// Event system
export type {
  GovernanceEvent,
  TaskTransitionEvent,
  WaveAssignmentEvent,
  ValidationEvent,
  DomainEvent,
  DomainEventType,
  IEventBus,
  EventHandler,
  Unsubscribe,
  InMemoryEventBusOptions,
} from './shared/events/index.js';
export { InMemoryEventBus } from './shared/events/index.js';

// Sanitizer
export type { SanitizeResult } from './shared/sanitizer/index.js';
export { InputSanitizer } from './shared/sanitizer/index.js';

// Utilities
export { FieldExtractor } from './shared/utils/index.js';
export type { FieldValue, CommonFields } from './shared/utils/index.js';
export { EpicUtils } from './shared/utils/index.js';
export { DateFormatter } from './shared/utils/index.js';

// Domain Services — Tasks
export { TaskService } from './domains/tasks/index.js';
export { TaskWorkflowService } from './domains/tasks/index.js';
export type { WorkflowTransitionResult } from './domains/tasks/index.js';
export { TaskTransitionValidator } from './domains/tasks/index.js';
export { ValidationPipeline } from './domains/tasks/index.js';
export { SuggestionService } from './domains/tasks/index.js';

// Domain Services — Epics
export { EpicService } from './domains/epics/index.js';
export { EpicValidator } from './domains/epics/index.js';

// Domain Services — Dependencies
export { DependencyService } from './domains/dependencies/index.js';

// Domain Services — Waves
export { WaveService } from './domains/waves/index.js';

// Configuration
export { ProjectConfigLoader } from './config/index.js';
export { WorkflowConfig } from './config/index.js';
export { GitWorkflowConfig } from './config/index.js';

// Infrastructure — GitHub
export {
  GitHubGraphQLClient,
  CredentialManager,
  GraphQLErrorMapper,
  GitHubIssueRepository,
  GitHubProjectRepository,
  GitHubRepositoryRepository,
  GitHubEpicRepository,
} from './infrastructure/github/index.js';
export type {
  ICredentialManager,
  RateLimitState,
  RetryConfig,
  PageInfo,
  PaginatedQueryOptions,
} from './infrastructure/github/index.js';
export { DEFAULT_RETRY_CONFIG } from './infrastructure/github/index.js';
