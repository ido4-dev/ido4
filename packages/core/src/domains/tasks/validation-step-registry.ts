/**
 * ValidationStepRegistry — Named registration and DI-based instantiation of validation steps.
 *
 * Key design: parameterized step names use colon separator.
 * "StatusTransitionValidation:IN_PROGRESS" → factory for "StatusTransitionValidation" called with param "IN_PROGRESS"
 */

import type { ValidationStep } from './types.js';
import type {
  IIssueRepository,
  IEpicValidator,
  IRepositoryRepository,
  IProjectConfig,
  IWorkflowConfig,
  IGitWorkflowConfig,
} from '../../container/interfaces.js';
import type { IAgentService } from '../agents/agent-service.js';
import { NotFoundError } from '../../shared/errors/index.js';

export interface StepDependencies {
  issueRepository: IIssueRepository;
  epicValidator: IEpicValidator;
  repositoryRepository: IRepositoryRepository;
  projectConfig: IProjectConfig;
  workflowConfig: IWorkflowConfig;
  gitWorkflowConfig: IGitWorkflowConfig;
  /** Optional — only available in multi-agent mode */
  agentService?: IAgentService;
}

export type ValidationStepFactory = (deps: StepDependencies, param?: string) => ValidationStep;

export interface IValidationStepRegistry {
  register(name: string, factory: ValidationStepFactory): void;
  create(name: string, deps: StepDependencies): ValidationStep;
  has(name: string): boolean;
  getRegisteredNames(): string[];
}

export class ValidationStepRegistry implements IValidationStepRegistry {
  private readonly factories = new Map<string, ValidationStepFactory>();

  register(name: string, factory: ValidationStepFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string, deps: StepDependencies): ValidationStep {
    const { stepName, param } = ValidationStepRegistry.parseName(name);

    const factory = this.factories.get(stepName);
    if (!factory) {
      throw new NotFoundError({
        message: `Unknown validation step: "${stepName}"`,
        resource: 'validationStep',
        identifier: stepName,
        remediation: `Available steps: ${this.getRegisteredNames().join(', ')}`,
      });
    }

    return factory(deps, param);
  }

  has(name: string): boolean {
    const { stepName } = ValidationStepRegistry.parseName(name);
    return this.factories.has(stepName);
  }

  getRegisteredNames(): string[] {
    return [...this.factories.keys()];
  }

  /** Parse "StepName:PARAM" into components */
  static parseName(name: string): { stepName: string; param?: string } {
    const colonIndex = name.indexOf(':');
    if (colonIndex === -1) {
      return { stepName: name };
    }
    return {
      stepName: name.substring(0, colonIndex),
      param: name.substring(colonIndex + 1),
    };
  }
}
