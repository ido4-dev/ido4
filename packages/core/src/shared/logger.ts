/**
 * ILogger — Logging contract for all @ido4/core components.
 *
 * Key design decisions:
 * - error() requires an Error argument (not just a string)
 * - audit() requires AuditContext with mandatory actor (ADR-15)
 * - performance() requires operation name + duration
 * - child() creates a sub-logger with inherited context
 */

export interface LogContext {
  readonly [key: string]: unknown;
}

export interface AuditContext extends LogContext {
  /** Actor identity — required on every audit entry (ADR-15) */
  readonly actor: ActorIdentity;
  readonly issueNumber?: number;
  readonly transition?: string;
  readonly fromStatus?: string;
  readonly toStatus?: string;
  readonly dryRun?: boolean;
}

export interface ActorIdentity {
  readonly type: 'human' | 'ai-agent' | 'system';
  readonly id: string;
  readonly name?: string;
}

export interface PerformanceContext extends LogContext {
  readonly threshold?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface LogEntry {
  level: string;
  message: string;
  context?: LogContext;
  timestamp: string;
}

export interface ILogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  audit(message: string, auditContext: AuditContext): void;
  performance(operation: string, durationMs: number, context?: PerformanceContext): void;
  child(context: LogContext): ILogger;
}
