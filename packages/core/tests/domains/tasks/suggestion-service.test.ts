import { describe, it, expect } from 'vitest';
import { SuggestionService } from '../../../src/domains/tasks/suggestion-service.js';
import type { ValidationResult, TransitionType } from '../../../src/domains/tasks/types.js';
import { createMockTaskData, createMockWorkflowConfig, createMockGitWorkflowConfig } from '../../helpers/mock-factories.js';
import type { TaskData, Suggestion } from '../../../src/container/interfaces.js';

function makeValidationResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    canProceed: true,
    transition: 'start',
    reason: 'All validations passed',
    details: [],
    suggestions: [],
    metadata: {},
    ...overrides,
  };
}

function makeFailedResult(stepNames: string[]): ValidationResult {
  return makeValidationResult({
    canProceed: false,
    reason: `${stepNames.length} validation(s) failed`,
    details: stepNames.map((name) => ({
      stepName: name,
      passed: false,
      message: `${name} failed`,
      severity: 'error' as const,
    })),
  });
}

describe('SuggestionService', () => {
  const workflowConfig = createMockWorkflowConfig();

  describe('remediation suggestions', () => {
    it('suggests checking dependencies on DependencyValidation failure', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['DependencyValidation']);
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.some((s) => s.action === 'get_task')).toBe(true);
    });

    it('suggests assigning wave on WaveAssignmentValidation failure', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['WaveAssignmentValidation']);
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.some((s) => s.action === 'assign_wave')).toBe(true);
    });

    it('suggests refine on AcceptanceCriteriaValidation failure', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['AcceptanceCriteriaValidation']);
      const task = createMockTaskData({ status: 'In Refinement' });

      const suggestions = service.generateSuggestions('ready', result, task);
      const refine = suggestions.find((s) => s.action === 'refine_task' && s.priority === 'high');
      expect(refine).toBeDefined();
      expect(refine!.humanPermissionRequired).toBe(true);
    });

    it('suggests creating PR on ImplementationReadinessValidation failure', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['ImplementationReadinessValidation']);
      const task = createMockTaskData({ status: 'In Progress' });

      const suggestions = service.generateSuggestions('review', result, task);
      expect(suggestions.some((s) => s.action === 'create_pull_request')).toBe(true);
    });

    it('suggests reassigning wave on EpicIntegrityValidation failure', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['EpicIntegrityValidation']);
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      const waveSuggestion = suggestions.find(
        (s) => s.action === 'assign_wave' && s.priority === 'high',
      );
      expect(waveSuggestion).toBeDefined();
    });

    it('does not generate remediation suggestions when validation passes', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      // No high-priority remediation suggestions
      const highPriority = suggestions.filter((s) => s.priority === 'high');
      expect(highPriority).toHaveLength(0);
    });
  });

  describe('status-based suggestions', () => {
    const statusToAction: Array<[string, string]> = [
      ['Backlog', 'refine_task'],
      ['In Refinement', 'ready_task'],
      ['Ready for Dev', 'start_task'],
      ['In Progress', 'review_task'],
      ['In Review', 'approve_task'],
      ['Blocked', 'unblock_task'],
    ];

    for (const [status, expectedAction] of statusToAction) {
      it(`suggests ${expectedAction} for ${status} status`, () => {
        const service = new SuggestionService(workflowConfig);
        const result = makeValidationResult();
        const task = createMockTaskData({ status });

        const suggestions = service.generateSuggestions('start', result, task);
        expect(suggestions.some((s) => s.action === expectedAction)).toBe(true);
      });
    }
  });

  describe('transition-specific suggestions', () => {
    it('suggests review_task after start', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Progress' });

      const suggestions = service.generateSuggestions('start', result, task);
      const reviewSuggestions = suggestions.filter((s) => s.action === 'review_task');
      expect(reviewSuggestions.length).toBeGreaterThan(0);
    });

    it('suggests approve_task after review', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Review' });

      const suggestions = service.generateSuggestions('review', result, task);
      const approveSuggestions = suggestions.filter((s) => s.action === 'approve_task');
      expect(approveSuggestions.length).toBeGreaterThan(0);
    });

    it('suggests unblock_task after block', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'Blocked' });

      const suggestions = service.generateSuggestions('block', result, task);
      const unblockSuggestions = suggestions.filter((s) => s.action === 'unblock_task');
      expect(unblockSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('git workflow suggestions', () => {
    it('suggests check_pr_status on review when git is enabled', () => {
      const gitConfig = createMockGitWorkflowConfig({ shouldShowGitSuggestions: () => true });
      const service = new SuggestionService(workflowConfig, gitConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Progress' });

      const suggestions = service.generateSuggestions('review', result, task);
      expect(suggestions.some((s) => s.action === 'check_pr_status')).toBe(true);
    });

    it('suggests merge_pull_request on approve when git is enabled', () => {
      const gitConfig = createMockGitWorkflowConfig({ shouldShowGitSuggestions: () => true });
      const service = new SuggestionService(workflowConfig, gitConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Review' });

      const suggestions = service.generateSuggestions('approve', result, task);
      const mergeSuggestion = suggestions.find((s) => s.action === 'merge_pull_request');
      expect(mergeSuggestion).toBeDefined();
      expect(mergeSuggestion!.humanPermissionRequired).toBe(true);
    });

    it('skips git suggestions when git is disabled', () => {
      const gitConfig = createMockGitWorkflowConfig({ shouldShowGitSuggestions: () => false });
      const service = new SuggestionService(workflowConfig, gitConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Progress' });

      const suggestions = service.generateSuggestions('review', result, task);
      expect(suggestions.some((s) => s.action === 'check_pr_status')).toBe(false);
    });

    it('skips git suggestions when no git config', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData({ status: 'In Progress' });

      const suggestions = service.generateSuggestions('review', result, task);
      expect(suggestions.some((s) => s.action === 'check_pr_status')).toBe(false);
    });
  });

  describe('failure pattern suggestions', () => {
    it('suggests analyze_dependencies on dependency-related failures', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['DependencyValidation']);
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.some((s) => s.action === 'analyze_dependencies')).toBe(true);
    });

    it('suggests validate_all_transitions on status transition failures', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['StatusTransitionValidation']);
      const task = createMockTaskData({ status: 'Backlog' });

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.some((s) => s.action === 'validate_all_transitions')).toBe(true);
    });

    it('skips failure pattern suggestions when validation passes', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      const task = createMockTaskData();

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.some((s) => s.action === 'analyze_dependencies')).toBe(false);
      expect(suggestions.some((s) => s.action === 'validate_all_transitions')).toBe(false);
    });
  });

  describe('deduplication and sorting', () => {
    it('deduplicates suggestions with same action and parameters', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeValidationResult();
      // Blocked status generates unblock suggestion, and block transition also generates unblock suggestion
      const task = createMockTaskData({ status: 'Blocked', number: 42 });

      const suggestions = service.generateSuggestions('block', result, task);
      const unblockSuggestions = suggestions.filter((s) => s.action === 'unblock_task');
      // Deduplicated by action + parameters
      const uniqueKeys = new Set(unblockSuggestions.map((s) => `${s.action}:${JSON.stringify(s.parameters)}`));
      expect(uniqueKeys.size).toBe(unblockSuggestions.length);
    });

    it('sorts suggestions by priority (high first)', () => {
      const service = new SuggestionService(workflowConfig);
      const result = makeFailedResult(['WaveAssignmentValidation']);
      const task = createMockTaskData({ status: 'Ready for Dev' });

      const suggestions = service.generateSuggestions('start', result, task);
      expect(suggestions.length).toBeGreaterThan(0);

      // Verify high priority comes before medium and low
      let lastPriority = 'high';
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      for (const s of suggestions) {
        expect(order[s.priority]).toBeGreaterThanOrEqual(order[lastPriority]!);
        lastPriority = s.priority;
      }
    });
  });
});
