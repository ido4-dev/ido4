/**
 * MethodologyConfig — Data-driven BRE pipeline configuration.
 *
 * Loads pipeline definitions from `.ido4/methodology.json`, or falls back
 * to the default methodology that matches the current hardcoded behavior.
 *
 * Key design: parameterized step names use colon separator.
 * e.g., "StatusTransitionValidation:IN_PROGRESS" → step="StatusTransitionValidation", param="IN_PROGRESS"
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ConfigurationError } from '../shared/errors/index.js';

/** Configuration for which validation steps run per transition */
export interface IMethodologyConfig {
  getStepsForTransition(transition: string): string[];
  getStepConfig(stepName: string): Record<string, unknown>;
  getTransitions(): string[];
  isStepEnabled(transition: string, stepName: string): boolean;
}

export interface MethodologyPipeline {
  steps: string[];
}

export interface MethodologyDefinition {
  version: string;
  name: string;
  pipelines: Record<string, MethodologyPipeline>;
  stepConfig?: Record<string, Record<string, unknown>>;
}

/** Default methodology — exactly matches the current hardcoded switch statement */
export const DEFAULT_METHODOLOGY: MethodologyDefinition = {
  version: '1.0',
  name: 'ido4 Standard Governance',
  pipelines: {
    refine: {
      steps: [
        'RefineFromBacklogValidation',
        'BaseTaskFieldsValidation',
        'StatusTransitionValidation:IN_REFINEMENT',
        'EpicIntegrityValidation',
      ],
    },
    ready: {
      steps: [
        'ReadyFromRefinementOrBacklogValidation',
        'FastTrackValidation',
        'AcceptanceCriteriaValidation',
        'EffortEstimationValidation',
        'DependencyIdentificationValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
        'EpicIntegrityValidation',
      ],
    },
    start: {
      steps: [
        'StartFromReadyForDevValidation',
        'StatusTransitionValidation:IN_PROGRESS',
        'DependencyValidation',
        'WaveAssignmentValidation',
        'AISuitabilityValidation',
        'RiskLevelValidation',
        'EpicIntegrityValidation',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:IN_REVIEW',
        'ImplementationReadinessValidation',
        'EpicIntegrityValidation',
      ],
    },
    approve: {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'EpicIntegrityValidation',
      ],
    },
    complete: {
      steps: [
        'StatusAlreadyDoneValidation',
        'SubtaskCompletionValidation',
      ],
    },
    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskAlreadyBlockedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskNotBlockedValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskBlockedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },
  stepConfig: {},
};

export class MethodologyConfig implements IMethodologyConfig {
  constructor(private readonly definition: MethodologyDefinition) {}

  getStepsForTransition(transition: string): string[] {
    const pipeline = this.definition.pipelines[transition];
    if (!pipeline) {
      return [];
    }
    return [...pipeline.steps];
  }

  getStepConfig(stepName: string): Record<string, unknown> {
    return this.definition.stepConfig?.[stepName] ?? {};
  }

  getTransitions(): string[] {
    return Object.keys(this.definition.pipelines);
  }

  isStepEnabled(transition: string, stepName: string): boolean {
    const steps = this.getStepsForTransition(transition);
    // Check both exact match and parameterized match (e.g., "StatusTransitionValidation" matches "StatusTransitionValidation:X")
    return steps.some((s) => s === stepName || s.startsWith(`${stepName}:`));
  }
}

export class MethodologyConfigLoader {
  static async load(projectRoot: string): Promise<MethodologyConfig> {
    const configPath = path.join(projectRoot, '.ido4', 'methodology.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const definition = MethodologyConfigLoader.parse(content, configPath);
      return new MethodologyConfig(definition);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new MethodologyConfig(DEFAULT_METHODOLOGY);
      }
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError({
        message: `Failed to load methodology config: ${error instanceof Error ? error.message : String(error)}`,
        context: { configPath },
        remediation: 'Fix the methodology.json file or delete it to use defaults.',
      });
    }
  }

  private static parse(content: string, configPath: string): MethodologyDefinition {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ConfigurationError({
        message: 'Invalid JSON in methodology config',
        context: { configPath },
        remediation: 'Fix the JSON syntax in methodology.json or delete it to use defaults.',
      });
    }

    const def = parsed as MethodologyDefinition;

    if (!def.version || !def.name || !def.pipelines) {
      throw new ConfigurationError({
        message: 'Methodology config missing required fields (version, name, pipelines)',
        context: { configPath },
        remediation: 'Ensure methodology.json has version, name, and pipelines fields.',
      });
    }

    // Validate each pipeline has a steps array
    for (const [transition, pipeline] of Object.entries(def.pipelines)) {
      if (!Array.isArray(pipeline.steps)) {
        throw new ConfigurationError({
          message: `Pipeline "${transition}" has invalid steps (must be array)`,
          context: { configPath, transition },
          remediation: `Fix the steps array for the "${transition}" pipeline in methodology.json.`,
        });
      }
    }

    return def;
  }
}
