/**
 * AnalyticsService — Computes real metrics from audit event history.
 *
 * No separate storage — the audit log IS the source of truth.
 * Reconstructs per-task timelines from events, computes cycle time,
 * lead time, throughput, and blocking time.
 */

import type { IAuditService } from '../audit/audit-service.js';
import type { PersistedAuditEvent, SerializedDomainEvent } from '../audit/audit-store.js';
import type { IContainerService } from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { IEventBus, Unsubscribe } from '../../shared/events/index.js';

export interface IAnalyticsService {
  getContainerAnalytics(waveName: string): Promise<ContainerAnalytics>;
  getProjectAnalytics(options?: AnalyticsOptions): Promise<ProjectAnalytics>;
  getTaskCycleTime(issueNumber: number): Promise<TaskCycleTime | null>;
}

export interface AnalyticsOptions {
  since?: string;
  until?: string;
  waveName?: string;
}

export interface ContainerAnalytics {
  waveName: string;
  velocity: number;
  avgCycleTime: number | null;
  avgLeadTime: number | null;
  throughput: number | null;
  avgBlockingTime: number | null;
  totalTransitions: number;
  transitionBreakdown: Record<string, number>;
  blockedTaskCount: number;
}

export interface ProjectAnalytics {
  since: string;
  until: string;
  totalTransitions: number;
  tasksCompleted: number;
  avgCycleTime: number | null;
  avgLeadTime: number | null;
  throughput: number | null;
  waveBreakdown: Record<string, { velocity: number; avgCycleTime: number | null }>;
}

export interface TaskCycleTime {
  issueNumber: number;
  startedAt: string | null;
  completedAt: string | null;
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  blockingTimeHours: number;
  blockCount: number;
}

interface TaskTimeline {
  issueNumber: number;
  events: SerializedDomainEvent[];
}

export class AnalyticsService implements IAnalyticsService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTtlMs = 30_000; // 30s cache
  private readonly unsubscribe: Unsubscribe;

  constructor(
    private readonly auditService: IAuditService,
    private readonly containerService: IContainerService,
    eventBus: IEventBus,
    _logger: ILogger,
  ) {
    // Invalidate cache on any new event
    this.unsubscribe = eventBus.on('*', () => {
      this.cache.clear();
    });
  }

  async getContainerAnalytics(waveName: string): Promise<ContainerAnalytics> {
    const cacheKey = `container:${waveName}`;
    const cached = this.getCached<ContainerAnalytics>(cacheKey);
    if (cached) return cached;

    // Get container tasks
    const waveStatus = await this.containerService.getContainerStatus(waveName);
    const taskNumbers = new Set(waveStatus.tasks.map((t) => t.number));

    // Get all transition events for these tasks
    const { events } = await this.auditService.queryEvents({
      eventType: 'task.transition',
      limit: 10000,
    });

    const waveEvents = events.filter((e) => {
      const issueNumber = (e.event as Record<string, unknown>).issueNumber;
      return typeof issueNumber === 'number' && taskNumbers.has(issueNumber);
    });

    // Build per-task timelines
    const timelines = this.buildTimelines(waveEvents);
    const cycleTimes = timelines.map((tl) => this.computeTaskMetrics(tl));

    // Compute aggregates
    const completed = cycleTimes.filter((ct) => ct.completedAt !== null);
    const velocity = completed.length;

    const validCycleTimes = completed.filter((ct) => ct.cycleTimeHours !== null).map((ct) => ct.cycleTimeHours!);
    const avgCycleTime = validCycleTimes.length > 0
      ? validCycleTimes.reduce((a, b) => a + b, 0) / validCycleTimes.length
      : null;

    const validLeadTimes = completed.filter((ct) => ct.leadTimeHours !== null).map((ct) => ct.leadTimeHours!);
    const avgLeadTime = validLeadTimes.length > 0
      ? validLeadTimes.reduce((a, b) => a + b, 0) / validLeadTimes.length
      : null;

    const blockingTimes = cycleTimes.filter((ct) => ct.blockingTimeHours > 0);
    const avgBlockingTime = blockingTimes.length > 0
      ? blockingTimes.reduce((a, b) => a + b.blockingTimeHours, 0) / blockingTimes.length
      : null;

    // Compute throughput (tasks/day)
    let throughput: number | null = null;
    if (completed.length > 0) {
      const timestamps = waveEvents.map((e) => new Date(e.event.timestamp).getTime());
      if (timestamps.length > 0) {
        const earliest = Math.min(...timestamps);
        const latest = Math.max(...timestamps);
        const days = (latest - earliest) / (1000 * 60 * 60 * 24);
        throughput = days > 0 ? completed.length / days : completed.length;
      }
    }

    // Transition breakdown
    const transitionBreakdown: Record<string, number> = {};
    for (const event of waveEvents) {
      const transition = (event.event as Record<string, unknown>).transition;
      if (typeof transition === 'string') {
        transitionBreakdown[transition] = (transitionBreakdown[transition] ?? 0) + 1;
      }
    }

    const result: ContainerAnalytics = {
      waveName,
      velocity,
      avgCycleTime: avgCycleTime !== null ? Math.round(avgCycleTime * 100) / 100 : null,
      avgLeadTime: avgLeadTime !== null ? Math.round(avgLeadTime * 100) / 100 : null,
      throughput: throughput !== null ? Math.round(throughput * 100) / 100 : null,
      avgBlockingTime: avgBlockingTime !== null ? Math.round(avgBlockingTime * 100) / 100 : null,
      totalTransitions: waveEvents.length,
      transitionBreakdown,
      blockedTaskCount: cycleTimes.filter((ct) => ct.blockCount > 0).length,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getProjectAnalytics(options?: AnalyticsOptions): Promise<ProjectAnalytics> {
    const since = options?.since ?? new Date(0).toISOString();
    const until = options?.until ?? new Date().toISOString();

    const { events } = await this.auditService.queryEvents({
      eventType: 'task.transition',
      since,
      until,
      limit: 10000,
    });

    const timelines = this.buildTimelines(events);
    const cycleTimes = timelines.map((tl) => this.computeTaskMetrics(tl));

    const completed = cycleTimes.filter((ct) => ct.completedAt !== null);
    const validCycleTimes = completed.filter((ct) => ct.cycleTimeHours !== null).map((ct) => ct.cycleTimeHours!);
    const validLeadTimes = completed.filter((ct) => ct.leadTimeHours !== null).map((ct) => ct.leadTimeHours!);

    const avgCycleTime = validCycleTimes.length > 0
      ? Math.round((validCycleTimes.reduce((a, b) => a + b, 0) / validCycleTimes.length) * 100) / 100
      : null;

    const avgLeadTime = validLeadTimes.length > 0
      ? Math.round((validLeadTimes.reduce((a, b) => a + b, 0) / validLeadTimes.length) * 100) / 100
      : null;

    let throughput: number | null = null;
    if (completed.length > 0) {
      const sinceMs = new Date(since).getTime();
      const untilMs = new Date(until).getTime();
      const days = (untilMs - sinceMs) / (1000 * 60 * 60 * 24);
      throughput = days > 0 ? Math.round((completed.length / days) * 100) / 100 : completed.length;
    }

    return {
      since,
      until,
      totalTransitions: events.length,
      tasksCompleted: completed.length,
      avgCycleTime,
      avgLeadTime,
      throughput,
      waveBreakdown: {},
    };
  }

  async getTaskCycleTime(issueNumber: number): Promise<TaskCycleTime | null> {
    const { events } = await this.auditService.queryEvents({
      issueNumber,
      eventType: 'task.transition',
      limit: 1000,
    });

    if (events.length === 0) return null;

    const timeline: TaskTimeline = {
      issueNumber,
      events: events.map((e) => e.event),
    };

    return this.computeTaskMetrics(timeline);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private buildTimelines(events: PersistedAuditEvent[]): TaskTimeline[] {
    const byIssue = new Map<number, SerializedDomainEvent[]>();

    for (const entry of events) {
      const issueNumber = (entry.event as Record<string, unknown>).issueNumber;
      if (typeof issueNumber !== 'number') continue;

      if (!byIssue.has(issueNumber)) {
        byIssue.set(issueNumber, []);
      }
      byIssue.get(issueNumber)!.push(entry.event);
    }

    return [...byIssue.entries()].map(([issueNumber, evts]) => ({
      issueNumber,
      events: evts.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }));
  }

  private computeTaskMetrics(timeline: TaskTimeline): TaskCycleTime {
    const { issueNumber, events } = timeline;

    let startedAt: string | null = null;
    let completedAt: string | null = null;
    let firstNonBacklog: string | null = null;
    let blockingTimeMs = 0;
    let blockCount = 0;
    let lastBlockedAt: string | null = null;

    for (const event of events) {
      const transition = (event as Record<string, unknown>).transition as string | undefined;
      if (!transition) continue;

      // Track first non-backlog transition for lead time
      if (!firstNonBacklog && transition !== 'return') {
        firstNonBacklog = event.timestamp;
      }

      // Track start for cycle time
      if (transition === 'start' && !startedAt) {
        startedAt = event.timestamp;
      }

      // Track completion
      if (transition === 'approve') {
        completedAt = event.timestamp;
      }

      // Track blocking time
      if (transition === 'block') {
        lastBlockedAt = event.timestamp;
        blockCount++;
      }

      if (transition === 'unblock' && lastBlockedAt) {
        blockingTimeMs += new Date(event.timestamp).getTime() - new Date(lastBlockedAt).getTime();
        lastBlockedAt = null;
      }
    }

    const blockingTimeHours = blockingTimeMs / (1000 * 60 * 60);

    const cycleTimeHours = startedAt && completedAt
      ? (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60)
      : null;

    const leadTimeHours = firstNonBacklog && completedAt
      ? (new Date(completedAt).getTime() - new Date(firstNonBacklog).getTime()) / (1000 * 60 * 60)
      : null;

    return {
      issueNumber,
      startedAt,
      completedAt,
      cycleTimeHours: cycleTimeHours !== null ? Math.round(cycleTimeHours * 100) / 100 : null,
      leadTimeHours: leadTimeHours !== null ? Math.round(leadTimeHours * 100) / 100 : null,
      blockingTimeHours: Math.round(blockingTimeHours * 100) / 100,
      blockCount,
    };
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
