import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRReviewValidation } from '../../../../src/domains/tasks/validation-steps/pr-review-validation.js';
import { TestCoverageValidation } from '../../../../src/domains/tasks/validation-steps/test-coverage-validation.js';
import { SecurityScanValidation } from '../../../../src/domains/tasks/validation-steps/security-scan-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import type { IRepositoryRepository, IIssueRepository, PullRequestReviewData, StatusCheckData, CodeScanningAlert } from '../../../../src/container/interfaces.js';

function createMockRepositoryRepo(): IRepositoryRepository {
  return {
    mergePullRequest: vi.fn(),
    findPullRequestForIssue: vi.fn().mockResolvedValue({
      number: 10,
      title: 'Fix #42',
      url: 'https://github.com/test/repo/pull/10',
      state: 'OPEN',
      merged: false,
      headRefName: 'fix-42',
      body: '',
    }),
    checkContainerBranchMerged: vi.fn(),
    getPullRequestReviews: vi.fn().mockResolvedValue([]),
    getDefaultBranchInfo: vi.fn(),
    createBranch: vi.fn(),
    createPullRequest: vi.fn(),
    closePullRequest: vi.fn(),
    deleteBranch: vi.fn(),
    getCommitStatusChecks: vi.fn().mockResolvedValue([]),
    getVulnerabilityAlerts: vi.fn().mockResolvedValue([]),
  };
}

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(),
    getTaskWithDetails: vi.fn(),
    getIssueComments: vi.fn(),
    createIssue: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTaskField: vi.fn(),
    updateTaskContainer: vi.fn(),
    assignTask: vi.fn(),
    addComment: vi.fn(),
    closeIssue: vi.fn(),
    addSubIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(),
    getSubIssues: vi.fn(),
  };
}

function makeContext(overrides?: Partial<ValidationContext>): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'approve',
    task: {
      id: 'I_1', itemId: 'PVTI_1', number: 42,
      title: 'Test Task', body: '', status: 'In Review',
    },
    config: {} as ValidationContext['config'],
    workflowConfig: {} as ValidationContext['workflowConfig'],
    ...overrides,
  };
}

describe('PRReviewValidation', () => {
  let repoRepo: ReturnType<typeof createMockRepositoryRepo>;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;

  beforeEach(() => {
    repoRepo = createMockRepositoryRepo();
    issueRepo = createMockIssueRepo();
  });

  it('fails when no PR found', async () => {
    vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue(null);

    const step = new PRReviewValidation(repoRepo, issueRepo);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('No pull request found');
  });

  it('fails when not enough approvals', async () => {
    vi.mocked(repoRepo.getPullRequestReviews).mockResolvedValue([
      { id: '1', author: 'user1', state: 'COMMENTED', body: 'ok', submittedAt: '' },
    ]);

    const step = new PRReviewValidation(repoRepo, issueRepo, 1);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('0 approving review(s)');
  });

  it('passes with sufficient approvals', async () => {
    vi.mocked(repoRepo.getPullRequestReviews).mockResolvedValue([
      { id: '1', author: 'user1', state: 'APPROVED', body: 'LGTM', submittedAt: '' },
      { id: '2', author: 'user2', state: 'APPROVED', body: 'Good', submittedAt: '' },
    ]);

    const step = new PRReviewValidation(repoRepo, issueRepo, 2);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
    expect(result.message).toContain('2 approving review(s)');
  });

  it('counts only APPROVED reviews', async () => {
    vi.mocked(repoRepo.getPullRequestReviews).mockResolvedValue([
      { id: '1', author: 'user1', state: 'APPROVED', body: '', submittedAt: '' },
      { id: '2', author: 'user2', state: 'CHANGES_REQUESTED', body: '', submittedAt: '' },
      { id: '3', author: 'user3', state: 'COMMENTED', body: '', submittedAt: '' },
    ]);

    const step = new PRReviewValidation(repoRepo, issueRepo, 2);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.details!.approvedCount).toBe(1);
  });
});

describe('TestCoverageValidation', () => {
  let repoRepo: ReturnType<typeof createMockRepositoryRepo>;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;

  beforeEach(() => {
    repoRepo = createMockRepositoryRepo();
    issueRepo = createMockIssueRepo();
  });

  it('fails when no PR found', async () => {
    vi.mocked(repoRepo.findPullRequestForIssue).mockResolvedValue(null);

    const step = new TestCoverageValidation(repoRepo, issueRepo);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('No pull request found');
  });

  it('warns when coverage check not found', async () => {
    vi.mocked(repoRepo.getCommitStatusChecks).mockResolvedValue([
      { name: 'build', state: 'SUCCESS', conclusion: 'SUCCESS' },
    ]);

    const step = new TestCoverageValidation(repoRepo, issueRepo, 'coverage');
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('No "coverage" status check found');
  });

  it('fails when coverage check is not passing', async () => {
    vi.mocked(repoRepo.getCommitStatusChecks).mockResolvedValue([
      { name: 'coverage', state: 'COMPLETED', conclusion: 'FAILURE' },
    ]);

    const step = new TestCoverageValidation(repoRepo, issueRepo);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('passes when coverage check succeeds', async () => {
    vi.mocked(repoRepo.getCommitStatusChecks).mockResolvedValue([
      { name: 'test-coverage', state: 'COMPLETED', conclusion: 'SUCCESS' },
    ]);

    const step = new TestCoverageValidation(repoRepo, issueRepo, 'coverage');
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
  });

  it('matches check name case-insensitively', async () => {
    vi.mocked(repoRepo.getCommitStatusChecks).mockResolvedValue([
      { name: 'Code Coverage Report', state: 'COMPLETED', conclusion: 'SUCCESS' },
    ]);

    const step = new TestCoverageValidation(repoRepo, issueRepo, 'coverage');
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
  });
});

describe('SecurityScanValidation', () => {
  let repoRepo: ReturnType<typeof createMockRepositoryRepo>;

  beforeEach(() => {
    repoRepo = createMockRepositoryRepo();
  });

  it('passes with no alerts', async () => {
    vi.mocked(repoRepo.getVulnerabilityAlerts).mockResolvedValue([]);

    const step = new SecurityScanValidation(repoRepo);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
  });

  it('fails when critical alerts exceed max', async () => {
    vi.mocked(repoRepo.getVulnerabilityAlerts).mockResolvedValue([
      { severity: 'CRITICAL', summary: 'SQL injection' },
      { severity: 'HIGH', summary: 'XSS vulnerability' },
    ]);

    const step = new SecurityScanValidation(repoRepo, 0);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('2 critical/high vulnerability alert(s)');
  });

  it('ignores LOW/MODERATE alerts', async () => {
    vi.mocked(repoRepo.getVulnerabilityAlerts).mockResolvedValue([
      { severity: 'LOW', summary: 'Minor issue' },
      { severity: 'MODERATE', summary: 'Some concern' },
    ]);

    const step = new SecurityScanValidation(repoRepo, 0);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
  });

  it('handles API failure gracefully', async () => {
    vi.mocked(repoRepo.getVulnerabilityAlerts).mockRejectedValue(new Error('403'));

    const step = new SecurityScanValidation(repoRepo);
    const result = await step.validate(makeContext());

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
  });
});
