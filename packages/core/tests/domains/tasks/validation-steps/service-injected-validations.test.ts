import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicIntegrityValidation } from '../../../../src/domains/tasks/validation-steps/epic-integrity-validation.js';
import { DependencyValidation } from '../../../../src/domains/tasks/validation-steps/dependency-validation.js';
import { ImplementationReadinessValidation } from '../../../../src/domains/tasks/validation-steps/implementation-readiness-validation.js';
import { SubtaskCompletionValidation } from '../../../../src/domains/tasks/validation-steps/subtask-completion-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import type { IIntegrityValidator, IIssueRepository, IRepositoryRepository, IGitWorkflowConfig } from '../../../../src/container/interfaces.js';
import { createMockTaskData, createMockWorkflowConfig, createMockProjectConfig, createMockGitWorkflowConfig } from '../../../helpers/mock-factories.js';

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), getIssueComments: vi.fn(),
    updateTaskStatus: vi.fn(), updateTaskField: vi.fn(), updateTaskContainer: vi.fn(),
    assignTask: vi.fn(), addComment: vi.fn(), closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(), getSubIssues: vi.fn(),
  };
}

function createMockRepoRepo(): IRepositoryRepository {
  return {
    mergePullRequest: vi.fn(), findPullRequestForIssue: vi.fn(),
    checkContainerBranchMerged: vi.fn(), getPullRequestReviews: vi.fn(),
  };
}

function makeContext(taskOverrides: Record<string, unknown> = {}, gitConfig?: IGitWorkflowConfig): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'start',
    task: createMockTaskData(taskOverrides),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
    gitWorkflowConfig: gitConfig,
  };
}

describe('EpicIntegrityValidation', () => {
  let integrityValidator: IIntegrityValidator;
  let step: EpicIntegrityValidation;

  beforeEach(() => {
    integrityValidator = { validateAssignmentIntegrity: vi.fn() };
    step = new EpicIntegrityValidation(integrityValidator);
  });

  it('passes when task has no epic', async () => {
    const result = await step.validate(makeContext({ containers: { wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
  });

  it('passes when task has no container', async () => {
    const result = await step.validate(makeContext({ containers: { epic: 'Auth Epic' } }));
    expect(result.passed).toBe(true);
  });

  it('passes when epic integrity is maintained', async () => {
    vi.mocked(integrityValidator.validateAssignmentIntegrity).mockResolvedValue({
      maintained: true, violations: [],
    });
    const result = await step.validate(makeContext({ containers: { epic: 'Auth Epic', wave: 'wave-001' } }));
    expect(result.passed).toBe(true);
  });

  it('fails when epic integrity is violated', async () => {
    vi.mocked(integrityValidator.validateAssignmentIntegrity).mockResolvedValue({
      maintained: false, violations: ['Epic split across wave-001, wave-002'],
    });
    const result = await step.validate(makeContext({ containers: { epic: 'Auth Epic', wave: 'wave-001' } }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('Epic split');
  });
});

describe('DependencyValidation', () => {
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let step: DependencyValidation;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    step = new DependencyValidation(issueRepo);
  });

  it('passes when task has no dependencies', async () => {
    const result = await step.validate(makeContext({ dependencies: 'No dependencies' }));
    expect(result.passed).toBe(true);
  });

  it('passes when all dependencies are Done', async () => {
    vi.mocked(issueRepo.getTask).mockResolvedValue(createMockTaskData({ status: 'Done' }));
    const result = await step.validate(makeContext({ dependencies: '#10, #20' }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('2 dependencies');
  });

  it('fails when some dependencies are not Done', async () => {
    vi.mocked(issueRepo.getTask).mockImplementation(async (num) => {
      if (num === 10) return createMockTaskData({ number: 10, title: 'Dep A', status: 'Done' });
      return createMockTaskData({ number: 20, title: 'Dep B', status: 'In Progress' });
    });
    const result = await step.validate(makeContext({ dependencies: '#10, #20' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('#20');
    expect(result.message).toContain('In Progress');
  });

  it('handles missing dependency tasks', async () => {
    vi.mocked(issueRepo.getTask).mockRejectedValue(new Error('Not found'));
    const result = await step.validate(makeContext({ dependencies: '#999' }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('passes when dependencies field is empty', async () => {
    const result = await step.validate(makeContext({ dependencies: '' }));
    expect(result.passed).toBe(true);
  });
});

describe('ImplementationReadinessValidation', () => {
  let repoRepo: ReturnType<typeof createMockRepoRepo>;
  let step: ImplementationReadinessValidation;

  beforeEach(() => {
    repoRepo = createMockRepoRepo();
    step = new ImplementationReadinessValidation(repoRepo);
  });

  it('passes when git workflow does not require PR', async () => {
    const result = await step.validate(makeContext({}, createMockGitWorkflowConfig({ requiresPRForReview: () => false })));
    expect(result.passed).toBe(true);
  });

  it('passes when PR exists and is open', async () => {
    vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue({
      number: 100, title: 'PR', url: 'https://github.com/test/repo/pull/100',
      state: 'OPEN', merged: false,
    });
    const result = await step.validate(makeContext({}, createMockGitWorkflowConfig()));
    expect(result.passed).toBe(true);
  });

  it('fails when no PR found', async () => {
    vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue(null);
    const result = await step.validate(makeContext({}, createMockGitWorkflowConfig()));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('No pull request');
  });

  it('fails when PR is not open', async () => {
    vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue({
      number: 100, title: 'PR', url: 'https://github.com/test/repo/pull/100',
      state: 'CLOSED', merged: false,
    });
    const result = await step.validate(makeContext({}, createMockGitWorkflowConfig()));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('not open');
  });

  it('passes when no git workflow config', async () => {
    const result = await step.validate(makeContext({}));
    expect(result.passed).toBe(true);
  });
});

describe('SubtaskCompletionValidation', () => {
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let step: SubtaskCompletionValidation;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    step = new SubtaskCompletionValidation(issueRepo);
  });

  it('passes when no sub-issues exist', async () => {
    vi.mocked(issueRepo.getSubIssues).mockResolvedValue([]);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
  });

  it('passes when all sub-issues are closed', async () => {
    vi.mocked(issueRepo.getSubIssues).mockResolvedValue([
      { number: 1, title: 'Sub 1', state: 'CLOSED', url: '' },
      { number: 2, title: 'Sub 2', state: 'CLOSED', url: '' },
    ]);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(true);
  });

  it('fails when some sub-issues are open', async () => {
    vi.mocked(issueRepo.getSubIssues).mockResolvedValue([
      { number: 1, title: 'Sub 1', state: 'CLOSED', url: '' },
      { number: 2, title: 'Sub 2', state: 'OPEN', url: '' },
    ]);
    const result = await step.validate(makeContext());
    expect(result.passed).toBe(false);
    expect(result.message).toContain('#2');
  });
});
