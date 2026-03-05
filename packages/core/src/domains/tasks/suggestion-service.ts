/**
 * SuggestionService — Generates typed Suggestion[] from multiple sources.
 *
 * Bridges ValidationResult.suggestions (string[]) + other sources → typed Suggestion[].
 * Stateless. No repos. No side effects.
 */

import type {
  IWorkflowConfig,
  IGitWorkflowConfig,
  TaskData,
  Suggestion,
} from '../../container/interfaces.js';
import type { TransitionType, ValidationResult } from './types.js';

export class SuggestionService {
  constructor(
    _workflowConfig: IWorkflowConfig,
    private readonly gitWorkflowConfig?: IGitWorkflowConfig,
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
      } else if (detail.stepName === 'WaveAssignmentValidation') {
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
      } else if (detail.stepName === 'EpicIntegrityValidation') {
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

    switch (status) {
      case 'Backlog':
        suggestions.push({
          action: 'refine_task',
          description: 'Refine task to add acceptance criteria and estimates',
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break;

      case 'In Refinement':
        suggestions.push({
          action: 'ready_task',
          description: 'Mark task as ready for development',
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break;

      case 'Ready for Dev':
        suggestions.push({
          action: 'start_task',
          description: 'Start working on this task',
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break;

      case 'In Progress':
        suggestions.push({
          action: 'review_task',
          description: 'Submit task for review',
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break;

      case 'In Review':
        suggestions.push({
          action: 'approve_task',
          description: 'Approve and complete this task',
          parameters: { issueNumber: task.number },
          priority: 'medium',
        });
        break;

      case 'Blocked':
        suggestions.push({
          action: 'unblock_task',
          description: 'Unblock this task when the blocker is resolved',
          parameters: { issueNumber: task.number },
          priority: 'high',
        });
        break;
    }

    return suggestions;
  }

  private getTransitionSuggestions(transition: TransitionType, task: TaskData): Suggestion[] {
    const suggestions: Suggestion[] = [];

    switch (transition) {
      case 'start':
        suggestions.push({
          action: 'review_task',
          description: 'Submit for review when implementation is complete',
          parameters: { issueNumber: task.number },
          priority: 'low',
        });
        break;

      case 'review':
        suggestions.push({
          action: 'approve_task',
          description: 'Approve after review is complete',
          parameters: { issueNumber: task.number },
          priority: 'low',
        });
        break;

      case 'block':
        suggestions.push({
          action: 'unblock_task',
          description: 'Unblock when the blocking issue is resolved',
          parameters: { issueNumber: task.number },
          priority: 'low',
        });
        break;

      case 'refine':
        suggestions.push({
          action: 'ready_task',
          description: 'Mark as ready when refinement is complete',
          parameters: { issueNumber: task.number },
          priority: 'low',
        });
        break;
    }

    return suggestions;
  }

  private getGitWorkflowSuggestions(transition: TransitionType): Suggestion[] {
    if (!this.gitWorkflowConfig?.shouldShowGitSuggestions()) {
      return [];
    }

    const suggestions: Suggestion[] = [];

    if (transition === 'review') {
      suggestions.push({
        action: 'check_pr_status',
        description: 'Verify pull request is ready for review',
        parameters: {},
        priority: 'medium',
      });
    }

    if (transition === 'approve') {
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

  private getFailurePatternSuggestions(validationResult: ValidationResult): Suggestion[] {
    if (validationResult.canProceed) return [];

    const suggestions: Suggestion[] = [];
    const failedSteps = validationResult.details.filter((d) => !d.passed);

    // Multiple dependency failures suggest checking the full chain
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

    // Status transition failures suggest checking valid transitions
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
