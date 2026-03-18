/**
 * Execution Intelligence Tests — verifies the deterministic signals
 * derived from the dependency graph by the task execution aggregator.
 *
 * These tests simulate realistic project states and verify that the
 * intelligence layer produces actionable, correct signals without
 * any LLM reasoning.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aggregateTaskExecutionData } from '../../src/aggregators/task-execution-aggregator.js';
import type { ServiceContainer, TaskDataWithComments, TaskData, DependencyNode } from '@ido4/core';
import { HYDRO_PROFILE } from '@ido4/core';

// ─── Helpers ───

function makeTask(overrides: Partial<TaskData> & { number: number; title: string; status: string }): TaskData {
  return {
    id: `I_${overrides.number}`,
    itemId: `PVTI_${overrides.number}`,
    body: 'Spec body',
    containers: { wave: 'wave-001' },
    dependencies: overrides.dependencies ?? 'No dependencies',
    assignees: [],
    labels: [],
    url: `https://github.com/test/repo/issues/${overrides.number}`,
    closed: false,
    ...overrides,
  };
}

function makeTaskWithComments(
  overrides: Partial<TaskData> & { number: number; title: string; status: string },
  comments: Array<{ body: string }> = [],
): TaskDataWithComments {
  return {
    ...makeTask(overrides),
    comments: comments.map((c, i) => ({
      id: `C_${i}`,
      body: c.body,
      author: 'agent-alpha',
      createdAt: '2026-03-13T10:00:00Z',
      updatedAt: '2026-03-13T10:00:00Z',
    })),
  };
}

function contextComment(transition: string, content: string, timestamp = '2026-03-13T10:00:00Z', agent = 'agent-alpha'): string {
  return `<!-- ido4:context transition=${transition} agent=${agent} timestamp=${timestamp} -->\n${content}\n<!-- /ido4:context -->`;
}

function createMockContainer(options: {
  currentTask: TaskDataWithComments;
  allTasks: TaskData[];
  upstreamDetails: Map<number, TaskDataWithComments>;
  dependencies: DependencyNode[];
}): ServiceContainer {
  const { currentTask, allTasks, upstreamDetails, dependencies } = options;

  return {
    profile: HYDRO_PROFILE,
    issueRepository: {
      getTaskWithDetails: vi.fn().mockImplementation((num: number) => {
        if (num === currentTask.number) return Promise.resolve(currentTask);
        const detail = upstreamDetails.get(num);
        if (detail) return Promise.resolve(detail);
        const basic = allTasks.find((t) => t.number === num);
        if (basic) return Promise.resolve({ ...basic, comments: [] });
        return Promise.reject(new Error(`Task #${num} not found`));
      }),
      getTask: vi.fn().mockImplementation((num: number) => {
        const task = allTasks.find((t) => t.number === num);
        if (task) return Promise.resolve(task);
        return Promise.reject(new Error(`Task #${num} not found`));
      }),
    },
    dependencyService: {
      analyzeDependencies: vi.fn().mockResolvedValue({
        dependencies,
        unsatisfied: dependencies.filter((d) => !d.satisfied),
        allSatisfied: dependencies.every((d) => d.satisfied),
      }),
    },
    taskService: {
      listTasks: vi.fn().mockResolvedValue({
        data: { tasks: allTasks },
      }),
    },
    workflowConfig: {
      isTerminalStatus: (s: string) => s === 'Done',
      isActiveStatus: (s: string) => s === 'In Progress' || s === 'In Review',
      isBlockedStatus: (s: string) => s === 'Blocked',
    },
  } as unknown as ServiceContainer;
}

// ─── Scenarios ───

describe('Execution Intelligence', () => {
  // Pin Date.now so time-dependent warnings (stale context > 7 days) are deterministic
  const FIXED_NOW = new Date('2026-03-13T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Scenario: Payment webhook handler mid-project', () => {
    // Task #42 depends on #38 (done, has context) and #39 (in progress, no context)
    // Siblings: #43 (blocked), #44 (in progress, no context)
    // Downstream: #45 (ready for dev, waiting), #46 (ready for dev, waiting)
    // Epic: Auth (5 tasks, 2 done)

    let result: Awaited<ReturnType<typeof aggregateTaskExecutionData>>;

    beforeEach(async () => {
      const currentTask = makeTaskWithComments(
        { number: 42, title: 'Payment Webhook Handler', status: 'In Progress', dependencies: '#38, #39', containers: { wave: 'wave-001', epic: 'Epic-Auth' } },
      );

      const task38 = makeTaskWithComments(
        { number: 38, title: 'Payment Service', status: 'Done', containers: { wave: 'wave-001', epic: 'Epic-Auth' } },
        [{ body: contextComment('start', 'Approach: building PaymentEvent schema using Stripe types. Error codes: structured format from RFC 7807.', '2026-03-10T09:00:00Z') },
         { body: contextComment('review', 'Complete. PaymentEvent schema at src/types/payment.ts. Exposed processPayment() and PaymentError type. 8 unit tests.', '2026-03-11T14:00:00Z') }],
      );

      const task39 = makeTaskWithComments(
        { number: 39, title: 'Order Status Service', status: 'In Progress', containers: { wave: 'wave-001', epic: 'Epic-Auth' } },
        [], // No context comments
      );

      const task43 = makeTask({ number: 43, title: 'Email Notifications', status: 'Blocked', containers: { wave: 'wave-001', epic: 'Epic-Auth' }, dependencies: '#42' });
      const task44 = makeTask({ number: 44, title: 'Audit Logger', status: 'In Progress', containers: { wave: 'wave-001', epic: 'Epic-Auth' } });
      const task45 = makeTask({ number: 45, title: 'Order Dashboard', status: 'Ready for Dev', containers: { wave: 'wave-001', epic: 'Epic-Auth' }, dependencies: '#42' });
      const task46 = makeTask({ number: 46, title: 'Admin Panel', status: 'Ready for Dev', containers: { wave: 'wave-001' }, dependencies: '#42' });

      const allTasks = [currentTask, task38, task39, task43, task44, task45, task46];

      const container = createMockContainer({
        currentTask,
        allTasks,
        upstreamDetails: new Map([[38, task38], [39, task39]]),
        dependencies: [
          { issueNumber: 38, title: 'Payment Service', status: 'Done', satisfied: true },
          { issueNumber: 39, title: 'Order Status Service', status: 'In Progress', satisfied: false },
        ],
      });

      result = await aggregateTaskExecutionData(container, { issueNumber: 42 });
    });

    it('produces dependency signals with correct priorities', () => {
      const { dependencySignals } = result.executionIntelligence;

      expect(dependencySignals).toHaveLength(2);

      // #38: satisfied, same container, has context → critical
      const dep38 = dependencySignals.find((d) => d.issueNumber === 38)!;
      expect(dep38.priority).toBe('critical');
      expect(dep38.priorityReason).toContain('Same container');
      expect(dep38.satisfied).toBe(true);
      expect(dep38.contextBlocks).toBe(2);
      expect(dep38.lastContextTransition).toBe('review');
      expect(dep38.warnings).toHaveLength(0);

      // #39: NOT satisfied, same container → critical with warning
      const dep39 = dependencySignals.find((d) => d.issueNumber === 39)!;
      expect(dep39.priority).toBe('critical');
      expect(dep39.satisfied).toBe(false);
      expect(dep39.contextBlocks).toBe(0);
      expect(dep39.warnings.length).toBeGreaterThan(0);
      expect(dep39.warnings[0]).toContain('NOT satisfied');
    });

    it('detects blocked siblings', () => {
      const { siblingSignals } = result.executionIntelligence;

      const sibling43 = siblingSignals.find((s) => s.issueNumber === 43)!;
      expect(sibling43.warnings).toContain('BLOCKED — check if your work could unblock this sibling');
    });

    it('detects active siblings with no context', () => {
      const { siblingSignals } = result.executionIntelligence;

      const sibling44 = siblingSignals.find((s) => s.issueNumber === 44)!;
      expect(sibling44.warnings).toContain('Active with no context comments — coordinate before assuming shared patterns');
    });

    it('identifies waiting downstream tasks', () => {
      const { downstreamSignals } = result.executionIntelligence;

      expect(downstreamSignals.length).toBeGreaterThanOrEqual(1);
      const waiting = downstreamSignals.filter((d) => d.isWaiting);
      expect(waiting.length).toBeGreaterThanOrEqual(1);
    });

    it('computes risk flags', () => {
      const { riskFlags } = result.executionIntelligence;

      // Should flag unsatisfied deps
      expect(riskFlags.some((f) => f.includes('unsatisfied'))).toBe(true);
      expect(riskFlags.some((f) => f.includes('#39'))).toBe(true);

      // Should flag blocked siblings
      expect(riskFlags.some((f) => f.includes('blocked sibling'))).toBe(true);
      expect(riskFlags.some((f) => f.includes('#43'))).toBe(true);
    });

    it('computes critical path', () => {
      const { criticalPath } = result.executionIntelligence;

      // #42 has downstream tasks in the epic's remaining tasks
      expect(criticalPath).not.toBeNull();
      expect(criticalPath).toContain('#42');
    });

    it('produces a complete intelligence object', () => {
      const intel = result.executionIntelligence;

      // Structure check
      expect(intel).toHaveProperty('dependencySignals');
      expect(intel).toHaveProperty('siblingSignals');
      expect(intel).toHaveProperty('downstreamSignals');
      expect(intel).toHaveProperty('riskFlags');
      expect(intel).toHaveProperty('criticalPath');

      // The intelligence is non-trivial
      expect(intel.dependencySignals.length).toBe(2);
      expect(intel.siblingSignals.length).toBeGreaterThan(0);
      expect(intel.riskFlags.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: stable late-stage task with all deps satisfied', () => {
    let result: Awaited<ReturnType<typeof aggregateTaskExecutionData>>;

    beforeEach(async () => {
      const currentTask = makeTaskWithComments(
        { number: 50, title: 'Final Integration Test', status: 'In Progress', dependencies: '#48, #49', containers: { wave: 'wave-002' } },
      );

      const task48 = makeTaskWithComments(
        { number: 48, title: 'API Gateway', status: 'Done', containers: { wave: 'wave-002' } },
        [{ body: contextComment('review', 'Complete. Exposed /api/v2/* endpoints. Rate limiting at 100 req/s. Auth middleware integrated. 15 tests.', '2026-03-12T16:00:00Z') }],
      );

      const task49 = makeTaskWithComments(
        { number: 49, title: 'Database Migration', status: 'Done', containers: { wave: 'wave-002' } },
        [{ body: contextComment('review', 'Complete. Added users_v2 table. Migration is idempotent. Rollback tested. 6 tests.', '2026-03-12T18:00:00Z') }],
      );

      const allTasks = [currentTask, task48, task49];

      const container = createMockContainer({
        currentTask,
        allTasks,
        upstreamDetails: new Map([[48, task48], [49, task49]]),
        dependencies: [
          { issueNumber: 48, title: 'API Gateway', status: 'Done', satisfied: true },
          { issueNumber: 49, title: 'Database Migration', status: 'Done', satisfied: true },
        ],
      });

      result = await aggregateTaskExecutionData(container, { issueNumber: 50 });
    });

    it('produces clean signals with no warnings', () => {
      const { dependencySignals, riskFlags } = result.executionIntelligence;

      // Both deps satisfied, have context, no warnings
      expect(dependencySignals).toHaveLength(2);
      for (const dep of dependencySignals) {
        expect(dep.satisfied).toBe(true);
        expect(dep.contextBlocks).toBeGreaterThan(0);
        expect(dep.warnings).toHaveLength(0);
      }

      // No risk flags
      expect(riskFlags).toHaveLength(0);
    });

    it('has no critical path when no downstream in epic', () => {
      expect(result.executionIntelligence.criticalPath).toBeNull();
    });
  });

  describe('Scenario: unstable upstream with repeated block/unblock', () => {
    let result: Awaited<ReturnType<typeof aggregateTaskExecutionData>>;

    beforeEach(async () => {
      const currentTask = makeTaskWithComments(
        { number: 60, title: 'Search UI', status: 'In Progress', dependencies: '#58', containers: { wave: 'wave-003' } },
      );

      const task58 = makeTaskWithComments(
        { number: 58, title: 'Search Index', status: 'In Progress', containers: { wave: 'wave-003' } },
        [
          { body: contextComment('start', 'Starting search index implementation.', '2026-03-05T10:00:00Z') },
          { body: contextComment('block', 'Blocked by Elasticsearch version conflict.', '2026-03-06T10:00:00Z') },
          { body: contextComment('unblock', 'Resolved ES conflict by pinning version.', '2026-03-07T10:00:00Z') },
          { body: contextComment('block', 'Blocked again — index mapping fails on nested objects.', '2026-03-08T10:00:00Z') },
          { body: contextComment('unblock', 'Flattened nested objects as workaround.', '2026-03-09T10:00:00Z') },
        ],
      );

      const container = createMockContainer({
        currentTask,
        allTasks: [currentTask, task58],
        upstreamDetails: new Map([[58, task58]]),
        dependencies: [
          { issueNumber: 58, title: 'Search Index', status: 'In Progress', satisfied: false },
        ],
      });

      result = await aggregateTaskExecutionData(container, { issueNumber: 60 });
    });

    it('detects block/unblock instability', () => {
      const dep58 = result.executionIntelligence.dependencySignals.find((d) => d.issueNumber === 58)!;

      expect(dep58.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('unstable'),
          expect.stringContaining('NOT satisfied'),
        ]),
      );
    });

    it('flags unstable upstream in risk flags', () => {
      const { riskFlags } = result.executionIntelligence;

      expect(riskFlags.some((f) => f.includes('Unstable'))).toBe(true);
      expect(riskFlags.some((f) => f.includes('#58'))).toBe(true);
    });
  });

  describe('Scenario: many downstream dependents (extensibility pressure)', () => {
    let result: Awaited<ReturnType<typeof aggregateTaskExecutionData>>;

    beforeEach(async () => {
      const currentTask = makeTaskWithComments(
        { number: 70, title: 'Shared Component Library', status: 'In Progress', containers: { wave: 'wave-004', epic: 'Epic-UI' } },
      );

      const dependents = [71, 72, 73, 74].map((n) =>
        makeTask({ number: n, title: `Consumer ${n}`, status: 'Ready for Dev', containers: { wave: 'wave-004', epic: 'Epic-UI' }, dependencies: '#70' }),
      );

      const allTasks = [currentTask, ...dependents];

      const container = createMockContainer({
        currentTask,
        allTasks,
        upstreamDetails: new Map(),
        dependencies: [],
      });

      result = await aggregateTaskExecutionData(container, { issueNumber: 70 });
    });

    it('flags high downstream pressure', () => {
      const { riskFlags, downstreamSignals } = result.executionIntelligence;

      expect(downstreamSignals).toHaveLength(4);
      expect(riskFlags.some((f) => f.includes('4 downstream dependents'))).toBe(true);
      expect(riskFlags.some((f) => f.includes('extensibility'))).toBe(true);
    });
  });
});
