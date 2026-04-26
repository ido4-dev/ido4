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
  IContainerService,
  IEpicService,
  IIntegrityValidator,
  IDependencyService,
  IProjectConfig,
  IWorkflowConfig,
  IGitWorkflowConfig,
  TaskData,
  TaskDetailOptions,
  TaskComment,
  TaskDataWithComments,
  PaginationOptions,
  ProjectItem,
  PullRequestInfo,
  UserInfo,
  ContainerSummary,
  ContainerStatusData,
  ContainerCreateResult,
  ContainerAssignResult,
  ContainerCompletionResult,
  IntegrityResult,
  EpicIssueData,
  IssueTimelineData,
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
  ListTasksRequest,
  ListTasksData,
  CreateTaskRequest,
  CreateTaskData,
  DefaultBranchInfo,
  StatusCheckData,
  CodeScanningAlert,
  ProjectInitOptions,
  ProjectInitResult,
  IProjectInitService,
  IAuditService,
  IAuditStore,
  SerializedDomainEvent,
  PersistedAuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditSummary,
  AuditSummaryOptions,
  IAgentService,
  IAgentStore,
  AgentRegistration,
  RegisteredAgent,
  TaskLock,
  AgentStoreData,
  IAnalyticsService,
  AnalyticsOptions,
  ContainerAnalytics,
  ProjectAnalytics,
  TaskCycleTime,
  IComplianceService,
  ComplianceScoreOptions,
  ComplianceScore,
  CategoryScore,
  IWorkDistributionService,
  WorkRecommendation,
  TaskRecommendation,
  ScoreBreakdown,
  HandoffResult,
  IMergeReadinessService,
  MergeGateConfig,
  MergeReadinessResult,
  MergeCheck,
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
  ContainerAssignmentEvent,
  ValidationEvent,
  WorkRecommendationEvent,
  TaskHandoffEvent,
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
export { parseIdo4ContextBlocks, parseIdo4ContextComments, filterIdo4ContextComments } from './shared/utils/index.js';
export type { Ido4ContextBlock } from './shared/utils/index.js';
export { formatIdo4ContextComment } from './shared/utils/index.js';
export type { FormatContextOptions } from './shared/utils/index.js';
export { formatIdo4LineageMarker, withLineageMarker, parseIdo4LineageMarker } from './shared/utils/index.js';

// Domain Services — Tasks
export { TaskService } from './domains/tasks/index.js';
export { TaskWorkflowService } from './domains/tasks/index.js';
export type { WorkflowTransitionResult } from './domains/tasks/index.js';
export { TaskTransitionValidator } from './domains/tasks/index.js';
export { ValidationPipeline } from './domains/tasks/index.js';
export { SuggestionService } from './domains/tasks/index.js';
export { ValidationStepRegistry } from './domains/tasks/index.js';
export type { IValidationStepRegistry, StepDependencies, ValidationStepFactory } from './domains/tasks/index.js';
export { registerAllBuiltinSteps } from './domains/tasks/index.js';

// Domain Services — Epics
export { EpicService } from './domains/epics/index.js';
export { IntegrityValidator } from './domains/epics/index.js';

// Domain Services — Dependencies
export { DependencyService } from './domains/dependencies/index.js';

// Domain Services — Containers
export { ContainerService } from './domains/containers/index.js';
export type { IContainerMetadataService, ContainerMetadata } from './domains/containers/index.js';
export { FileContainerMetadataService, InMemoryContainerMetadataService } from './domains/containers/index.js';

// Domain Services — Projects
export { ProjectInitService } from './domains/projects/index.js';

// Domain Services — Audit
export { AuditService } from './domains/audit/index.js';
export { JsonlAuditStore } from './domains/audit/index.js';

// Domain Services — Agents
export { AgentService } from './domains/agents/index.js';
export { FileAgentStore } from './domains/agents/index.js';

// Domain Services — Analytics
export { AnalyticsService } from './domains/analytics/index.js';

// Domain Services — Compliance
export { ComplianceService } from './domains/compliance/index.js';

// Domain Services — Work Distribution
export { WorkDistributionService } from './domains/distribution/index.js';

// Domain Services — Merge Gate
export { MergeReadinessService } from './domains/gate/index.js';

// Domain Services — Ingestion
export { parseSpec, parseStrategicSpec, mapSpec, findGroupingContainer, topologicalSort, IngestionService, STRATEGIC_PRIORITIES, STRATEGIC_RISKS } from './domains/ingestion/index.js';
export type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
  MappedSpec,
  MappedGroupIssue,
  MappedTask,
  MappingError,
  IngestSpecResult,
  IngestSpecOptions,
  ParsedStrategicSpec,
  StrategicProjectHeader,
  StrategicGroup,
  StrategicCapability,
  StrategicParseError,
  CrossCuttingConcern,
  Stakeholder,
  StrategicPriority,
  StrategicRisk,
} from './domains/ingestion/index.js';

// Domain Services — Sandbox
export { SandboxService } from './domains/sandbox/index.js';
export { HYDRO_GOVERNANCE } from './domains/sandbox/index.js';
export { SCRUM_SPRINT } from './domains/sandbox/index.js';
export { SHAPE_UP_CYCLE } from './domains/sandbox/index.js';
export type {
  SandboxScenario,
  ContainerInstanceDefinition,
  ParentIssueDefinition,
  SandboxTaskDefinition,
  AuditSeedEvent,
  AgentSeedDefinition,
  // Deprecated legacy types
  EpicDefinition,
  WaveDefinition,
  TaskDefinition,
  // Service types
  SandboxCreateOptions,
  SandboxCreateResult,
  SandboxDestroyResult,
  SandboxResetResult,
  SeededPRArtifact,
  ISandboxService,
} from './domains/sandbox/index.js';

// Profiles
export type {
  MethodologyProfile,
  StateDefinition,
  TransitionDefinition,
  ContainerTypeDefinition,
  IntegrityRuleDefinition,
  SameContainerRule,
  OrderingRule,
  ContainmentRule,
  PrincipleDefinition,
  WorkItemsDefinition,
  WorkItemTypeDefinition,
  WorkItemHierarchyLevel,
  MethodologyProfileFile,
} from './profiles/index.js';
export { HYDRO_PROFILE, SHAPE_UP_PROFILE, SCRUM_PROFILE, ProfileRegistry } from './profiles/index.js';

// Configuration
export { ProjectConfigLoader } from './config/index.js';
export { WorkflowConfig } from './config/index.js';
export { GitWorkflowConfig } from './config/index.js';
export { MethodologyConfig, MethodologyConfigLoader, DEFAULT_METHODOLOGY } from './config/index.js';
export type { IMethodologyConfig, MethodologyDefinition, MethodologyPipeline } from './config/index.js';
export { ProfileConfigLoader } from './config/index.js';

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
