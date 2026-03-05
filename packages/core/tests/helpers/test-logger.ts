/**
 * TestLogger — Captures all log entries for test assertions.
 *
 * Implements ILogger. All entries stored in `entries` array.
 * Use `getEntries(level)` to filter, `clear()` to reset.
 */

import type { ILogger, LogEntry, AuditContext, PerformanceContext, LogContext } from '../../src/shared/logger.js';

export class TestLogger implements ILogger {
  readonly entries: LogEntry[] = [];

  info(message: string, context?: LogContext): void {
    this.entries.push({ level: 'info', message, context, timestamp: new Date().toISOString() });
  }

  warn(message: string, context?: LogContext): void {
    this.entries.push({ level: 'warn', message, context, timestamp: new Date().toISOString() });
  }

  error(message: string, error: Error, context?: LogContext): void {
    this.entries.push({ level: 'error', message, context: { ...context, error: error.message }, timestamp: new Date().toISOString() });
  }

  debug(message: string, context?: LogContext): void {
    this.entries.push({ level: 'debug', message, context, timestamp: new Date().toISOString() });
  }

  audit(message: string, auditContext: AuditContext): void {
    this.entries.push({ level: 'audit', message, context: auditContext, timestamp: new Date().toISOString() });
  }

  performance(operation: string, durationMs: number, context?: PerformanceContext): void {
    this.entries.push({ level: 'performance', message: operation, context: { ...context, durationMs }, timestamp: new Date().toISOString() });
  }

  child(context: LogContext): ILogger {
    const child = new TestLogger();
    const parentEntries = this.entries;
    const originalPush = child.entries.push.bind(child.entries);
    child.entries.push = function (...items: LogEntry[]): number {
      for (const item of items) {
        // Merge context without mutating the original entry
        const merged: LogEntry = { ...item, context: { ...context, ...item.context } };
        parentEntries.push(merged);
        // Store independent copy in child — parent and child never share references
        originalPush({ ...merged });
      }
      return child.entries.length;
    };
    return child;
  }

  getEntries(level?: string): LogEntry[] {
    if (!level) return [...this.entries];
    return this.entries.filter((e) => e.level === level);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
