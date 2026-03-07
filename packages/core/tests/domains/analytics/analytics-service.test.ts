import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../../../src/domains/analytics/analytics-service.js';
import type { IAuditService } from '../../../src/domains/audit/audit-service.js';
import type { PersistedAuditEvent } from '../../../src/domains/audit/audit-store.js';
import type { IWaveService, WaveStatusData, WaveSummary, WaveCreateResult, WaveAssignResult, WaveCompletionResult } from '../../../src/container/interfaces.js';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import { TestLogger } from '../../helpers/test-logger.js';

function createMockAuditService(): IAuditService {
  return {
    queryEvents: vi.fn().mockResolvedValue({ events: [], total: 0, query: {} }),
    getSummary: vi.fn().mockResolvedValue({ period: {}, totalEvents: 0, byType: {}, byActor: {}, byTransition: {}, recentActivity: [] }),
    getRecentEvents: vi.fn().mockResolvedValue([]),
    getEventCount: vi.fn().mockResolvedValue(0),
  };
}

function createMockWaveService(): IWaveService {
  return {
    listWaves: vi.fn().mockResolvedValue([]),
    getWaveStatus: vi.fn().mockResolvedValue({
      name: 'wave-001',
      tasks: [],
      metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
    }),
    createWave: vi.fn(),
    assignTaskToWave: vi.fn(),
    validateWaveCompletion: vi.fn(),
  };
}

function makeAuditEvent(overrides: Partial<{ issueNumber: number; transition: string; timestamp: string; actorId: string }>): PersistedAuditEvent {
  return {
    id: 1,
    event: {
      type: 'task.transition',
      timestamp: overrides.timestamp ?? new Date().toISOString(),
      sessionId: 'test',
      actor: { type: 'ai-agent', id: overrides.actorId ?? 'mcp-session' },
      issueNumber: overrides.issueNumber ?? 42,
      transition: overrides.transition ?? 'start',
    },
    persistedAt: new Date().toISOString(),
  };
}

describe('AnalyticsService', () => {
  let auditService: ReturnType<typeof createMockAuditService>;
  let waveService: ReturnType<typeof createMockWaveService>;
  let eventBus: InMemoryEventBus;
  let logger: TestLogger;
  let service: AnalyticsService;

  beforeEach(() => {
    auditService = createMockAuditService();
    waveService = createMockWaveService();
    eventBus = new InMemoryEventBus();
    logger = new TestLogger();
    service = new AnalyticsService(auditService, waveService, eventBus, logger);
  });

  describe('getTaskCycleTime', () => {
    it('returns null for task with no events', async () => {
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events: [], total: 0, query: {} });
      const result = await service.getTaskCycleTime(42);
      expect(result).toBeNull();
    });

    it('computes cycle time from start to approve', async () => {
      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 42, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'approve', timestamp: '2024-01-01T10:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.getTaskCycleTime(42);

      expect(result).not.toBeNull();
      expect(result!.cycleTimeHours).toBe(10);
      expect(result!.startedAt).toBe('2024-01-01T00:00:00Z');
      expect(result!.completedAt).toBe('2024-01-01T10:00:00Z');
    });

    it('computes blocking time from block to unblock intervals', async () => {
      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 42, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'block', timestamp: '2024-01-01T02:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'unblock', timestamp: '2024-01-01T05:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'approve', timestamp: '2024-01-01T10:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 4, query: {} });

      const result = await service.getTaskCycleTime(42);

      expect(result!.blockingTimeHours).toBe(3);
      expect(result!.blockCount).toBe(1);
      expect(result!.cycleTimeHours).toBe(10);
    });

    it('computes lead time from first non-backlog transition', async () => {
      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 42, transition: 'refine', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'ready', timestamp: '2024-01-02T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'start', timestamp: '2024-01-03T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 42, transition: 'approve', timestamp: '2024-01-04T00:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 4, query: {} });

      const result = await service.getTaskCycleTime(42);

      // Lead time: refine (day 1) → approve (day 4) = 72 hours
      expect(result!.leadTimeHours).toBe(72);
      // Cycle time: start (day 3) → approve (day 4) = 24 hours
      expect(result!.cycleTimeHours).toBe(24);
    });

    it('returns null cycle time for incomplete task', async () => {
      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 42, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const result = await service.getTaskCycleTime(42);

      expect(result!.cycleTimeHours).toBeNull();
      expect(result!.completedAt).toBeNull();
    });
  });

  describe('getWaveAnalytics', () => {
    it('returns zero velocity for wave with no completed tasks', async () => {
      vi.mocked(waveService.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [{ number: 1, title: 'T1', status: 'In Progress', id: '1', itemId: 'I1', body: '' }],
        metrics: { total: 1, completed: 0, inProgress: 1, blocked: 0, ready: 0 },
      });
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events: [], total: 0, query: {} });

      const result = await service.getWaveAnalytics('wave-001');

      expect(result.velocity).toBe(0);
      expect(result.avgCycleTime).toBeNull();
      expect(result.throughput).toBeNull();
    });

    it('computes velocity as count of approved tasks', async () => {
      vi.mocked(waveService.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [
          { number: 1, title: 'T1', status: 'Done', id: '1', itemId: 'I1', body: '' },
          { number: 2, title: 'T2', status: 'Done', id: '2', itemId: 'I2', body: '' },
        ],
        metrics: { total: 2, completed: 2, inProgress: 0, blocked: 0, ready: 0 },
      });

      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 1, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 1, transition: 'approve', timestamp: '2024-01-01T10:00:00Z' }),
        makeAuditEvent({ issueNumber: 2, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 2, transition: 'approve', timestamp: '2024-01-01T08:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 4, query: {} });

      const result = await service.getWaveAnalytics('wave-001');

      expect(result.velocity).toBe(2);
      expect(result.avgCycleTime).toBe(9); // (10 + 8) / 2
    });

    it('tracks transition breakdown', async () => {
      vi.mocked(waveService.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [{ number: 1, title: 'T1', status: 'Done', id: '1', itemId: 'I1', body: '' }],
        metrics: { total: 1, completed: 1, inProgress: 0, blocked: 0, ready: 0 },
      });

      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 1, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 1, transition: 'review', timestamp: '2024-01-01T05:00:00Z' }),
        makeAuditEvent({ issueNumber: 1, transition: 'approve', timestamp: '2024-01-01T10:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 3, query: {} });

      const result = await service.getWaveAnalytics('wave-001');

      expect(result.transitionBreakdown).toEqual({ start: 1, review: 1, approve: 1 });
    });
  });

  describe('getProjectAnalytics', () => {
    it('returns empty analytics for no events', async () => {
      const result = await service.getProjectAnalytics();

      expect(result.totalTransitions).toBe(0);
      expect(result.tasksCompleted).toBe(0);
      expect(result.avgCycleTime).toBeNull();
      expect(result.throughput).toBeNull();
    });

    it('computes project-level metrics', async () => {
      const events: PersistedAuditEvent[] = [
        makeAuditEvent({ issueNumber: 1, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 1, transition: 'approve', timestamp: '2024-01-01T10:00:00Z' }),
        makeAuditEvent({ issueNumber: 2, transition: 'start', timestamp: '2024-01-01T00:00:00Z' }),
        makeAuditEvent({ issueNumber: 2, transition: 'approve', timestamp: '2024-01-01T20:00:00Z' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 4, query: {} });

      const result = await service.getProjectAnalytics({
        since: '2024-01-01T00:00:00Z',
        until: '2024-01-02T00:00:00Z',
      });

      expect(result.totalTransitions).toBe(4);
      expect(result.tasksCompleted).toBe(2);
      expect(result.avgCycleTime).toBe(15); // (10 + 20) / 2
    });
  });

  describe('cache invalidation', () => {
    it('clears cache when event bus emits', async () => {
      vi.mocked(waveService.getWaveStatus).mockResolvedValue({
        name: 'wave-001',
        tasks: [],
        metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
      });

      // First call populates cache
      await service.getWaveAnalytics('wave-001');
      const firstCallCount = vi.mocked(auditService.queryEvents).mock.calls.length;

      // Second call should use cache
      await service.getWaveAnalytics('wave-001');
      expect(vi.mocked(auditService.queryEvents).mock.calls.length).toBe(firstCallCount);

      // Emit event to invalidate cache
      eventBus.emit({
        type: 'task.transition',
        timestamp: new Date().toISOString(),
        sessionId: 'test',
        actor: { type: 'ai-agent', id: 'mcp-session' },
        issueNumber: 1,
        fromStatus: 'Ready for Dev',
        toStatus: 'In Progress',
        transition: 'start',
        dryRun: false,
      });

      // Third call should re-query
      await service.getWaveAnalytics('wave-001');
      expect(vi.mocked(auditService.queryEvents).mock.calls.length).toBe(firstCallCount + 1);
    });
  });
});
