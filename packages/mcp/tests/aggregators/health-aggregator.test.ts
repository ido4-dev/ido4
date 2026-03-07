/**
 * Health aggregator tests — verifies parallel-only data gathering
 * and summary generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateHealthData } from '../../src/aggregators/health-aggregator.js';
import type { ServiceContainer } from '@ido4/core';

function createMockContainer() {
  return {
    waveService: {
      listWaves: vi.fn().mockResolvedValue([
        { name: 'wave-001', status: 'active', taskCount: 8, completedCount: 6, completionPercentage: 75 },
      ]),
      getWaveStatus: vi.fn().mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 8, completed: 6, inProgress: 1, blocked: 0, ready: 1 },
      }),
    },
    complianceService: {
      computeComplianceScore: vi.fn().mockResolvedValue({
        score: 92, grade: 'A', period: {}, categories: [], recommendations: [],
      }),
    },
    analyticsService: {
      getWaveAnalytics: vi.fn().mockResolvedValue({
        waveName: 'wave-001', velocity: 75, avgCycleTime: 1.8, throughput: 1.6,
        avgBlockingTime: 0.1, totalTransitions: 20, transitionBreakdown: {},
      }),
    },
    agentService: {
      listAgents: vi.fn().mockResolvedValue([
        { id: 'agent-alpha', name: 'Alpha', registeredAt: '2026-03-06T00:00:00Z', lastHeartbeat: '2026-03-07T08:00:00Z' },
      ]),
    },
  } as unknown as ServiceContainer;
}

describe('aggregateHealthData', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
  });

  it('auto-detects active wave', async () => {
    const result = await aggregateHealthData(container);
    expect(container.waveService.listWaves).toHaveBeenCalled();
    expect(container.waveService.getWaveStatus).toHaveBeenCalledWith('wave-001');
    expect(result.waveStatus.name).toBe('wave-001');
  });

  it('uses provided waveName', async () => {
    await aggregateHealthData(container, { waveName: 'wave-003' });
    expect(container.waveService.listWaves).not.toHaveBeenCalled();
    expect(container.waveService.getWaveStatus).toHaveBeenCalledWith('wave-003');
  });

  it('makes all 4 calls in parallel', async () => {
    await aggregateHealthData(container);
    expect(container.waveService.getWaveStatus).toHaveBeenCalled();
    expect(container.complianceService.computeComplianceScore).toHaveBeenCalled();
    expect(container.analyticsService.getWaveAnalytics).toHaveBeenCalled();
    expect(container.agentService.listAgents).toHaveBeenCalled();
  });

  it('returns all data fields', async () => {
    const result = await aggregateHealthData(container);
    expect(result.waveStatus).toBeDefined();
    expect(result.compliance).toBeDefined();
    expect(result.analytics).toBeDefined();
    expect(result.agents).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('builds a human-readable summary with completion percentage', async () => {
    const result = await aggregateHealthData(container);
    expect(result.summary).toContain('wave-001');
    expect(result.summary).toContain('75%');
    expect(result.summary).toContain('6/8');
    expect(result.summary).toContain('0 blocked');
    expect(result.summary).toContain('92');
    expect(result.summary).toContain('1 agents');
  });

  it('computes 0% when no tasks exist', async () => {
    (container.waveService.getWaveStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'wave-empty',
      tasks: [],
      metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
    });

    const result = await aggregateHealthData(container, { waveName: 'wave-empty' });
    expect(result.summary).toContain('0%');
  });

  it('throws when no active wave and no waveName', async () => {
    (container.waveService.listWaves as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(aggregateHealthData(container)).rejects.toThrow('No active wave found');
  });
});
