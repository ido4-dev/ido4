/**
 * AuditService — Event sourcing for governance audit trail.
 *
 * Subscribes to all domain events via IEventBus('*'), persists them via IAuditStore,
 * maintains an in-memory ring buffer for fast session queries.
 */

import type { IEventBus, DomainEvent, Unsubscribe } from '../../shared/events/index.js';
import type { ILogger } from '../../shared/logger.js';
import type {
  IAuditStore,
  SerializedDomainEvent,
  PersistedAuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditSummary,
  AuditSummaryOptions,
} from './audit-store.js';

const DEFAULT_RING_BUFFER_SIZE = 500;
const DEFAULT_RECENT_LIMIT = 20;

/** Service interface for querying the audit trail */
export interface IAuditService {
  queryEvents(query: AuditQuery): Promise<AuditQueryResult>;
  getSummary(options?: AuditSummaryOptions): Promise<AuditSummary>;
  getRecentEvents(limit?: number): Promise<PersistedAuditEvent[]>;
  getEventCount(): Promise<number>;
}

export class AuditService implements IAuditService {
  private readonly ringBuffer: PersistedAuditEvent[] = [];
  private readonly ringBufferSize: number;
  private readonly unsubscribe: Unsubscribe;
  private nextBufferId = 1;

  constructor(
    private readonly store: IAuditStore,
    eventBus: IEventBus,
    private readonly logger: ILogger,
    ringBufferSize?: number,
  ) {
    this.ringBufferSize = ringBufferSize ?? DEFAULT_RING_BUFFER_SIZE;

    // Subscribe to all domain events
    this.unsubscribe = eventBus.on('*', (event: DomainEvent) => {
      this.handleEvent(event);
    });
  }

  async queryEvents(query: AuditQuery): Promise<AuditQueryResult> {
    const { events, total } = await this.store.readEvents(query);
    return { events, total, query };
  }

  async getSummary(options?: AuditSummaryOptions): Promise<AuditSummary> {
    const since = options?.since ?? new Date(0).toISOString();
    const until = options?.until ?? new Date().toISOString();
    const recentLimit = options?.recentLimit ?? DEFAULT_RECENT_LIMIT;

    const { events } = await this.store.readEvents({
      since,
      until,
      limit: 10000, // Read all events for summary computation
    });

    const byType: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    const byTransition: Record<string, number> = {};

    for (const entry of events) {
      const event = entry.event;

      // Count by type
      byType[event.type] = (byType[event.type] ?? 0) + 1;

      // Count by actor
      const actorKey = event.actor.id;
      byActor[actorKey] = (byActor[actorKey] ?? 0) + 1;

      // Count by transition (if present)
      const transition = (event as Record<string, unknown>).transition;
      if (typeof transition === 'string') {
        byTransition[transition] = (byTransition[transition] ?? 0) + 1;
      }
    }

    // Get recent events (last N)
    const recentActivity = events.slice(-recentLimit);

    return {
      period: { since, until },
      totalEvents: events.length,
      byType,
      byActor,
      byTransition,
      recentActivity,
    };
  }

  async getRecentEvents(limit?: number): Promise<PersistedAuditEvent[]> {
    const count = limit ?? DEFAULT_RECENT_LIMIT;
    // Return from ring buffer (most recent last)
    return this.ringBuffer.slice(-count);
  }

  async getEventCount(): Promise<number> {
    return this.store.getEventCount();
  }

  /** Cleanup: unsubscribe from event bus */
  dispose(): void {
    this.unsubscribe();
  }

  private handleEvent(event: DomainEvent): void {
    // Skip dry-run events
    if ('dryRun' in event && (event as unknown as { dryRun?: boolean }).dryRun === true) {
      return;
    }

    const serialized = this.serializeEvent(event);
    const persisted: PersistedAuditEvent = {
      id: this.nextBufferId++,
      event: serialized,
      persistedAt: new Date().toISOString(),
    };

    // Add to ring buffer
    this.ringBuffer.push(persisted);
    if (this.ringBuffer.length > this.ringBufferSize) {
      this.ringBuffer.shift();
    }

    // Persist asynchronously (fire-and-forget with error logging)
    this.store.appendEvent(serialized).catch((error) => {
      this.logger.warn('Failed to persist audit event', {
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private serializeEvent(event: DomainEvent): SerializedDomainEvent {
    // Spread the event to capture all fields as a plain object
    return JSON.parse(JSON.stringify(event)) as SerializedDomainEvent;
  }
}
