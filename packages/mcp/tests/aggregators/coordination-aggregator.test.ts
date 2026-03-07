/**
 * Coordination aggregator tests — verifies multi-agent state gathering,
 * lock detection, event filtering, and next-task recommendation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateCoordinationData } from '../../src/aggregators/coordination-aggregator.js';
import type { ServiceContainer } from '@ido4/core';

function createMockContainer() {
  return {
    agentService: {
      listAgents: vi.fn().mockResolvedValue([
        {
          agentId: 'agent-alpha',
          name: 'Alpha',
          role: 'coding',
          registeredAt: '2026-03-07T00:00:00Z',
          lastHeartbeat: new Date().toISOString(),
        },
        {
          agentId: 'agent-beta',
          name: 'Beta',
          role: 'review',
          registeredAt: '2026-03-07T00:00:00Z',
          lastHeartbeat: '2026-03-06T00:00:00Z', // stale
        },
      ]),
      getTaskLock: vi.fn().mockResolvedValue(null),
    },
    auditService: {
      queryEvents: vi.fn().mockResolvedValue({ events: [], total: 0, query: {} }),
      getRecentEvents: vi.fn().mockResolvedValue([]),
    },
    waveService: {
      listWaves: vi.fn().mockResolvedValue([
        { name: 'wave-001', status: 'active', taskCount: 3, completedCount: 1, completionPercentage: 33 },
      ]),
      getWaveStatus: vi.fn().mockResolvedValue({
        name: 'wave-001',
        tasks: [
          { number: 1, title: 'Task 1', status: 'In Progress', wave: 'wave-001' },
          { number: 2, title: 'Task 2', status: 'Ready', wave: 'wave-001' },
          { number: 3, title: 'Task 3', status: 'Done', wave: 'wave-001' },
        ],
        metrics: { total: 3, completed: 1, inProgress: 1, blocked: 0, ready: 1 },
      }),
    },
    workDistributionService: {
      getNextTask: vi.fn().mockResolvedValue({
        recommendation: { issueNumber: 2, title: 'Task 2', score: 35, reasoning: 'Best candidate' },
        alternatives: [],
        context: { activeWave: 'wave-001', agentId: 'mcp-session', lockedTasks: [], totalCandidates: 1 },
      }),
    },
  } as unknown as ServiceContainer;
}

describe('aggregateCoordinationData', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
  });

  it('returns all registered agents with status', async () => {
    const result = await aggregateCoordinationData(container);

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]!.agentId).toBe('agent-alpha');
    expect(result.agents[1]!.agentId).toBe('agent-beta');
  });

  it('detects stale agents', async () => {
    const result = await aggregateCoordinationData(container);

    const alpha = result.agents.find((a) => a.agentId === 'agent-alpha');
    const beta = result.agents.find((a) => a.agentId === 'agent-beta');
    expect(alpha!.isStale).toBe(false);
    expect(beta!.isStale).toBe(true);
  });

  it('identifies agent current task from locks', async () => {
    (container.agentService.getTaskLock as ReturnType<typeof vi.fn>)
      .mockImplementation(async (num: number) => {
        if (num === 1) return { issueNumber: 1, agentId: 'agent-alpha', acquiredAt: '', expiresAt: '' };
        return null;
      });

    const result = await aggregateCoordinationData(container);

    const alpha = result.agents.find((a) => a.agentId === 'agent-alpha');
    expect(alpha!.currentTask).toEqual({ issueNumber: 1, title: 'Task 1' });
  });

  it('collects active locks with task titles', async () => {
    (container.agentService.getTaskLock as ReturnType<typeof vi.fn>)
      .mockImplementation(async (num: number) => {
        if (num === 1) return { issueNumber: 1, agentId: 'agent-alpha', acquiredAt: '2026-03-07T00:00:00Z', expiresAt: '2026-03-07T01:00:00Z' };
        return null;
      });

    const result = await aggregateCoordinationData(container);

    expect(result.activeLocks).toHaveLength(1);
    expect(result.activeLocks[0]!.taskTitle).toBe('Task 1');
    expect(result.activeLocks[0]!.agentId).toBe('agent-alpha');
  });

  it('counts transitions per agent from audit events', async () => {
    (container.auditService.queryEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
      events: [
        { id: 1, event: { type: 'task.transition', actor: { id: 'agent-alpha' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
        { id: 2, event: { type: 'task.transition', actor: { id: 'agent-alpha' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
        { id: 3, event: { type: 'task.transition', actor: { id: 'agent-beta' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
      ],
      total: 3,
      query: {},
    });

    const result = await aggregateCoordinationData(container);

    const alpha = result.agents.find((a) => a.agentId === 'agent-alpha');
    const beta = result.agents.find((a) => a.agentId === 'agent-beta');
    expect(alpha!.transitionCount24h).toBe(2);
    expect(beta!.transitionCount24h).toBe(1);
  });

  it('filters handoff and recommendation events', async () => {
    (container.auditService.queryEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
      events: [
        { id: 1, event: { type: 'work.handoff', actor: { id: 'system' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
        { id: 2, event: { type: 'work.recommendation', actor: { id: 'system' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
        { id: 3, event: { type: 'task.transition', actor: { id: 'agent-alpha' }, timestamp: new Date().toISOString(), sessionId: 's' }, persistedAt: '' },
      ],
      total: 3,
      query: {},
    });

    const result = await aggregateCoordinationData(container);

    expect(result.recentHandoffs).toHaveLength(1);
    expect(result.recentRecommendations).toHaveLength(1);
    expect(result.recentEvents).toHaveLength(3);
  });

  it('includes next task recommendation for requesting agent', async () => {
    const result = await aggregateCoordinationData(container);

    expect(result.myNextRecommendation).not.toBeNull();
    expect(result.myNextRecommendation!.issueNumber).toBe(2);
    expect(result.myNextRecommendation!.reasoning).toBe('Best candidate');
  });

  it('handles missing work distribution gracefully', async () => {
    (container.workDistributionService.getNextTask as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('No active wave'));

    const result = await aggregateCoordinationData(container);

    expect(result.myNextRecommendation).toBeNull();
  });

  it('handles no active wave gracefully', async () => {
    (container.waveService.listWaves as ReturnType<typeof vi.fn>)
      .mockResolvedValue([{ name: 'wave-001', status: 'completed' }]);

    const result = await aggregateCoordinationData(container);

    expect(result.activeLocks).toHaveLength(0);
    expect(result.agents).toHaveLength(2);
  });

  it('respects since parameter for event filtering', async () => {
    const since = '2026-03-06T12:00:00Z';
    await aggregateCoordinationData(container, { since });

    expect(container.auditService.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({ since }),
    );
  });

  it('builds a human-readable summary', async () => {
    const result = await aggregateCoordinationData(container);

    expect(result.summary).toContain('2 agents');
    expect(result.summary).toContain('active');
    expect(result.summary).toContain('stale');
  });
});
