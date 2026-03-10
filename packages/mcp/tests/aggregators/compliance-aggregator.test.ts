/**
 * Compliance aggregator tests — verifies parallel data gathering,
 * per-task dependency analysis, per-epic integrity checks, and error isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateComplianceData } from '../../src/aggregators/compliance-aggregator.js';
import type { ServiceContainer } from '@ido4/core';
import { HYDRO_PROFILE } from '@ido4/core';

function createMockContainer() {
  return {
    profile: HYDRO_PROFILE,
    workflowConfig: {
      isBlockedStatus: (s: string) => s === 'Blocked',
      isActiveStatus: (s: string) => s === 'In Progress' || s === 'In Review',
      isTerminalStatus: (s: string) => s === 'Done',
    },
    complianceService: {
      computeComplianceScore: vi.fn().mockResolvedValue({
        score: 78, grade: 'C', period: {}, categories: [], recommendations: [],
      }),
    },
    auditService: {
      queryEvents: vi.fn().mockResolvedValue({ events: [], total: 12, query: {} }),
    },
    containerService: {
      listContainers: vi.fn().mockResolvedValue([
        { name: 'wave-001', status: 'active', taskCount: 6, completedCount: 2, completionPercentage: 33 },
        { name: 'wave-002', status: 'not_started', taskCount: 0, completedCount: 0, completionPercentage: 0 },
      ]),
    },
    taskService: {
      listTasks: vi.fn().mockResolvedValue({
        data: {
          tasks: [
            { number: 1, title: 'Task 1', status: 'Done', containers: { wave: 'wave-001', epic: 'Auth' } },
            { number: 2, title: 'Task 2', status: 'Blocked', containers: { wave: 'wave-001', epic: 'Auth' } },
            { number: 3, title: 'Task 3', status: 'In Progress', containers: { wave: 'wave-001', epic: 'Data' } },
            { number: 4, title: 'Task 4', status: 'Ready', containers: { wave: 'wave-001' } },
          ],
          total: 4,
          filters: {},
        },
      }),
    },
    analyticsService: {
      getContainerAnalytics: vi.fn().mockResolvedValue({
        waveName: 'wave-001', velocity: 33, avgCycleTime: 2.0, throughput: 1.2,
        avgBlockingTime: 0.8, totalTransitions: 15, transitionBreakdown: {},
      }),
    },
    dependencyService: {
      analyzeDependencies: vi.fn().mockResolvedValue({
        issueNumber: 2, dependencies: [], circularDependencies: [], maxDepth: 0,
      }),
    },
    epicService: {
      validateEpicIntegrity: vi.fn().mockResolvedValue({ maintained: true, violations: [] }),
    },
  } as unknown as ServiceContainer;
}

describe('aggregateComplianceData', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
  });

  it('makes parallel calls for compliance, audit, waves, tasks', async () => {
    await aggregateComplianceData(container);
    expect(container.complianceService.computeComplianceScore).toHaveBeenCalled();
    expect(container.auditService.queryEvents).toHaveBeenCalled();
    expect(container.containerService.listContainers).toHaveBeenCalled();
    expect(container.taskService.listTasks).toHaveBeenCalled();
  });

  it('passes filter options to compliance and audit services', async () => {
    await aggregateComplianceData(container, {
      since: '2026-03-01T00:00:00Z',
      until: '2026-03-07T00:00:00Z',
      actorId: 'agent-beta',
      containerName: 'wave-001',
    });

    expect(container.complianceService.computeComplianceScore).toHaveBeenCalledWith({
      since: '2026-03-01T00:00:00Z',
      until: '2026-03-07T00:00:00Z',
      actorId: 'agent-beta',
      containerName: 'wave-001',
    });
    expect(container.auditService.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        since: '2026-03-01T00:00:00Z',
        until: '2026-03-07T00:00:00Z',
        actorId: 'agent-beta',
      }),
    );
  });

  it('analyzes dependencies for blocked tasks', async () => {
    const result = await aggregateComplianceData(container);
    expect(container.dependencyService.analyzeDependencies).toHaveBeenCalledWith(2);
    expect(result.blockerAnalyses).toHaveLength(1);
    expect(result.blockerAnalyses[0]!.issueNumber).toBe(2);
  });

  it('checks epic integrity for each unique epic', async () => {
    const result = await aggregateComplianceData(container);
    // Auth and Data are 2 unique epics, task #4 has no epic
    expect(container.epicService.validateEpicIntegrity).toHaveBeenCalledTimes(2);
    expect(result.epicIntegrityChecks).toHaveLength(2);
    expect(result.epicIntegrityChecks.map((c) => c.epicName).sort()).toEqual(['Auth', 'Data']);
  });

  it('uses one representative task per epic for integrity check', async () => {
    await aggregateComplianceData(container);
    // Auth has tasks #1 and #2, should use the first one encountered (#1)
    const authCall = (container.epicService.validateEpicIntegrity as ReturnType<typeof vi.fn>).mock.calls
      .find((c) => c[0].containers['epic'] === 'Auth');
    expect(authCall![0].number).toBe(1);
  });

  it('isolates dependency analysis errors', async () => {
    (container.dependencyService.analyzeDependencies as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Dep error'));

    const result = await aggregateComplianceData(container);
    expect(result.blockerAnalyses[0]!.dependencyAnalysis).toBeNull();
  });

  it('isolates epic integrity errors', async () => {
    (container.epicService.validateEpicIntegrity as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Epic error'));

    const result = await aggregateComplianceData(container);
    expect(result.epicIntegrityChecks[0]!.result.maintained).toBe(false);
    expect(result.epicIntegrityChecks[0]!.result.violations).toContain('Epic integrity check failed');
  });

  it('uses active wave for analytics when no waveName specified', async () => {
    await aggregateComplianceData(container);
    expect(container.analyticsService.getContainerAnalytics).toHaveBeenCalledWith('wave-001');
  });

  it('uses specified waveName for analytics', async () => {
    await aggregateComplianceData(container, { containerName: 'wave-002' });
    expect(container.analyticsService.getContainerAnalytics).toHaveBeenCalledWith('wave-002');
  });

  it('builds a human-readable summary', async () => {
    const result = await aggregateComplianceData(container);
    expect(result.summary).toContain('78');
    expect(result.summary).toContain('12 audit events');
    expect(result.summary).toContain('2 waves');
    expect(result.summary).toContain('4 tasks');
    expect(result.summary).toContain('2 epics');
  });
});
