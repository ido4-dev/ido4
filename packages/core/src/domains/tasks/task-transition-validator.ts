/**
 * TaskTransitionValidator — BRE orchestrator implementing ITaskTransitionValidator.
 *
 * Uses IMethodologyConfig to determine which validation steps run per transition,
 * and IValidationStepRegistry to instantiate them with dependency injection.
 *
 * Backward-compatible: when constructed without config/registry (legacy signature),
 * falls back to default methodology.
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
import { ValidationPipeline } from './validation-pipeline.js';
import { MethodologyConfig, DEFAULT_METHODOLOGY } from '../../config/methodology-config.js';
import { ValidationStepRegistry } from './validation-step-registry.js';
import { registerAllBuiltinSteps } from './validation-steps/index.js';

const ALL_TRANSITIONS: TransitionType[] = [
  'refine', 'ready', 'start', 'review', 'approve', 'complete', 'block', 'unblock', 'return',
];

export class TaskTransitionValidator implements ITaskTransitionValidator {
  private readonly methodologyConfig: IMethodologyConfig;
  private readonly stepRegistry: IValidationStepRegistry;
  private readonly stepDeps: StepDependencies;
  private readonly issueRepository: IIssueRepository;
  private readonly projectConfig: IProjectConfig;
  private readonly workflowConfig: IWorkflowConfig;
  private readonly gitWorkflowConfig: IGitWorkflowConfig;
  private readonly logger: ILogger;

  constructor(
    issueRepository: IIssueRepository,
    projectConfig: IProjectConfig,
    workflowConfig: IWorkflowConfig,
    integrityValidator: IIntegrityValidator,
    repositoryRepository: IRepositoryRepository,
    gitWorkflowConfig: IGitWorkflowConfig,
    logger: ILogger,
    methodologyConfig?: IMethodologyConfig,
    stepRegistry?: IValidationStepRegistry,
    agentService?: IAgentService,
  ) {
    this.issueRepository = issueRepository;
    this.projectConfig = projectConfig;
    this.workflowConfig = workflowConfig;
    this.gitWorkflowConfig = gitWorkflowConfig;
    this.logger = logger;

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

    const pipeline = this.createPipeline(transition as TransitionType);
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

    for (const transition of ALL_TRANSITIONS) {
      const context: ValidationContext = {
        issueNumber,
        transition,
        task,
        config: this.projectConfig,
        workflowConfig: this.workflowConfig,
        gitWorkflowConfig: this.gitWorkflowConfig,
      };

      try {
        const pipeline = this.createPipeline(transition);
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

  private createPipeline(transition: TransitionType): ValidationPipeline {
    const pipeline = new ValidationPipeline();
    const stepNames = this.methodologyConfig.getStepsForTransition(transition);

    for (const stepName of stepNames) {
      const step = this.stepRegistry.create(stepName, this.stepDeps);
      pipeline.addStep(step);
    }

    return pipeline;
  }
}
