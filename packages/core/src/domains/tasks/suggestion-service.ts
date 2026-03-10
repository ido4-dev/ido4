/**
 * SuggestionService — Generates typed Suggestion[] from multiple sources.
 *
 * Fully profile-driven. Uses WorkflowConfig semantic methods and profile transitions
 * for status-based and transition-based suggestions.
 */

import type {
  IWorkflowConfig,
  IGitWorkflowConfig,
  TaskData,
  Suggestion,
} from '../../container/interfaces.js';
import type { TransitionType, ValidationResult } from './types.js';
import type { MethodologyProfile } from '../../profiles/types.js';

export class SuggestionService {
  constructor(
    private readonly workflowConfig: IWorkflowConfig,
    private readonly gitWorkflowConfig: IGitWorkflowConfig | undefined,
    private readonly profile: MethodologyProfile,
  ) {}

  generateSuggestions(
    transition: TransitionType,
    validationResult: ValidationResult,
    task: TaskData,
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (!validationResult.canProceed) {
      suggestions.push(...this.getRemediationSuggestions(validationResult));
    }

    suggestions.push(...this.getStatusBasedSuggestions(task));
    suggestions.push(...this.getTransitionSuggestions(transition, task));
    suggestions.push(...this.getGitWorkflowSuggestions(transition));
    suggestions.push(...this.getFailurePatternSuggestions(validationResult));

    return this.deduplicateAndSort(suggestions);
  }

  private getRemediationSuggestions(validationResult: ValidationResult): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const detail of validationResult.details) {
      if (detail.passed) continue;

      if (detail.stepName === 'DependencyValidation') {
        suggestions.push({
          action: 'get_task',
          description: 'Check the status of blocking dependencies',
          parameters: {},
          priority: 'high',
          humanPermissionRequired: false,
        });
      } else if (detail.stepName === 'WaveAssignmentValidation' || detail.stepName === 'ContainerAssignmentValidation') {
        suggestions.push({
          action: 'assign_wave',
          description: 'Assign task to a wave before starting',
          parameters: { issueNumber: 0 },
          priority: 'high',
          humanPermissionRequired: false,
        });
      } else if (detail.stepName === 'AcceptanceCriteriaValidation') {
        suggestions.push({
          action: 'refine_task',
          description: 'Add acceptance criteria to the task description',
          parameters: {},
          priority: 'high',
          humanPermissionRequired: true,
        });
      } else if (detail.stepName === 'ImplementationReadinessValidation') {
        suggestions.push({
          action: 'create_pull_request',
          description: 'Create a pull request before moving to review',
          parameters: {},
          priority: 'high',
          humanPermissionRequired: true,
        });
      } else if (detail.stepName === 'EpicIntegrityValidation' || detail.stepName === 'ContainerIntegrityValidation') {
        suggestions.push({
          action: 'assign_wave',
          description: 'Reassign task to maintain epic integrity',
          parameters: {},
          priority: 'high',
          humanPermissionRequired: true,
        });
      }
    }

    return suggestions;
  }

  private getStatusBasedSuggestions(task: TaskData): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const status = task.status;

    if (this.workflowConfig.isBlockedStatus(status)) {
      suggestions.push({
        action: 'unblock_task',
        description: 'Unblock this task when the blocker is resolved',
        parameters: { issueNumber: task.number },
        priority: 'high',
      });
      return suggestions;
    }

    if (this.workflowConfig.isTerminalStatus(status)) {
      return suggestions; // No suggestions for terminal states
    }

    // Find valid forward transitions from current status
    const statusKey = this.workflowConfig.getStatusKey(status);
    if (statusKey) {
      const forwardTransitions = this.profile.transitions.filter(
        (t) => t.from.includes(statusKey) && !t.backward,
      );

      // Suggest the first non-block, non-return forward transition
      for (const t of forwardTransitions) {
        if (t.action === this.profile.behaviors.blockTransition) continue;
        if (t.action === this.profile.behaviors.returnTransition) continue;

        suggestions.push({
          action: `${t.action}_task`,
          description: t.label,
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break; // Only suggest the primary forward action
      }
    }

    return suggestions;
  }

  private getTransitionSuggestions(transition: TransitionType, task: TaskData): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Find the transition's target state, then find forward transitions from it
    const transitionDef = this.profile.transitions.find(
      (t) => t.action === transition && !t.backward,
    );
    if (transitionDef) {
      const toKey = transitionDef.to;
      const forwardFromTo = this.profile.transitions.filter(
        (t) => t.from.includes(toKey) && !t.backward
          && t.action !== this.profile.behaviors.blockTransition,
      );
      if (forwardFromTo.length > 0) {
        const next = forwardFromTo[0]!;
        suggestions.push({
          action: `${next.action}_task`,
          description: next.label,
          parameters: { issueNumber: task.number },
          priority: 'low',
        });
      }
    }

    // Block transition → suggest unblock
    if (transition === this.profile.behaviors.blockTransition) {
      suggestions.push({
        action: 'unblock_task',
        description: 'Unblock when the blocking issue is resolved',
        parameters: { issueNumber: task.number },
        priority: 'low',
      });
    }

    return suggestions;
  }

  private getGitWorkflowSuggestions(transition: TransitionType): Suggestion[] {
    if (!this.gitWorkflowConfig?.shouldShowGitSuggestions()) {
      return [];
    }

    const suggestions: Suggestion[] = [];

    if (this.isPreClosingTransition(transition)) {
      suggestions.push({
        action: 'check_pr_status',
        description: 'Verify pull request is ready for review',
        parameters: {},
        priority: 'medium',
      });
    }

    if (this.isClosingTransition(transition)) {
      suggestions.push({
        action: 'merge_pull_request',
        description: 'Merge the associated pull request',
        parameters: {},
        priority: 'medium',
        humanPermissionRequired: true,
      });
    }

    return suggestions;
  }

  private isClosingTransition(transition: string): boolean {
    return this.profile.behaviors.closingTransitions.includes(transition);
  }

  /** Pre-closing = transition whose target state is a source state for closing transitions */
  private isPreClosingTransition(transition: string): boolean {
    const closingFromStates = new Set(
      this.profile.transitions
        .filter((t) => this.profile.behaviors.closingTransitions.includes(t.action))
        .flatMap((t) => t.from),
    );
    const transitionDef = this.profile.transitions.find(
      (t) => t.action === transition && !t.backward,
    );
    return transitionDef ? closingFromStates.has(transitionDef.to) : false;
  }

  private getFailurePatternSuggestions(validationResult: ValidationResult): Suggestion[] {
    if (validationResult.canProceed) return [];

    const suggestions: Suggestion[] = [];
    const failedSteps = validationResult.details.filter((d) => !d.passed);

    const depFailures = failedSteps.filter(
      (d) => d.stepName === 'DependencyValidation' || d.stepName === 'DependencyIdentificationValidation',
    );
    if (depFailures.length > 0) {
      suggestions.push({
        action: 'analyze_dependencies',
        description: 'Analyze the full dependency chain for this task',
        parameters: {},
        priority: 'high',
      });
    }

    const statusFailures = failedSteps.filter((d) => d.stepName === 'StatusTransitionValidation');
    if (statusFailures.length > 0) {
      suggestions.push({
        action: 'validate_all_transitions',
        description: 'Check which transitions are valid from the current state',
        parameters: {},
        priority: 'medium',
      });
    }

    return suggestions;
  }

  generatePostCreateSuggestions(issueNumber: number): Suggestion[] {
    return [
      {
        action: 'assign_task_to_wave',
        description: 'Assign the new task to a wave',
        parameters: { issueNumber },
        priority: 'high',
      },
      {
        action: 'refine_task',
        description: 'Refine the task to add acceptance criteria',
        parameters: { issueNumber },
        priority: 'medium',
      },
    ];
  }

  private deduplicateAndSort(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    const unique: Suggestion[] = [];

    for (const s of suggestions) {
      const key = `${s.action}:${JSON.stringify(s.parameters)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return unique.sort(
      (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1),
    );
  }
}
