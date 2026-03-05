import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { ConsoleLogger } from '../../src/shared/console-logger.js';
import { NoopLogger } from '../../src/shared/noop-logger.js';
import type { AuditContext } from '../../src/shared/logger.js';

describe('ConsoleLogger', () => {
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('writes to stderr, not stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger = new ConsoleLogger();
    logger.info('test message');

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it('produces valid JSON output', () => {
    const logger = new ConsoleLogger();
    logger.info('test message', { key: 'value' });

    const written = stderrSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim()) as Record<string, unknown>;
    expect(parsed['level']).toBe('info');
    expect(parsed['message']).toBe('test message');
    expect(parsed['key']).toBe('value');
    expect(parsed['timestamp']).toBeDefined();
  });

  it('logs all levels correctly', () => {
    const logger = new ConsoleLogger();

    logger.info('info msg');
    logger.warn('warn msg');
    logger.debug('debug msg');
    logger.error('error msg', new Error('test error'));

    expect(stderrSpy).toHaveBeenCalledTimes(4);

    const calls = stderrSpy.mock.calls.map(
      (c) => JSON.parse((c[0] as string).trim()) as Record<string, unknown>,
    );
    expect(calls[0]!['level']).toBe('info');
    expect(calls[1]!['level']).toBe('warn');
    expect(calls[2]!['level']).toBe('debug');
    expect(calls[3]!['level']).toBe('error');
  });

  it('error() includes error details', () => {
    const logger = new ConsoleLogger();
    const err = new Error('something broke');
    logger.error('operation failed', err);

    const parsed = JSON.parse((stderrSpy.mock.calls[0]![0] as string).trim()) as Record<string, unknown>;
    const errorInfo = parsed['error'] as Record<string, unknown>;
    expect(errorInfo['name']).toBe('Error');
    expect(errorInfo['message']).toBe('something broke');
    expect(errorInfo['stack']).toBeDefined();
  });

  it('audit() writes audit entries with actor', () => {
    const logger = new ConsoleLogger();
    const auditCtx: AuditContext = {
      actor: { type: 'ai-agent', id: 'agent-1', name: 'Claude' },
      issueNumber: 42,
      transition: 'start',
      fromStatus: 'Ready for Dev',
      toStatus: 'In Progress',
    };

    logger.audit('task transition', auditCtx);

    const parsed = JSON.parse((stderrSpy.mock.calls[0]![0] as string).trim()) as Record<string, unknown>;
    expect(parsed['level']).toBe('audit');
    const actor = (parsed['actor'] as Record<string, unknown>);
    expect(actor['type']).toBe('ai-agent');
    expect(actor['id']).toBe('agent-1');
  });

  it('performance() includes duration', () => {
    const logger = new ConsoleLogger();
    logger.performance('graphql-query', 150, { threshold: 200 });

    const parsed = JSON.parse((stderrSpy.mock.calls[0]![0] as string).trim()) as Record<string, unknown>;
    expect(parsed['level']).toBe('performance');
    expect(parsed['message']).toBe('graphql-query');
    expect(parsed['durationMs']).toBe(150);
    expect(parsed['threshold']).toBe(200);
  });

  it('child() inherits base context', () => {
    const logger = new ConsoleLogger({ service: 'task-workflow' });
    const child = logger.child({ operation: 'start-task' });
    child.info('starting');

    const parsed = JSON.parse((stderrSpy.mock.calls[0]![0] as string).trim()) as Record<string, unknown>;
    expect(parsed['service']).toBe('task-workflow');
    expect(parsed['operation']).toBe('start-task');
  });

  it('child context overrides parent context', () => {
    const logger = new ConsoleLogger({ scope: 'parent' });
    const child = logger.child({ scope: 'child' });
    child.info('test');

    const parsed = JSON.parse((stderrSpy.mock.calls[0]![0] as string).trim()) as Record<string, unknown>;
    expect(parsed['scope']).toBe('child');
  });
});

describe('NoopLogger', () => {
  it('satisfies ILogger interface without errors', () => {
    const logger = new NoopLogger();

    expect(() => {
      logger.info('test');
      logger.warn('test');
      logger.error('test', new Error('x'));
      logger.debug('test');
      logger.audit('test', { actor: { type: 'system', id: 'sys' } });
      logger.performance('op', 100);
    }).not.toThrow();
  });

  it('child() returns the same instance', () => {
    const logger = new NoopLogger();
    const child = logger.child({ key: 'value' });
    expect(child).toBe(logger);
  });

  it('does not write to stderr', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new NoopLogger();
    logger.info('should not appear');

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
