/**
 * MergeReadinessService tests — verifies all 6 governance gate checks,
 * override mechanism, and audit event emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MergeReadinessService } from '../../../src/domains/gate/merge-readiness-service.js';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';

function createMocks() {
  const eventBus = new InMemoryEventBus();
  const logger = new NoopLogger();

  const taskService = {
    getTask: vi.fn().mockResolvedValue({
      number: 42, title: 'Test task', status: 'In Review',
      id: 'ID_42', itemId: 'ITEM_42', body: '', containers: { epic: 'Auth' },
    }),
  };

  const issueRepository = {
    findPullRequestForIssue: vi.fn().mockResolvedValue({
      number: 100, title: 'PR for #42', url: 'https://github.com/pr/100', state: 'OPEN', merged: false,
    }),
  };

  const repositoryRepository = {
    getPullRequestReviews: vi.fn().mockResolvedValue([
      { id: 'R1', author: 'reviewer', state: 'APPROVED', body: 'LGTM', submittedAt: '2026-03-07T00:00:00Z' },
    ]),
    getVulnerabilityAlerts: vi.fn().mockResolvedValue([]),
    getCommitStatusChecks: vi.fn().mockResolvedValue([]),
  };

  const dependencyService = {
    validateDependencies: vi.fn().mockResolvedValue({ valid: true, unsatisfied: [], circular: [] }),
  };

  const epicService = {
    validateEpicIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
  };

  const auditService = {
    queryEvents: vi.fn().mockResolvedValue({
      events: [
        { id: 1, event: { type: 'task.transition', transition: 'start', issueNumber: 42, timestamp: '2026-03-06T00:00:00Z', sessionId: 's', actor: { type: 'ai-agent', id: 'test' } }, persistedAt: '' },
        { id: 2, event: { type: 'task.transition', transition: 'review', issueNumber: 42, timestamp: '2026-03-07T00:00:00Z', sessionId: 's', actor: { type: 'ai-agent', id: 'test' } }, persistedAt: '' },
      ],
      total: 2,
      query: {},
    }),
  };

  const complianceService = {
    computeComplianceScore: vi.fn().mockResolvedValue({ score: 85, grade: 'B' }),
  };

  const service = new MergeReadinessService(
    taskService as any,
    issueRepository as any,
    repositoryRepository as any,
    dependencyService as any,
    epicService as any,
    auditService as any,
    complianceService as any,
    eventBus,
    'test-session',
    logger,
  );

  return { service, taskService, issueRepository, repositoryRepository, dependencyService, epicService, auditService, complianceService, eventBus };
}

describe('MergeReadinessService', () => {
  describe('all checks pass', () => {
    it('returns ready=true when all checks pass', async () => {
      const { service } = createMocks();

      const result = await service.checkMergeReadiness(42);

      expect(result.ready).toBe(true);
      expect(result.checks.every((c) => c.passed)).toBe(true);
      expect(result.overrideApplied).toBe(false);
    });

    it('returns 6 checks', async () => {
      const { service } = createMocks();

      const result = await service.checkMergeReadiness(42);

      expect(result.checks).toHaveLength(6);
      const names = result.checks.map((c) => c.name);
      expect(names).toContain('Workflow Compliance');
      expect(names).toContain('PR Review');
      expect(names).toContain('Dependency Completion');
      expect(names).toContain('Epic Integrity');
      expect(names).toContain('Security Gates');
      expect(names).toContain('Compliance Threshold');
    });
  });

  describe('workflow compliance', () => {
    it('fails when task is in wrong status', async () => {
      const { service, taskService } = createMocks();
      taskService.getTask.mockResolvedValue({
        number: 42, title: 'Test', status: 'In Progress',
        id: 'ID_42', itemId: 'ITEM_42', body: '', containers: {},
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Workflow Compliance');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('error');
      expect(check!.detail).toContain('In Progress');
    });

    it('warns when task skipped workflow steps', async () => {
      const { service, auditService } = createMocks();
      // Only has 'review', no 'start'
      auditService.queryEvents.mockResolvedValue({
        events: [
          { id: 1, event: { type: 'task.transition', transition: 'review', issueNumber: 42, timestamp: '', sessionId: 's', actor: { type: 'ai-agent', id: 'test' } }, persistedAt: '' },
        ],
        total: 1,
        query: {},
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Workflow Compliance');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('warning');
      expect(check!.detail).toContain('skipped');
    });
  });

  describe('PR review', () => {
    it('fails when no PR linked', async () => {
      const { service, issueRepository } = createMocks();
      issueRepository.findPullRequestForIssue.mockResolvedValue(null);

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'PR Review');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('error');
    });

    it('fails when insufficient reviews', async () => {
      const { service, repositoryRepository } = createMocks();
      repositoryRepository.getPullRequestReviews.mockResolvedValue([]); // 0 approvals

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'PR Review');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('0 approval(s)');
    });

    it('passes with custom minReviews', async () => {
      const { service, repositoryRepository } = createMocks();
      repositoryRepository.getPullRequestReviews.mockResolvedValue([
        { id: 'R1', author: 'a', state: 'APPROVED', body: '', submittedAt: '' },
        { id: 'R2', author: 'b', state: 'APPROVED', body: '', submittedAt: '' },
      ]);

      const result = await service.checkMergeReadiness(42, { config: { minReviews: 2 } });

      const check = result.checks.find((c) => c.name === 'PR Review');
      expect(check!.passed).toBe(true);
    });

    it('passes for already merged PR', async () => {
      const { service, issueRepository } = createMocks();
      issueRepository.findPullRequestForIssue.mockResolvedValue({
        number: 100, title: 'PR', url: '', state: 'MERGED', merged: true,
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'PR Review');
      expect(check!.passed).toBe(true);
    });
  });

  describe('dependency completion', () => {
    it('fails when dependencies are unsatisfied', async () => {
      const { service, dependencyService } = createMocks();
      dependencyService.validateDependencies.mockResolvedValue({
        valid: false, unsatisfied: [38, 39], circular: [],
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Dependency Completion');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('#38');
      expect(check!.detail).toContain('#39');
    });

    it('fails on circular dependencies', async () => {
      const { service, dependencyService } = createMocks();
      dependencyService.validateDependencies.mockResolvedValue({
        valid: false, unsatisfied: [], circular: [[42, 38, 42]],
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Dependency Completion');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('Circular');
    });
  });

  describe('epic integrity', () => {
    it('reports violations as warnings', async () => {
      const { service, epicService } = createMocks();
      epicService.validateEpicIntegrity.mockResolvedValue({
        maintained: false, violations: ['Task in wrong wave'],
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Epic Integrity');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('warning');
    });

    it('skips for tasks without epic', async () => {
      const { service, taskService } = createMocks();
      taskService.getTask.mockResolvedValue({
        number: 42, title: 'Test', status: 'In Review',
        id: 'ID_42', itemId: 'ITEM_42', body: '', containers: {},
        // no epic
      });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Epic Integrity');
      expect(check!.passed).toBe(true);
    });
  });

  describe('security gates', () => {
    it('warns on critical vulnerabilities', async () => {
      const { service, repositoryRepository } = createMocks();
      repositoryRepository.getVulnerabilityAlerts.mockResolvedValue([
        { severity: 'CRITICAL', summary: 'SQL injection in dependency' },
      ]);

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Security Gates');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('SQL injection');
    });

    it('warns on failed CI checks', async () => {
      const { service, repositoryRepository } = createMocks();
      repositoryRepository.getCommitStatusChecks.mockResolvedValue([
        { name: 'tests', state: 'FAILURE', conclusion: 'failure' },
      ]);

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Security Gates');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('tests');
    });
  });

  describe('compliance threshold', () => {
    it('fails when compliance below minimum', async () => {
      const { service, complianceService } = createMocks();
      complianceService.computeComplianceScore.mockResolvedValue({ score: 50, grade: 'D' });

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Compliance Threshold');
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('50');
    });

    it('respects custom minComplianceScore', async () => {
      const { service, complianceService } = createMocks();
      complianceService.computeComplianceScore.mockResolvedValue({ score: 85, grade: 'B' });

      const result = await service.checkMergeReadiness(42, { config: { minComplianceScore: 90 } });

      const check = result.checks.find((c) => c.name === 'Compliance Threshold');
      expect(check!.passed).toBe(false);
    });
  });

  describe('override mechanism', () => {
    it('returns ready=false when errors exist and no override', async () => {
      const { service, issueRepository } = createMocks();
      issueRepository.findPullRequestForIssue.mockResolvedValue(null); // PR error

      const result = await service.checkMergeReadiness(42);

      expect(result.ready).toBe(false);
      expect(result.overrideAvailable).toBe(true);
      expect(result.overrideConsequences).toContain('audit trail');
    });

    it('returns ready=true when override reason provided', async () => {
      const { service, issueRepository } = createMocks();
      issueRepository.findPullRequestForIssue.mockResolvedValue(null); // PR error

      const actor = { type: 'human' as const, id: 'user', name: 'User' };
      const result = await service.checkMergeReadiness(42, {
        overrideReason: 'Emergency hotfix',
        actor,
      });

      expect(result.ready).toBe(true);
      expect(result.overrideApplied).toBe(true);
    });

    it('emits governance override event', async () => {
      const { service, issueRepository, eventBus } = createMocks();
      issueRepository.findPullRequestForIssue.mockResolvedValue(null);
      const emitted: any[] = [];
      eventBus.on('*', (event) => {
        if ((event as any).type === 'governance.override') emitted.push(event);
      });

      const actor = { type: 'human' as const, id: 'user', name: 'User' };
      await service.checkMergeReadiness(42, { overrideReason: 'Emergency', actor });

      expect(emitted).toHaveLength(1);
      expect(emitted[0].reason).toBe('Emergency');
      expect(emitted[0].issueNumber).toBe(42);
      expect(emitted[0].failedChecks).toContain('PR Review');
    });

    it('does not override when only warnings fail (no errors)', async () => {
      const { service, complianceService } = createMocks();
      complianceService.computeComplianceScore.mockResolvedValue({ score: 50, grade: 'D' });
      // Compliance is a warning, not an error — so ready should still be true

      const result = await service.checkMergeReadiness(42);

      // All error-severity checks pass, only warning-severity fails
      expect(result.ready).toBe(true);
    });
  });

  describe('error resilience', () => {
    it('continues when dependency check throws', async () => {
      const { service, dependencyService } = createMocks();
      dependencyService.validateDependencies.mockRejectedValue(new Error('API down'));

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Dependency Completion');
      expect(check!.passed).toBe(true); // Graceful degradation
      expect(check!.detail).toContain('skipped');
    });

    it('continues when security check throws', async () => {
      const { service, repositoryRepository } = createMocks();
      repositoryRepository.getVulnerabilityAlerts.mockRejectedValue(new Error('403'));

      const result = await service.checkMergeReadiness(42);

      const check = result.checks.find((c) => c.name === 'Security Gates');
      expect(check!.passed).toBe(true);
      expect(check!.detail).toContain('skipped');
    });
  });
});
