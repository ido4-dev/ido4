import { describe, it, expect } from 'vitest';
import { GitWorkflowConfig } from '../../src/config/git-workflow-config.js';

describe('GitWorkflowConfig', () => {
  describe('create', () => {
    it('uses defaults when no overrides provided', () => {
      const config = GitWorkflowConfig.create();
      expect(config.isEnabled()).toBe(true);
      expect(config.requiresPRForReview()).toBe(true);
      expect(config.shouldShowGitSuggestions()).toBe(true);
      expect(config.shouldDetectGitContext()).toBe(true);
    });

    it('applies overrides', () => {
      const config = GitWorkflowConfig.create({ enabled: false });
      expect(config.isEnabled()).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('returns the enabled flag', () => {
      expect(GitWorkflowConfig.create({ enabled: true }).isEnabled()).toBe(true);
      expect(GitWorkflowConfig.create({ enabled: false }).isEnabled()).toBe(false);
    });
  });

  describe('requiresPRForReview', () => {
    it('requires both enabled and require_pr_for_review', () => {
      expect(GitWorkflowConfig.create({ enabled: true, require_pr_for_review: true }).requiresPRForReview()).toBe(true);
      expect(GitWorkflowConfig.create({ enabled: false, require_pr_for_review: true }).requiresPRForReview()).toBe(false);
      expect(GitWorkflowConfig.create({ enabled: true, require_pr_for_review: false }).requiresPRForReview()).toBe(false);
    });
  });

  describe('shouldShowGitSuggestions', () => {
    it('requires enabled', () => {
      expect(GitWorkflowConfig.create({ enabled: true, show_git_suggestions: true }).shouldShowGitSuggestions()).toBe(true);
      expect(GitWorkflowConfig.create({ enabled: false, show_git_suggestions: true }).shouldShowGitSuggestions()).toBe(false);
    });
  });

  describe('shouldDetectGitContext', () => {
    it('requires enabled', () => {
      expect(GitWorkflowConfig.create({ enabled: true, detect_git_context: true }).shouldDetectGitContext()).toBe(true);
      expect(GitWorkflowConfig.create({ enabled: false, detect_git_context: true }).shouldDetectGitContext()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('returns a copy of the config', () => {
      const config = GitWorkflowConfig.create({ enabled: false });
      const json = config.toJSON();
      expect(json.enabled).toBe(false);
      expect(json.require_pr_for_review).toBe(true);
      expect(json.show_git_suggestions).toBe(true);
      expect(json.detect_git_context).toBe(true);
    });
  });
});
