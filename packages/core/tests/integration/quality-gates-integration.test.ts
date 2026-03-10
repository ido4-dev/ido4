/**
 * Integration test: Quality Gate Validators
 *
 * Verifies that quality gate validation steps (PRReview, TestCoverage, SecurityScan)
 * can be instantiated from the registry and produce correct validation results
 * when wired through the configurable methodology pipeline.
 */

import { describe, it, expect, vi } from 'vitest';
import { ValidationStepRegistry } from '../../src/domains/tasks/validation-step-registry.js';
import { registerAllBuiltinSteps } from '../../src/domains/tasks/validation-steps/index.js';
import type { StepDependencies } from '../../src/domains/tasks/validation-step-registry.js';
import type { ValidationContext } from '../../src/domains/tasks/types.js';
import type { IIssueRepository, IRepositoryRepository } from '../../src/container/interfaces.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';

function createMinimalContext(issueNumber: number): ValidationContext {
  return {
    issueNumber,
    transition: 'approve',
    task: {
      number: issueNumber,
      title: 'Test Task',
      status: 'IN_REVIEW',
      labels: [],
      body: '',
      url: '',
      assignees: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    config: {} as ValidationContext['config'],
    workflowConfig: {} as ValidationContext['workflowConfig'],
    gitWorkflowConfig: {} as ValidationContext['gitWorkflowConfig'],
  };
}

describe('Quality Gates Integration', () => {
  it('PRReviewValidation passes when PR has approving review', async () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockRepoRepo: Partial<IRepositoryRepository> = {
      findPullRequestForIssue: vi.fn().mockResolvedValue({
        number: 100,
        title: 'PR for task 42',
        state: 'OPEN',
        url: 'https://github.com/test/repo/pull/100',
        merged: false,
        headRefName: 'feature-42',
      }),
      getPullRequestReviews: vi.fn().mockResolvedValue([
        { id: 'r1', state: 'APPROVED', author: 'reviewer1', body: 'LGTM', submittedAt: new Date().toISOString() },
      ]),
      getCommitStatusChecks: vi.fn().mockResolvedValue([]),
      getVulnerabilityAlerts: vi.fn().mockResolvedValue([]),
    };

    const deps: StepDependencies = {
      issueRepository: {} as IIssueRepository,
      repositoryRepository: mockRepoRepo as IRepositoryRepository,
      integrityValidator: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
      profile: HYDRO_PROFILE,
    };

    const step = registry.create('PRReviewValidation', deps);
    const result = await step.validate(createMinimalContext(42));

    expect(result.passed).toBe(true);
    expect(result.stepName).toBe('PRReviewValidation');
  });

  it('PRReviewValidation fails when PR has no approving reviews', async () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockRepoRepo: Partial<IRepositoryRepository> = {
      findPullRequestForIssue: vi.fn().mockResolvedValue({
        number: 100,
        title: 'PR for task 42',
        state: 'OPEN',
        url: 'https://github.com/test/repo/pull/100',
        merged: false,
        headRefName: 'feature-42',
      }),
      getPullRequestReviews: vi.fn().mockResolvedValue([
        { id: 'r1', state: 'CHANGES_REQUESTED', author: 'reviewer1', body: 'Fix this', submittedAt: new Date().toISOString() },
      ]),
    };

    const deps: StepDependencies = {
      issueRepository: {} as IIssueRepository,
      repositoryRepository: mockRepoRepo as IRepositoryRepository,
      integrityValidator: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
      profile: HYDRO_PROFILE,
    };

    const step = registry.create('PRReviewValidation', deps);
    const result = await step.validate(createMinimalContext(42));

    expect(result.passed).toBe(false);
    expect(result.message).toContain('approving review');
  });

  it('TestCoverageValidation passes when status checks pass', async () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockRepoRepo: Partial<IRepositoryRepository> = {
      findPullRequestForIssue: vi.fn().mockResolvedValue({
        number: 100,
        title: 'PR for task 42',
        state: 'OPEN',
        url: 'https://github.com/test/repo/pull/100',
        merged: false,
        headRefName: 'feature-42',
      }),
      getCommitStatusChecks: vi.fn().mockResolvedValue([
        { name: 'coverage', state: 'SUCCESS', conclusion: 'SUCCESS' },
      ]),
    };

    const deps: StepDependencies = {
      issueRepository: {} as IIssueRepository,
      repositoryRepository: mockRepoRepo as IRepositoryRepository,
      integrityValidator: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
      profile: HYDRO_PROFILE,
    };

    const step = registry.create('TestCoverageValidation', deps);
    const result = await step.validate(createMinimalContext(42));

    expect(result.passed).toBe(true);
    expect(result.stepName).toBe('TestCoverageValidation');
  });

  it('SecurityScanValidation passes when no critical alerts', async () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockRepoRepo: Partial<IRepositoryRepository> = {
      getVulnerabilityAlerts: vi.fn().mockResolvedValue([]),
    };

    const deps: StepDependencies = {
      issueRepository: {} as IIssueRepository,
      repositoryRepository: mockRepoRepo as IRepositoryRepository,
      integrityValidator: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
      profile: HYDRO_PROFILE,
    };

    const step = registry.create('SecurityScanValidation', deps);
    const result = await step.validate(createMinimalContext(42));

    expect(result.passed).toBe(true);
  });

  it('SecurityScanValidation fails when critical alerts exist', async () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const mockRepoRepo: Partial<IRepositoryRepository> = {
      getVulnerabilityAlerts: vi.fn().mockResolvedValue([
        { severity: 'CRITICAL', summary: 'SQL injection vulnerability' },
        { severity: 'HIGH', summary: 'XSS vulnerability' },
      ]),
    };

    const deps: StepDependencies = {
      issueRepository: {} as IIssueRepository,
      repositoryRepository: mockRepoRepo as IRepositoryRepository,
      integrityValidator: {} as any,
      projectConfig: {} as any,
      workflowConfig: {} as any,
      gitWorkflowConfig: {} as any,
      profile: HYDRO_PROFILE,
    };

    const step = registry.create('SecurityScanValidation', deps);
    const result = await step.validate(createMinimalContext(42));

    expect(result.passed).toBe(false);
    expect(result.message).toContain('vulnerability');
  });

  it('quality gate steps can all be created from registry', () => {
    const registry = new ValidationStepRegistry();
    registerAllBuiltinSteps(registry);

    const qualityGateSteps = ['PRReviewValidation', 'TestCoverageValidation', 'SecurityScanValidation'];

    for (const stepName of qualityGateSteps) {
      expect(registry.has(stepName), `Registry missing: ${stepName}`).toBe(true);
    }
  });
});
