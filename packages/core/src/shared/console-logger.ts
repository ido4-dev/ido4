/**
 * ConsoleLogger — Writes structured JSON logs to stderr.
 *
 * Critical: stdout is reserved for MCP STDIO transport.
 * All log output MUST go to stderr.
 */

import type { ILogger, LogContext, AuditContext, PerformanceContext } from './logger.js';

export class ConsoleLogger implements ILogger {
  private readonly baseContext: LogContext;

  constructor(context?: LogContext) {
    this.baseContext = context ?? {};
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, error: Error, context?: LogContext): void {
    this.write('error', message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  audit(message: string, auditContext: AuditContext): void {
    this.write('audit', message, auditContext);
  }

  performance(operation: string, durationMs: number, context?: PerformanceContext): void {
    this.write('performance', operation, { ...context, durationMs });
  }

  child(context: LogContext): ILogger {
    return new ConsoleLogger({ ...this.baseContext, ...context });
  }

  private write(level: string, message: string, context?: LogContext): void {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.baseContext,
      ...context,
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}
