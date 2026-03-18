import { describe, it, expect, vi } from 'vitest';
import { ContextCompletenessValidation } from '../../../../src/domains/tasks/validation-steps/context-completeness-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import type { StepDependencies } from '../../../../src/domains/tasks/validation-step-registry.js';
import type { TaskComment } from '../../../../src/container/interfaces.js';
import { createMockTaskData, createMockProjectConfig, createMockWorkflowConfig } from '../../../helpers/mock-factories.js';
import { HYDRO_PROFILE } from '../../../../src/profiles/hydro.js';

function createContext(): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'approve',
    task: createMockTaskData({ status: 'In Review' }),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

function createDeps(comments: TaskComment[]): StepDependencies {
  return {
    issueRepository: {
      getIssueComments: vi.fn().mockResolvedValue(comments),
    } as unknown as StepDependencies['issueRepository'],
    integrityValidator: {} as StepDependencies['integrityValidator'],
    repositoryRepository: {} as StepDependencies['repositoryRepository'],
    projectConfig: {} as StepDependencies['projectConfig'],
    workflowConfig: {} as StepDependencies['workflowConfig'],
    gitWorkflowConfig: {} as StepDependencies['gitWorkflowConfig'],
    profile: HYDRO_PROFILE,
  };
}

function makeComment(body: string, id = 'C_1'): TaskComment {
  return {
    id,
    body,
    author: 'agent-alpha',
    createdAt: '2026-03-13T10:00:00Z',
    updatedAt: '2026-03-13T10:00:00Z',
  };
}

const SUBSTANTIVE_CONTEXT = `<!-- ido4:context transition=start agent=agent-alpha timestamp=2026-03-13T10:00:00Z -->
Phase: starting | Approach: implementing payment webhook handler using the PaymentEvent schema from #38. Following structured error codes pattern established upstream.
<!-- /ido4:context -->`;

const SHORT_CONTEXT = `<!-- ido4:context transition=start agent=agent-alpha timestamp=2026-03-13T10:00:00Z -->
Done.
<!-- /ido4:context -->`;

const REGULAR_COMMENT = 'This is a regular comment without any ido4 context markers.';

describe('ContextCompletenessValidation', () => {
  it('has correct name', () => {
    const step = new ContextCompletenessValidation(undefined, createDeps([]));
    expect(step.name).toBe('ContextCompletenessValidation');
  });

  describe('no context comments', () => {
    it('rejects when no comments exist at all', async () => {
      const step = new ContextCompletenessValidation(undefined, createDeps([]));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('No ido4 context comments');
      expect(result.message).toContain('#42');
    });

    it('rejects when comments exist but none have ido4 context markers', async () => {
      const comments = [
        makeComment(REGULAR_COMMENT, 'C_1'),
        makeComment('Another regular comment', 'C_2'),
      ];
      const step = new ContextCompletenessValidation(undefined, createDeps(comments));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('No ido4 context comments');
    });
  });

  describe('insufficient context', () => {
    it('rejects when context blocks exist but are too short', async () => {
      const comments = [makeComment(SHORT_CONTEXT)];
      const step = new ContextCompletenessValidation(undefined, createDeps(comments));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('none are substantive');
      expect(result.message).toContain('minimum 50 characters');
    });
  });

  describe('valid context', () => {
    it('passes when a substantive context comment exists', async () => {
      const comments = [makeComment(SUBSTANTIVE_CONTEXT)];
      const step = new ContextCompletenessValidation(undefined, createDeps(comments));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
      expect(result.message).toContain('1 substantive context comment');
    });

    it('passes with multiple context comments', async () => {
      const completionContext = `<!-- ido4:context transition=review agent=agent-alpha timestamp=2026-03-13T14:00:00Z -->
Phase: complete | Interfaces created: /api/webhooks/payment endpoint. Patterns: structured error codes. Tests: 12 unit + 1 integration.
<!-- /ido4:context -->`;
      const comments = [
        makeComment(SUBSTANTIVE_CONTEXT, 'C_1'),
        makeComment(completionContext, 'C_2'),
      ];
      const step = new ContextCompletenessValidation(undefined, createDeps(comments));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(true);
      expect(result.message).toContain('2 substantive context comment');
    });

    it('ignores non-context comments when counting', async () => {
      const comments = [
        makeComment(REGULAR_COMMENT, 'C_1'),
        makeComment(SUBSTANTIVE_CONTEXT, 'C_2'),
        makeComment('Yet another regular comment', 'C_3'),
      ];
      const step = new ContextCompletenessValidation(undefined, createDeps(comments));
      const result = await step.validate(createContext());

      expect(result.passed).toBe(true);
      expect(result.message).toContain('1 substantive context comment');
    });
  });

  describe('error handling', () => {
    it('skips gracefully when comments cannot be fetched', async () => {
      const deps = createDeps([]);
      (deps.issueRepository.getIssueComments as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );
      const step = new ContextCompletenessValidation(undefined, deps);
      const result = await step.validate(createContext());

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
      expect(result.message).toContain('skipped');
    });
  });
});
