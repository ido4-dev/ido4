/**
 * TaskTransitionValidator — BRE orchestrator implementing ITaskTransitionValidator.
 *
 * Maps each TransitionType to a specific set of validation steps,
 * builds a ValidationPipeline, and executes it.
 */

import type {
  ITaskTransitionValidator,
  IIssueRepository,
  IProjectConfig,
  IWorkflowConfig,
  IEpicValidator,
  IRepositoryRepository,
  IGitWorkflowConfig,
  AllTransitionsResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { ValidationResult, TransitionType, ValidationContext } from './types.js';
import { ValidationPipeline } from './validation-pipeline.js';
import {
  StatusTransitionValidation,
  RefineFromBacklogValidation,
  ReadyFromRefinementOrBacklogValidation,
  StartFromReadyForDevValidation,
  BaseTaskFieldsValidation,
  FastTrackValidation,
  AcceptanceCriteriaValidation,
  EffortEstimationValidation,
  DependencyIdentificationValidation,
  WaveAssignmentValidation,
  AISuitabilityValidation,
  RiskLevelValidation,
  StatusAlreadyDoneValidation,
  TaskAlreadyCompletedValidation,
  TaskAlreadyBlockedValidation,
  TaskNotBlockedValidation,
  TaskBlockedValidation,
  BackwardTransitionValidation,
  ApprovalRequirementValidation,
  EpicIntegrityValidation,
  DependencyValidation,
  ImplementationReadinessValidation,
  SubtaskCompletionValidation,
} from './validation-steps/index.js';

const ALL_TRANSITIONS: TransitionType[] = [
  'refine', 'ready', 'start', 'review', 'approve', 'complete', 'block', 'unblock', 'return',
];

export class TaskTransitionValidator implements ITaskTransitionValidator {
  constructor(
    private readonly issueRepository: IIssueRepository,
    private readonly projectConfig: IProjectConfig,
    private readonly workflowConfig: IWorkflowConfig,
    private readonly epicValidator: IEpicValidator,
    private readonly repositoryRepository: IRepositoryRepository,
    private readonly gitWorkflowConfig: IGitWorkflowConfig,
    private readonly logger: ILogger,
  ) {}

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
    const epicIntegrity = new EpicIntegrityValidation(this.epicValidator);

    switch (transition) {
      case 'refine':
        pipeline
          .addStep(new RefineFromBacklogValidation())
          .addStep(new BaseTaskFieldsValidation())
          .addStep(new StatusTransitionValidation('IN_REFINEMENT'))
          .addStep(epicIntegrity);
        break;

      case 'ready':
        pipeline
          .addStep(new ReadyFromRefinementOrBacklogValidation())
          .addStep(new FastTrackValidation())
          .addStep(new AcceptanceCriteriaValidation())
          .addStep(new EffortEstimationValidation())
          .addStep(new DependencyIdentificationValidation())
          .addStep(new StatusTransitionValidation('READY_FOR_DEV'))
          .addStep(epicIntegrity);
        break;

      case 'start':
        pipeline
          .addStep(new StartFromReadyForDevValidation())
          .addStep(new StatusTransitionValidation('IN_PROGRESS'))
          .addStep(new DependencyValidation(this.issueRepository))
          .addStep(new WaveAssignmentValidation())
          .addStep(new AISuitabilityValidation())
          .addStep(new RiskLevelValidation())
          .addStep(epicIntegrity);
        break;

      case 'review':
        pipeline
          .addStep(new StatusTransitionValidation('IN_REVIEW'))
          .addStep(new ImplementationReadinessValidation(this.repositoryRepository))
          .addStep(epicIntegrity);
        break;

      case 'approve':
        pipeline
          .addStep(new StatusTransitionValidation('DONE'))
          .addStep(new ApprovalRequirementValidation())
          .addStep(epicIntegrity);
        break;

      case 'complete':
        pipeline
          .addStep(new StatusAlreadyDoneValidation())
          .addStep(new SubtaskCompletionValidation(this.issueRepository));
        break;

      case 'block':
        pipeline
          .addStep(new TaskAlreadyCompletedValidation())
          .addStep(new TaskAlreadyBlockedValidation())
          .addStep(new StatusTransitionValidation('BLOCKED'));
        break;

      case 'unblock':
        pipeline
          .addStep(new TaskAlreadyCompletedValidation())
          .addStep(new TaskNotBlockedValidation())
          .addStep(new StatusTransitionValidation('READY_FOR_DEV'));
        break;

      case 'return':
        pipeline
          .addStep(new TaskAlreadyCompletedValidation())
          .addStep(new TaskBlockedValidation())
          .addStep(new BackwardTransitionValidation());
        break;
    }

    return pipeline;
  }
}
