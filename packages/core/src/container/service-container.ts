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

export interface ServiceContainerConfig {
  /** Absolute path to the project root (containing .ido4/ directory) */
  projectRoot: string;
  /** GitHub token override (otherwise reads from env / gh CLI) */
  githubToken?: string;
}

export class ServiceContainer {
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
   */
  static async create(config: ServiceContainerConfig): Promise<ServiceContainer> {
    // TODO: Phase 1 implementation
    // 1. Load ProjectConfig from config.projectRoot + '/.ido4/project-info.json'
    // 2. Create WorkflowConfig from ProjectConfig
    // 3. Load GitWorkflowConfig from config.projectRoot + '/.ido4/git-workflow.json'
    // 4. Create GraphQLClient with retry, rate limiting (using config.githubToken or CredentialManager)
    // 5. Create repositories (IssueRepository, ProjectRepository, RepositoryRepository, EpicRepository)
    // 6. Create EpicService, EpicDetector, EpicValidator
    // 7. Create TaskTransitionValidator with full pipeline
    // 8. Create TaskService (TaskWorkflowService + TaskCompletionService)
    // 9. Create WaveService
    // 10. Create DependencyService

    throw new Error('ServiceContainer.create() not yet implemented — Phase 1 work');
  }
}

interface ServiceContainerDependencies {
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
