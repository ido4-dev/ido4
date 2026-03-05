/**
 * NoopLogger — All methods are no-ops. child() returns this.
 *
 * Use in tests or when logging is not needed.
 */

import type { ILogger, LogContext, AuditContext, PerformanceContext } from './logger.js';

export class NoopLogger implements ILogger {
  info(_message: string, _context?: LogContext): void { /* noop */ }
  warn(_message: string, _context?: LogContext): void { /* noop */ }
  error(_message: string, _error: Error, _context?: LogContext): void { /* noop */ }
  debug(_message: string, _context?: LogContext): void { /* noop */ }
  audit(_message: string, _auditContext: AuditContext): void { /* noop */ }
  performance(_operation: string, _durationMs: number, _context?: PerformanceContext): void { /* noop */ }

  child(_context: LogContext): ILogger {
    return this;
  }
}
