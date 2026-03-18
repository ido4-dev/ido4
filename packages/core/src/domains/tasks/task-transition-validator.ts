/**
 * TaskTransitionValidator — BRE orchestrator implementing ITaskTransitionValidator.
 *
 * Uses IMethodologyConfig to determine which validation steps run per transition,
 * and IValidationStepRegistry to instantiate them with dependency injection.
 *
 * Phase 3: Derives transition actions from profile. Uses type-scoped pipeline resolution.
 */

import type {
  ITaskTransitionValidator,
  IIssueRepository,
  IProjectConfig,
  IWorkflowConfig,
  IIntegrityValidator,
  IRepositoryRepository,
  IGitWorkflowConfig,
  AllTransitionsResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { ValidationResult, TransitionType, ValidationContext } from './types.js';
import type { IMethodologyConfig } from '../../config/methodology-config.js';
import type { IValidationStepRegistry, StepDependencies } from './validation-step-registry.js';
import type { IAgentService } from '../agents/agent-service.js';
import type { IContainerMetadataService } from '../containers/container-metadata-service.js';
import type { MethodologyProfile } from '../../profiles/types.js';
import { ValidationPipeline } from './validation-pipeline.js';
import { MethodologyConfig, DEFAULT_METHODOLOGY } from '../../config/methodology-config.js';
import { ValidationStepRegistry } from './validation-step-registry.js';
import { registerAllBuiltinSteps } from './validation-steps/index.js';
import { resolveWorkItemType } from '../../profiles/work-item-resolver.js';

export class TaskTransitionValidator implements ITaskTransitionValidator {
  private readonly methodologyConfig: IMethodologyConfig;
  private readonly stepRegistry: IValidationStepRegistry;
  private readonly stepDeps: StepDependencies;
  private readonly issueRepository: IIssueRepository;
  private readonly projectConfig: IProjectConfig;
  private readonly workflowConfig: IWorkflowConfig;
  private readonly gitWorkflowConfig: IGitWorkflowConfig;
  private readonly logger: ILogger;
  private readonly profile: MethodologyProfile;

  constructor(
    issueRepository: IIssueRepository,
    projectConfig: IProjectConfig,
    workflowConfig: IWorkflowConfig,
    integrityValidator: IIntegrityValidator,
    repositoryRepository: IRepositoryRepository,
    gitWorkflowConfig: IGitWorkflowConfig,
    logger: ILogger,
    methodologyConfig: IMethodologyConfig | undefined,
    stepRegistry: IValidationStepRegistry | undefined,
    agentService: IAgentService | undefined,
    profile: MethodologyProfile,
    containerMetadataService?: IContainerMetadataService,
  ) {
    this.issueRepository = issueRepository;
    this.projectConfig = projectConfig;
    this.workflowConfig = workflowConfig;
    this.gitWorkflowConfig = gitWorkflowConfig;
    this.logger = logger;
    this.profile = profile;

    // Config-driven BRE: use provided config/registry or create defaults
    if (methodologyConfig && stepRegistry) {
      this.methodologyConfig = methodologyConfig;
      this.stepRegistry = stepRegistry;
    } else {
      this.methodologyConfig = new MethodologyConfig(DEFAULT_METHODOLOGY);
      const registry = new ValidationStepRegistry();
      registerAllBuiltinSteps(registry);
      this.stepRegistry = registry;
    }

    this.stepDeps = {
      issueRepository,
      integrityValidator,
      repositoryRepository,
      projectConfig,
      workflowConfig,
      gitWorkflowConfig,
      agentService,
      containerMetadataService,
      profile,
    };
  }

  async validateTransition(issueNumber: number, transition: string): Promise<ValidationResult> {
    const task = await this.issueRepository.getTask(issueNumber);
    const context: ValidationContext = {
      issueNumber,
      transition: transition as TransitionType,
      task,
      config: this.projectConfig,
      workflowConfig: this.workflowConfig,
      gitWorkflowConfig: this.gitWorkflowConfig,
    };

    const workItemType = resolveWorkItemType(task.labels ?? [], this.profile);
    const pipeline = this.createPipeline(transition as TransitionType, workItemType);
    const result = await pipeline.execute(context);

    this.logger.debug('Transition validation complete', {
      issueNumber,
      transition,
      canProceed: result.canProceed,
      totalSteps: result.metadata?.totalSteps,
      failedSteps: result.metadata?.failedSteps,
    });

    return result;
  }

  async validateAllTransitions(issueNumber: number): Promise<AllTransitionsResult> {
    const task = await this.issueRepository.getTask(issueNumber);
    const transitions: Record<string, ValidationResult> = {};

    // Derive all unique action names from profile transitions
    const allActions = [...new Set(this.profile.transitions.map((t) => t.action))];

    const workItemType = resolveWorkItemType(task.labels ?? [], this.profile);

    for (const transition of allActions) {
      const context: ValidationContext = {
        issueNumber,
        transition,
        task,
        config: this.projectConfig,
        workflowConfig: this.workflowConfig,
        gitWorkflowConfig: this.gitWorkflowConfig,
      };

      try {
        const pipeline = this.createPipeline(transition, workItemType);
        transitions[transition] = await pipeline.execute(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        transitions[transition] = {
          canProceed: false,
          transition,
          reason: `Validation error: ${message}`,
          details: [],
          suggestions: [],
          metadata: {},
        };
      }
    }

    return { issueNumber, transitions };
  }

  private createPipeline(transition: TransitionType, workItemType?: string): ValidationPipeline {
    const pipeline = new ValidationPipeline();
    const stepNames = this.methodologyConfig.getStepsForTransition(transition, workItemType);

    for (const stepName of stepNames) {
      const step = this.stepRegistry.create(stepName, this.stepDeps);
      pipeline.addStep(step);
    }

    return pipeline;
  }
}
