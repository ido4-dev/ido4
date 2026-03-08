/**
 * Standup aggregator tests — verifies parallel data gathering,
 * per-task PR/review iteration, error isolation, and empty states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateStandupData } from '../../src/aggregators/standup-aggregator.js';
import type { ServiceContainer } from '@ido4/core';

function createMockContainer(overrides: Record<string, unknown> = {}) {
  const defaults = {
    containerService: {
      listContainers: vi.fn().mockResolvedValue([
        { name: 'wave-001', status: 'active', taskCount: 5, completedCount: 2, completionPercentage: 40 },
      ]),
      getContainerStatus: vi.fn().mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 5, completed: 2, inProgress: 1, blocked: 1, ready: 1 },
      }),
    },
    taskService: {
      listTasks: vi.fn().mockResolvedValue({
        data: {
          tasks: [
            { number: 1, title: 'Task 1', status: 'Done', wave: 'wave-001' },
            { number: 2, title: 'Task 2', status: 'In Review', wave: 'wave-001' },
            { number: 3, title: 'Task 3', status: 'Blocked', wave: 'wave-001' },
            { number: 4, title: 'Task 4', status: 'In Progress', wave: 'wave-001' },
            { number: 5, title: 'Task 5', status: 'Ready', wave: 'wave-001' },
          ],
          total: 5,
          filters: { wave: 'wave-001' },
        },
      }),
    },
    auditService: {
      queryEvents: vi.fn().mockResolvedValue({ events: [], total: 3, query: {} }),
    },
    analyticsService: {
      getContainerAnalytics: vi.fn().mockResolvedValue({
        waveName: 'wave-001', velocity: 40, avgCycleTime: 2.1, throughput: 1.5,
        avgBlockingTime: 0.5, totalTransitions: 10, transitionBreakdown: {},
      }),
    },
    agentService: {
      listAgents: vi.fn().mockResolvedValue([]),
    },
    complianceService: {
      computeComplianceScore: vi.fn().mockResolvedValue({
        score: 85, grade: 'B', period: {}, categories: [], recommendations: [],
      }),
    },
    issueRepository: {
      findPullRequestForIssue: vi.fn().mockResolvedValue({
        number: 100, title: 'PR for #2', url: 'https://github.com/pr/100', state: 'OPEN', merged: false,
      }),
    },
    repositoryRepository: {
      getPullRequestReviews: vi.fn().mockResolvedValue([
        { id: 'R1', author: 'reviewer', state: 'APPROVED', body: 'LGTM', submittedAt: '2026-03-07T00:00:00Z' },
      ]),
    },
    dependencyService: {
      analyzeDependencies: vi.fn().mockResolvedValue({
        issueNumber: 3, dependencies: [], circularDependencies: [], maxDepth: 0,
      }),
    },
  };

  return { ...defaults, ...overrides } as unknown as ServiceContainer;
}

describe('aggregateStandupData', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
  });

  it('auto-detects active container when no containerName provided', async () => {
    const result = await aggregateStandupData(container);

    expect(container.containerService.listContainers).toHaveBeenCalled();
    expect(container.containerService.getContainerStatus).toHaveBeenCalledWith('wave-001');
    expect(result.waveStatus.name).toBe('wave-001');
  });

  it('uses provided containerName without listing containers', async () => {
    const result = await aggregateStandupData(container, { containerName: 'wave-002' });

    expect(container.containerService.listContainers).not.toHaveBeenCalled();
    expect(container.containerService.getContainerStatus).toHaveBeenCalledWith('wave-002');
    expect(result.summary).toContain('wave-002');
  });

  it('makes parallel calls for wave status, tasks, audit, analytics, agents, compliance', async () => {
    await aggregateStandupData(container);

    expect(container.containerService.getContainerStatus).toHaveBeenCalled();
    expect(container.taskService.listTasks).toHaveBeenCalledWith({ wave: 'wave-001' });
    expect(container.auditService.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({ since: expect.any(String) }),
    );
    expect(container.analyticsService.getContainerAnalytics).toHaveBeenCalledWith('wave-001');
    expect(container.agentService.listAgents).toHaveBeenCalled();
    expect(container.complianceService.computeComplianceScore).toHaveBeenCalled();
  });

  it('fetches PR and reviews for In Review tasks', async () => {
    const result = await aggregateStandupData(container);

    expect(container.issueRepository.findPullRequestForIssue).toHaveBeenCalledWith(2);
    expect(container.repositoryRepository.getPullRequestReviews).toHaveBeenCalledWith(100);
    expect(result.reviewStatuses).toHaveLength(1);
    expect(result.reviewStatuses[0]!.issueNumber).toBe(2);
    expect(result.reviewStatuses[0]!.pullRequest).not.toBeNull();
    expect(result.reviewStatuses[0]!.reviews).toHaveLength(1);
  });

  it('fetches dependency analysis for Blocked tasks', async () => {
    const result = await aggregateStandupData(container);

    expect(container.dependencyService.analyzeDependencies).toHaveBeenCalledWith(3);
    expect(result.blockerAnalyses).toHaveLength(1);
    expect(result.blockerAnalyses[0]!.issueNumber).toBe(3);
    expect(result.blockerAnalyses[0]!.dependencyAnalysis).not.toBeNull();
  });

  it('isolates PR lookup errors per task', async () => {
    (container.issueRepository.findPullRequestForIssue as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('GitHub API error'));

    const result = await aggregateStandupData(container);

    expect(result.reviewStatuses).toHaveLength(1);
    expect(result.reviewStatuses[0]!.pullRequest).toBeNull();
    expect(result.reviewStatuses[0]!.reviews).toEqual([]);
  });

  it('isolates review fetch errors per task', async () => {
    (container.repositoryRepository.getPullRequestReviews as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Review fetch error'));

    const result = await aggregateStandupData(container);

    expect(result.reviewStatuses[0]!.pullRequest).not.toBeNull();
    expect(result.reviewStatuses[0]!.reviews).toEqual([]);
  });

  it('isolates dependency analysis errors per task', async () => {
    (container.dependencyService.analyzeDependencies as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Dependency error'));

    const result = await aggregateStandupData(container);

    expect(result.blockerAnalyses).toHaveLength(1);
    expect(result.blockerAnalyses[0]!.dependencyAnalysis).toBeNull();
  });

  it('handles empty state — no In Review or Blocked tasks', async () => {
    (container.taskService.listTasks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tasks: [
          { number: 1, title: 'Task 1', status: 'Ready', wave: 'wave-001' },
        ],
        total: 1,
        filters: { wave: 'wave-001' },
      },
    });

    const result = await aggregateStandupData(container);

    expect(result.reviewStatuses).toEqual([]);
    expect(result.blockerAnalyses).toEqual([]);
    expect(container.issueRepository.findPullRequestForIssue).not.toHaveBeenCalled();
    expect(container.dependencyService.analyzeDependencies).not.toHaveBeenCalled();
  });

  it('respects custom auditHoursBack parameter', async () => {
    await aggregateStandupData(container, { auditHoursBack: 48 });

    const callArgs = (container.auditService.queryEvents as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const sinceDate = new Date(callArgs.since);
    const expectedDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    // Within 1 second tolerance
    expect(Math.abs(sinceDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
  });

  it('builds a human-readable summary', async () => {
    const result = await aggregateStandupData(container);

    expect(result.summary).toContain('wave-001');
    expect(result.summary).toContain('5 tasks');
    expect(result.summary).toContain('audit events');
    expect(result.summary).toContain('compliance');
    expect(result.summary).toContain('85');
  });

  it('throws BusinessRuleError when no active container and no containerName', async () => {
    (container.containerService.listContainers as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'wave-001', status: 'completed', taskCount: 5, completedCount: 5, completionPercentage: 100 },
    ]);

    await expect(aggregateStandupData(container)).rejects.toThrow('No active container found');
  });
});
