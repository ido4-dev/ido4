/**
 * Board aggregator tests — verifies parallel data gathering,
 * per-task PR and lock annotations, and error isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateBoardData } from '../../src/aggregators/board-aggregator.js';
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
    containerService: {
      listContainers: vi.fn().mockResolvedValue([
        { name: 'wave-001', status: 'active', taskCount: 4, completedCount: 1, completionPercentage: 25 },
      ]),
      getContainerStatus: vi.fn().mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 4, completed: 1, inProgress: 1, blocked: 1, ready: 1 },
      }),
    },
    taskService: {
      listTasks: vi.fn().mockResolvedValue({
        data: {
          tasks: [
            { number: 1, title: 'Task 1', status: 'Done', wave: 'wave-001' },
            { number: 2, title: 'Task 2', status: 'In Review', wave: 'wave-001' },
            { number: 3, title: 'Task 3', status: 'In Progress', wave: 'wave-001' },
            { number: 4, title: 'Task 4', status: 'Ready', wave: 'wave-001' },
          ],
          total: 4,
          filters: { wave: 'wave-001' },
        },
      }),
    },
    analyticsService: {
      getContainerAnalytics: vi.fn().mockResolvedValue({
        waveName: 'wave-001', velocity: 25, avgCycleTime: 1.5, throughput: 1.0,
        avgBlockingTime: 0.2, totalTransitions: 6, transitionBreakdown: {},
      }),
    },
    agentService: {
      listAgents: vi.fn().mockResolvedValue([]),
      getTaskLock: vi.fn().mockResolvedValue({
        issueNumber: 3, agentId: 'agent-alpha', acquiredAt: '2026-03-07T00:00:00Z', expiresAt: '2026-03-07T01:00:00Z',
      }),
    },
    issueRepository: {
      findPullRequestForIssue: vi.fn().mockResolvedValue({
        number: 200, title: 'PR for #2', url: 'https://github.com/pr/200', state: 'OPEN', merged: false,
      }),
    },
    projectConfig: {
      project: { id: 'PVT_1', number: 3, repository: 'owner/repo', title: 'Test', url: 'https://github.com/users/owner/projects/3' },
    },
  } as unknown as ServiceContainer;
}

describe('aggregateBoardData', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
  });

  it('auto-detects active wave', async () => {
    const result = await aggregateBoardData(container);
    expect(container.containerService.getContainerStatus).toHaveBeenCalledWith('wave-001');
    expect(result.containerStatus.name).toBe('wave-001');
  });

  it('uses provided waveName', async () => {
    await aggregateBoardData(container, { containerName: 'wave-002' });
    expect(container.containerService.listContainers).not.toHaveBeenCalled();
    expect(container.containerService.getContainerStatus).toHaveBeenCalledWith('wave-002');
  });

  it('makes parallel calls for wave status, tasks, analytics, agents', async () => {
    await aggregateBoardData(container);
    expect(container.containerService.getContainerStatus).toHaveBeenCalled();
    expect(container.taskService.listTasks).toHaveBeenCalled();
    expect(container.analyticsService.getContainerAnalytics).toHaveBeenCalled();
    expect(container.agentService.listAgents).toHaveBeenCalled();
  });

  it('annotates In Review tasks with PR info', async () => {
    const result = await aggregateBoardData(container);
    const reviewAnnotation = result.annotations.find((a) => a.issueNumber === 2);
    expect(reviewAnnotation).toBeDefined();
    expect(reviewAnnotation!.pullRequest).not.toBeNull();
    expect(reviewAnnotation!.pullRequest!.number).toBe(200);
  });

  it('annotates In Progress tasks with lock info', async () => {
    const result = await aggregateBoardData(container);
    const progressAnnotation = result.annotations.find((a) => a.issueNumber === 3);
    expect(progressAnnotation).toBeDefined();
    expect(progressAnnotation!.lock).not.toBeNull();
    expect(progressAnnotation!.lock!.agentId).toBe('agent-alpha');
  });

  it('does not annotate Done or Ready tasks', async () => {
    const result = await aggregateBoardData(container);
    const doneAnnotation = result.annotations.find((a) => a.issueNumber === 1);
    const readyAnnotation = result.annotations.find((a) => a.issueNumber === 4);
    expect(doneAnnotation).toBeUndefined();
    expect(readyAnnotation).toBeUndefined();
    expect(result.annotations).toHaveLength(2);
  });

  it('isolates PR lookup errors', async () => {
    (container.issueRepository.findPullRequestForIssue as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('API error'));

    const result = await aggregateBoardData(container);
    const annotation = result.annotations.find((a) => a.issueNumber === 2);
    expect(annotation!.pullRequest).toBeNull();
  });

  it('isolates lock lookup errors', async () => {
    (container.agentService.getTaskLock as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Lock error'));

    const result = await aggregateBoardData(container);
    const annotation = result.annotations.find((a) => a.issueNumber === 3);
    expect(annotation!.lock).toBeNull();
  });

  it('builds a human-readable summary', async () => {
    const result = await aggregateBoardData(container);
    expect(result.summary).toContain('wave-001');
    expect(result.summary).toContain('4 tasks');
    expect(result.summary).toContain('1 done');
  });

  it('includes project URL from config', async () => {
    const result = await aggregateBoardData(container);
    expect(result.projectUrl).toBe('https://github.com/users/owner/projects/3');
  });

  it('returns null projectUrl when not in config', async () => {
    (container as any).projectConfig = { project: { id: 'PVT_1', number: 3, repository: 'owner/repo' } };
    const result = await aggregateBoardData(container);
    expect(result.projectUrl).toBeNull();
  });
});
