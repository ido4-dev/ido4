/**
 * Integration test: AuditService + AnalyticsService + EventBus
 *
 * Verifies that events emitted through the event bus are:
 * 1. Captured by AuditService and persisted
 * 2. Queryable via AuditService
 * 3. Used by AnalyticsService to compute real metrics (cycle time, blocking time, etc.)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InMemoryEventBus } from '../../src/shared/events/in-memory-event-bus.js';
import { AuditService } from '../../src/domains/audit/audit-service.js';
import { JsonlAuditStore } from '../../src/domains/audit/audit-store.js';
import { AnalyticsService } from '../../src/domains/analytics/analytics-service.js';
import type { TaskTransitionEvent } from '../../src/shared/events/types.js';
import type { IContainerService } from '../../src/container/interfaces.js';
import { TestLogger } from '../helpers/test-logger.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';

function createTransitionEvent(
  issueNumber: number,
  transition: string,
  fromStatus: string,
  toStatus: string,
  timestamp: string,
  actor = 'agent-1',
  sessionId = 'session-1',
): TaskTransitionEvent {
  return {
    type: 'task.transition',
    issueNumber,
    transition,
    fromStatus,
    toStatus,
    timestamp,
    sessionId,
    actor: { type: 'ai-agent', id: actor, name: `Agent ${actor}` },
    dryRun: false,
  };
}

function createMockContainerService(taskNumbers: number[]): IContainerService {
  return {
    getContainerStatus: async () => ({
      name: 'wave-1',
      status: 'active',
      tasks: taskNumbers.map((n) => ({ number: n, title: `Task ${n}`, status: 'IN_PROGRESS' })),
      totalTasks: taskNumbers.length,
      completedTasks: 0,
      progress: 0,
    }),
    listContainers: async () => [],
    createContainer: async () => ({ success: true }),
    assignTaskToContainer: async () => ({ success: true }),
    validateContainerCompletion: async () => ({ complete: false, blockers: [] }),
  } as unknown as IContainerService;
}

describe('Audit + Analytics Integration', () => {
  let tmpDir: string;
  let eventBus: InMemoryEventBus;
  let auditService: AuditService;
  let analyticsService: AnalyticsService;
  let logger: TestLogger;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-analytics-integration-'));
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    logger = new TestLogger();
    eventBus = new InMemoryEventBus();
    const auditStore = new JsonlAuditStore(tmpDir, logger);
    auditService = new AuditService(auditStore, eventBus, logger);
    const containerService = createMockContainerService([42, 43, 44]);
    analyticsService = new AnalyticsService(auditService, containerService, eventBus, logger, HYDRO_PROFILE);
  });

  afterEach(async () => {
    auditService.dispose();
    analyticsService.dispose();
    eventBus.removeAllListeners();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('emitted events flow through to audit queries', async () => {
    const now = new Date();

    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', now.toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(43, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(now.getTime() + 1000).toISOString()));

    await new Promise((r) => setTimeout(r, 200));

    const result = await auditService.queryEvents({ eventType: 'task.transition' });
    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.event.type).toBe('task.transition');
  });

  it('recent events come from ring buffer', async () => {
    for (let i = 0; i < 5; i++) {
      eventBus.emit(createTransitionEvent(
        40 + i, 'start', 'READY_FOR_DEV', 'IN_PROGRESS',
        new Date(Date.now() + i * 1000).toISOString(),
      ));
    }

    const recent = await auditService.getRecentEvents(3);
    expect(recent).toHaveLength(3);
    // Most recent should be the last emitted
    expect((recent[2]!.event as Record<string, unknown>).issueNumber).toBe(44);
  });

  it('dry-run events are NOT persisted', async () => {
    const dryRunEvent: TaskTransitionEvent = {
      ...createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date().toISOString()),
      dryRun: true,
    };

    eventBus.emit(dryRunEvent);
    await new Promise((r) => setTimeout(r, 50));

    const recent = await auditService.getRecentEvents();
    expect(recent).toHaveLength(0);
  });

  it('audit summary groups by type, actor, and transition', async () => {
    // Use past timestamps to avoid getSummary's `until: new Date()` filtering them out
    const base = Date.now() - 10_000;

    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(base).toISOString(), 'agent-1'));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(43, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(base + 1000).toISOString(), 'agent-2'));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(42, 'review', 'IN_PROGRESS', 'IN_REVIEW', new Date(base + 2000).toISOString(), 'agent-1'));

    // Wait for all async persistence to complete
    await new Promise((r) => setTimeout(r, 200));

    const summary = await auditService.getSummary();
    expect(summary.totalEvents).toBe(3);
    expect(summary.byType['task.transition']).toBe(3);
    expect(summary.byActor['agent-1']).toBe(2);
    expect(summary.byActor['agent-2']).toBe(1);
    expect(summary.byTransition['start']).toBe(2);
    expect(summary.byTransition['review']).toBe(1);
  });

  it('analytics computes cycle time from real events', async () => {
    const t0 = new Date('2024-06-01T10:00:00Z');
    const t1 = new Date('2024-06-01T20:00:00Z'); // 10h later

    // Stagger emits to avoid concurrent file write races in JSONL audit store
    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', t0.toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(42, 'review', 'IN_PROGRESS', 'IN_REVIEW', new Date(t0.getTime() + 8 * 3600_000).toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(42, 'approve', 'IN_REVIEW', 'DONE', t1.toISOString()));

    await new Promise((r) => setTimeout(r, 200));

    const cycleTime = await analyticsService.getTaskCycleTime(42);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.issueNumber).toBe(42);
    expect(cycleTime!.cycleTimeHours).toBe(10);
    expect(cycleTime!.startedAt).toBe(t0.toISOString());
    expect(cycleTime!.completedAt).toBe(t1.toISOString());
  });

  it('analytics computes blocking time from block/unblock events', async () => {
    const t0 = new Date('2024-06-01T10:00:00Z');

    // Stagger emits to avoid concurrent file write races
    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', t0.toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    // Blocked at T+2h
    eventBus.emit(createTransitionEvent(42, 'block', 'IN_PROGRESS', 'BLOCKED', new Date(t0.getTime() + 2 * 3600_000).toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    // Unblocked at T+5h (3h blocked)
    eventBus.emit(createTransitionEvent(42, 'unblock', 'BLOCKED', 'READY_FOR_DEV', new Date(t0.getTime() + 5 * 3600_000).toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    // Restarted at T+5h
    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(t0.getTime() + 5 * 3600_000).toISOString()));
    await new Promise((r) => setTimeout(r, 30));
    // Approved at T+10h
    eventBus.emit(createTransitionEvent(42, 'approve', 'IN_REVIEW', 'DONE', new Date(t0.getTime() + 10 * 3600_000).toISOString()));

    // Wait for all async persistence to complete
    await new Promise((r) => setTimeout(r, 200));

    const cycleTime = await analyticsService.getTaskCycleTime(42);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.blockCount).toBe(1);
    expect(cycleTime!.blockingTimeHours).toBe(3);
    expect(cycleTime!.cycleTimeHours).toBe(10); // start → approve
  });

  it('analytics returns null for task with no events', async () => {
    const cycleTime = await analyticsService.getTaskCycleTime(999);
    expect(cycleTime).toBeNull();
  });

  it('multi-actor audit trail distinguishes agents', async () => {
    const now = Date.now();

    eventBus.emit(createTransitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(now).toISOString(), 'agent-alpha'));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(43, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(now + 1000).toISOString(), 'agent-beta'));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(createTransitionEvent(42, 'review', 'IN_PROGRESS', 'IN_REVIEW', new Date(now + 2000).toISOString(), 'agent-alpha'));

    await new Promise((r) => setTimeout(r, 200));

    // Query by actor
    const alphaEvents = await auditService.queryEvents({ actorId: 'agent-alpha' });
    expect(alphaEvents.events).toHaveLength(2);

    const betaEvents = await auditService.queryEvents({ actorId: 'agent-beta' });
    expect(betaEvents.events).toHaveLength(1);
  });

  it('high-volume: transitions produce correct metrics', async () => {
    const baseTime = new Date('2024-06-01T00:00:00Z').getTime();
    const tasksToComplete = [42, 43, 44];

    // Emit events with staggered waits to avoid concurrent file write races
    for (const taskNum of tasksToComplete) {
      const offset = (taskNum - 42) * 50 * 3600_000;
      eventBus.emit(createTransitionEvent(taskNum, 'refine', 'BACKLOG', 'IN_REFINEMENT', new Date(baseTime + offset).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(taskNum, 'ready', 'IN_REFINEMENT', 'READY_FOR_DEV', new Date(baseTime + offset + 1 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(taskNum, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(baseTime + offset + 2 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(taskNum, 'review', 'IN_PROGRESS', 'IN_REVIEW', new Date(baseTime + offset + 8 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(taskNum, 'approve', 'IN_REVIEW', 'DONE', new Date(baseTime + offset + 12 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
    }

    // Add some blocked transitions
    for (let i = 45; i < 48; i++) {
      const offset = (i - 42) * 10 * 3600_000;
      eventBus.emit(createTransitionEvent(i, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', new Date(baseTime + offset).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(i, 'block', 'IN_PROGRESS', 'BLOCKED', new Date(baseTime + offset + 3 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
      eventBus.emit(createTransitionEvent(i, 'unblock', 'BLOCKED', 'READY_FOR_DEV', new Date(baseTime + offset + 6 * 3600_000).toISOString()));
      await new Promise((r) => setTimeout(r, 15));
    }

    // Wait for all async persistence to complete
    await new Promise((r) => setTimeout(r, 300));

    // Verify total events captured: 5*3 completed + 3*3 blocked = 24
    const summary = await auditService.getSummary();
    expect(summary.totalEvents).toBe(24);

    // Verify analytics for individual completed task
    const ct42 = await analyticsService.getTaskCycleTime(42);
    expect(ct42).not.toBeNull();
    expect(ct42!.cycleTimeHours).toBe(10); // start(T+2) → approve(T+12) = 10h
    expect(ct42!.leadTimeHours).toBe(12); // refine(T+0) → approve(T+12) = 12h
    expect(ct42!.blockCount).toBe(0);

    // Verify blocked task metrics
    const ct45 = await analyticsService.getTaskCycleTime(45);
    expect(ct45).not.toBeNull();
    expect(ct45!.blockCount).toBe(1);
    expect(ct45!.blockingTimeHours).toBe(3); // blocked for 3h
    expect(ct45!.completedAt).toBeNull(); // never approved
  });
});
