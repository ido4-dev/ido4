/**
 * ServiceContainer — Central dependency injection and session-scoped caching.
 *
 * Replaces the 1022-line base-command.ts monolith. Creates all services once
 * per session and reuses them across MCP tool calls.
 *
 * Usage:
 *   const container = await ServiceContainer.create({ projectRoot: '/path/to/project' });
 *   const taskService = container.taskService;
 *   const result = await taskService.startTask({ issueNumber: 42 });
 */

import type {
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
} from './interfaces.js';
import type { ILogger } from '../shared/logger.js';
import type { IEventBus } from '../shared/events/index.js';
import { InMemoryEventBus } from '../shared/events/index.js';
import { NoopLogger } from '../shared/noop-logger.js';
import { ProjectConfigLoader } from '../config/project-config-loader.js';
import { WorkflowConfig } from '../config/workflow-config.js';
import { GitWorkflowConfig } from '../config/git-workflow-config.js';
import { CredentialManager } from '../infrastructure/github/core/credential-manager.js';
import { GitHubGraphQLClient } from '../infrastructure/github/core/graphql-client.js';
import { GitHubIssueRepository } from '../infrastructure/github/repositories/issue-repository.js';
import { GitHubProjectRepository } from '../infrastructure/github/repositories/project-repository.js';
import { GitHubRepositoryRepository } from '../infrastructure/github/repositories/repository-repository.js';
import { GitHubEpicRepository } from '../infrastructure/github/repositories/epic-repository.js';
import { EpicService } from '../domains/epics/epic-service.js';
import { EpicValidator } from '../domains/epics/epic-validator.js';
import { DependencyService } from '../domains/dependencies/dependency-service.js';
import { TaskTransitionValidator } from '../domains/tasks/task-transition-validator.js';
import { TaskWorkflowService } from '../domains/tasks/task-workflow-service.js';
import { SuggestionService } from '../domains/tasks/suggestion-service.js';
import { TaskService } from '../domains/tasks/task-service.js';
import { WaveService } from '../domains/waves/wave-service.js';

export interface ServiceContainerConfig {
  /** Absolute path to the project root (containing .ido4/ directory) */
  projectRoot: string;
  /** GitHub token override (otherwise reads from env / gh CLI) */
  githubToken?: string;
  /** Logger instance (defaults to NoopLogger if not provided) */
  logger?: ILogger;
  /** Session ID for log/event correlation (auto-generated if omitted) */
  sessionId?: string;
  /** Agent identity for multi-agent scenarios */
  agentId?: string;
  /** Event bus instance (defaults to InMemoryEventBus if not provided) */
  eventBus?: IEventBus;
}

export class ServiceContainer {
  // Session identity
  readonly sessionId: string;
  readonly agentId?: string;
  readonly eventBus: IEventBus;

  // Logging
  readonly logger: ILogger;

  // Configuration
  readonly projectConfig: IProjectConfig;
  readonly workflowConfig: IWorkflowConfig;
  readonly gitWorkflowConfig: IGitWorkflowConfig;

  // Infrastructure
  readonly graphqlClient: IGraphQLClient;
  readonly issueRepository: IIssueRepository;
  readonly projectRepository: IProjectRepository;
  readonly repositoryRepository: IRepositoryRepository;
  readonly epicRepository: IEpicRepository;

  // Domain Services
  readonly taskService: ITaskService;
  readonly taskTransitionValidator: ITaskTransitionValidator;
  readonly waveService: IWaveService;
  readonly epicService: IEpicService;
  readonly epicValidator: IEpicValidator;
  readonly dependencyService: IDependencyService;

  private constructor(deps: ServiceContainerDependencies) {
    this.sessionId = deps.sessionId;
    this.agentId = deps.agentId;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.projectConfig = deps.projectConfig;
    this.workflowConfig = deps.workflowConfig;
    this.gitWorkflowConfig = deps.gitWorkflowConfig;
    this.graphqlClient = deps.graphqlClient;
    this.issueRepository = deps.issueRepository;
    this.projectRepository = deps.projectRepository;
    this.repositoryRepository = deps.repositoryRepository;
    this.epicRepository = deps.epicRepository;
    this.taskService = deps.taskService;
    this.taskTransitionValidator = deps.taskTransitionValidator;
    this.waveService = deps.waveService;
    this.epicService = deps.epicService;
    this.epicValidator = deps.epicValidator;
    this.dependencyService = deps.dependencyService;
  }

  /**
   * Create a fully initialized ServiceContainer.
   *
   * Loads project config, initializes GitHub client, constructs all services.
   * Call once per MCP session, reuse across tool calls.
   *
   * 6-layer initialization:
   * 1. Defaults (session ID, logger, event bus)
   * 2. Configuration (project config, workflow config, git workflow config)
   * 3. Infrastructure (credential manager, GraphQL client)
   * 4. Repositories (issue, project, repository, epic)
   * 5. Domain Services (epic, dependency, BRE)
   * 6. Facade (workflow service, suggestion service, task service, wave service)
   */
  static async create(config: ServiceContainerConfig): Promise<ServiceContainer> {
    // Layer 1: Defaults
    const sessionId = config.sessionId ?? crypto.randomUUID();
    const logger = config.logger ?? new NoopLogger();
    const eventBus = config.eventBus ?? new InMemoryEventBus();

    // Layer 2: Configuration
    const projectConfig = await ProjectConfigLoader.load(config.projectRoot);
    const workflowConfig = new WorkflowConfig(projectConfig);
    const gitWorkflowConfig = await GitWorkflowConfig.load(config.projectRoot);

    // Layer 3: Infrastructure
    const credentialManager = new CredentialManager(logger, config.githubToken);
    const graphqlClient = new GitHubGraphQLClient(credentialManager, logger);

    // Layer 4: Repositories
    const issueRepository = new GitHubIssueRepository(graphqlClient, projectConfig, logger);
    const projectRepository = new GitHubProjectRepository(graphqlClient, projectConfig, logger);
    const repositoryRepository = new GitHubRepositoryRepository(graphqlClient, projectConfig, logger);
    const epicRepository = new GitHubEpicRepository(graphqlClient, projectConfig, logger);

    // Layer 5: Domain Services
    const epicService = new EpicService(projectRepository, logger);
    const epicValidator = new EpicValidator(epicService, issueRepository, logger);
    const dependencyService = new DependencyService(issueRepository, workflowConfig, logger);

    // Layer 5b: BRE
    const taskTransitionValidator = new TaskTransitionValidator(
      issueRepository, projectConfig, workflowConfig,
      epicValidator, repositoryRepository, gitWorkflowConfig, logger,
    );

    // Layer 6: Facade
    const suggestionService = new SuggestionService(workflowConfig, gitWorkflowConfig);
    const workflowService = new TaskWorkflowService(
      issueRepository, taskTransitionValidator, workflowConfig, logger,
    );
    const taskService = new TaskService(
      workflowService, suggestionService, taskTransitionValidator,
      issueRepository, projectRepository, projectConfig, workflowConfig, eventBus, sessionId, logger,
    );
    const waveService = new WaveService(
      projectRepository, issueRepository, epicValidator, workflowConfig, logger,
    );

    return new ServiceContainer({
      sessionId,
      agentId: config.agentId,
      eventBus,
      logger,
      projectConfig,
      workflowConfig,
      gitWorkflowConfig,
      graphqlClient,
      issueRepository,
      projectRepository,
      repositoryRepository,
      epicRepository,
      taskService,
      taskTransitionValidator,
      waveService,
      epicService,
      epicValidator,
      dependencyService,
    });
  }
}

interface ServiceContainerDependencies {
  sessionId: string;
  agentId?: string;
  eventBus: IEventBus;
  logger: ILogger;
  projectConfig: IProjectConfig;
  workflowConfig: IWorkflowConfig;
  gitWorkflowConfig: IGitWorkflowConfig;
  graphqlClient: IGraphQLClient;
  issueRepository: IIssueRepository;
  projectRepository: IProjectRepository;
  repositoryRepository: IRepositoryRepository;
  epicRepository: IEpicRepository;
  taskService: ITaskService;
  taskTransitionValidator: ITaskTransitionValidator;
  waveService: IWaveService;
  epicService: IEpicService;
  epicValidator: IEpicValidator;
  dependencyService: IDependencyService;
}
