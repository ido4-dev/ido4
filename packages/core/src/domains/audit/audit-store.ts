/**
 * IAuditStore — Persistence interface for audit events.
 * JsonlAuditStore — Append-only JSONL file implementation.
 *
 * Design decisions:
 * - Append-only: audit log is immutable (governance requirement)
 * - JSONL format: one JSON object per line, easy to stream-parse
 * - Corrupt lines are skipped and logged (never crash on bad data)
 * - Line count is cached for fast getEventCount()
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ILogger } from '../../shared/logger.js';

/** Serialized form of a domain event for audit persistence */
export interface SerializedDomainEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  actor: { type: string; id: string; name?: string };
  [key: string]: unknown;
}

/** A persisted audit event with ordinal ID */
export interface PersistedAuditEvent {
  id: number;
  event: SerializedDomainEvent;
  persistedAt: string;
}

/** Query filters for audit events */
export interface AuditQuery {
  since?: string;
  until?: string;
  actorId?: string;
  actorType?: string;
  transition?: string;
  issueNumber?: number;
  sessionId?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}

/** Result of an audit query */
export interface AuditQueryResult {
  events: PersistedAuditEvent[];
  total: number;
  query: AuditQuery;
}

/** Summary of audit events over a period */
export interface AuditSummary {
  period: { since: string; until: string };
  totalEvents: number;
  byType: Record<string, number>;
  byActor: Record<string, number>;
  byTransition: Record<string, number>;
  recentActivity: PersistedAuditEvent[];
}

export interface AuditSummaryOptions {
  since?: string;
  until?: string;
  recentLimit?: number;
}

/** Persistence interface for audit events */
export interface IAuditStore {
  appendEvent(event: SerializedDomainEvent): Promise<void>;
  readEvents(query: AuditQuery): Promise<{ events: PersistedAuditEvent[]; total: number }>;
  getEventCount(): Promise<number>;
}

export class JsonlAuditStore implements IAuditStore {
  private readonly filePath: string;
  private cachedLineCount: number | null = null;

  constructor(
    projectRoot: string,
    private readonly logger: ILogger,
  ) {
    this.filePath = path.join(projectRoot, '.ido4', 'audit-log.jsonl');
  }

  async appendEvent(event: SerializedDomainEvent): Promise<void> {
    const entry: PersistedAuditEvent = {
      id: await this.getNextId(),
      event,
      persistedAt: new Date().toISOString(),
    };

    const line = JSON.stringify(entry) + '\n';

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, line, 'utf-8');

    // Increment cached count
    if (this.cachedLineCount !== null) {
      this.cachedLineCount++;
    }
  }

  async readEvents(query: AuditQuery): Promise<{ events: PersistedAuditEvent[]; total: number }> {
    const allEvents = await this.parseFile();
    let filtered = this.applyFilters(allEvents, query);
    const total = filtered.length;

    // Apply offset
    if (query.offset && query.offset > 0) {
      filtered = filtered.slice(query.offset);
    }

    // Apply limit
    const limit = query.limit ?? 100;
    filtered = filtered.slice(0, limit);

    return { events: filtered, total };
  }

  async getEventCount(): Promise<number> {
    if (this.cachedLineCount !== null) {
      return this.cachedLineCount;
    }

    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      this.cachedLineCount = lines.length;
      return this.cachedLineCount;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.cachedLineCount = 0;
        return 0;
      }
      throw error;
    }
  }

  private async getNextId(): Promise<number> {
    const count = await this.getEventCount();
    return count + 1;
  }

  private async parseFile(): Promise<PersistedAuditEvent[]> {
    let content: string;
    try {
      content = await fs.readFile(this.filePath, 'utf-8');
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return [];
      }
      throw error;
    }

    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    const events: PersistedAuditEvent[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as PersistedAuditEvent;
        events.push(parsed);
      } catch {
        this.logger.warn('Skipping corrupt audit log line', { line: line.substring(0, 100) });
      }
    }

    // Update cached count
    this.cachedLineCount = events.length;

    return events;
  }

  private applyFilters(events: PersistedAuditEvent[], query: AuditQuery): PersistedAuditEvent[] {
    return events.filter((entry) => {
      const event = entry.event;

      if (query.since && event.timestamp < query.since) return false;
      if (query.until && event.timestamp > query.until) return false;
      if (query.actorId && event.actor.id !== query.actorId) return false;
      if (query.actorType && event.actor.type !== query.actorType) return false;
      if (query.sessionId && event.sessionId !== query.sessionId) return false;
      if (query.eventType && event.type !== query.eventType) return false;

      if (query.transition) {
        const transition = (event as Record<string, unknown>).transition;
        if (transition !== query.transition) return false;
      }

      if (query.issueNumber !== undefined) {
        const issueNumber = (event as Record<string, unknown>).issueNumber;
        if (issueNumber !== query.issueNumber) return false;
      }

      return true;
    });
  }

  private isNotFoundError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}
