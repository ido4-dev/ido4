import { describe, it, expect, beforeEach } from 'vitest';
import { TestLogger } from './test-logger.js';

describe('TestLogger', () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
  });

  it('captures log entries at all levels', () => {
    logger.info('info msg');
    logger.warn('warn msg');
    logger.debug('debug msg');
    logger.error('error msg', new Error('boom'));
    logger.audit('audit msg', { actor: { type: 'system', id: 'sys' } });
    logger.performance('op', 100);

    expect(logger.entries).toHaveLength(6);
    expect(logger.entries[0]!.level).toBe('info');
    expect(logger.entries[1]!.level).toBe('warn');
    expect(logger.entries[2]!.level).toBe('debug');
    expect(logger.entries[3]!.level).toBe('error');
    expect(logger.entries[4]!.level).toBe('audit');
    expect(logger.entries[5]!.level).toBe('performance');
  });

  it('getEntries() filters by level', () => {
    logger.info('a');
    logger.warn('b');
    logger.info('c');

    expect(logger.getEntries('info')).toHaveLength(2);
    expect(logger.getEntries('warn')).toHaveLength(1);
    expect(logger.getEntries('debug')).toHaveLength(0);
  });

  it('getEntries() without level returns copies', () => {
    logger.info('test');
    const entries = logger.getEntries();
    entries.pop();
    expect(logger.entries).toHaveLength(1);
  });

  it('clear() removes all entries', () => {
    logger.info('a');
    logger.info('b');
    logger.clear();
    expect(logger.entries).toHaveLength(0);
  });

  describe('child()', () => {
    it('inherits parent context', () => {
      const child = logger.child({ service: 'task-workflow' }) as TestLogger;
      child.info('starting');

      const childEntry = child.entries[0]!;
      expect(childEntry.context).toMatchObject({ service: 'task-workflow' });
    });

    it('child entries also appear in parent', () => {
      const child = logger.child({ scope: 'child' }) as TestLogger;
      child.info('from child');

      expect(logger.entries).toHaveLength(1);
      expect(child.entries).toHaveLength(1);
    });

    it('parent and child entries are independent objects', () => {
      const child = logger.child({ scope: 'child' }) as TestLogger;
      child.info('test');

      const parentEntry = logger.entries[0]!;
      const childEntry = child.entries[0]!;

      // They should NOT be the same reference
      expect(parentEntry).not.toBe(childEntry);

      // But should have equivalent content
      expect(parentEntry.message).toBe(childEntry.message);
      expect(parentEntry.context).toEqual(childEntry.context);
    });

    it('two children from same parent do not share references', () => {
      const child1 = logger.child({ scope: 'child1' }) as TestLogger;
      const child2 = logger.child({ scope: 'child2' }) as TestLogger;

      child1.info('from child1');
      child2.info('from child2');

      // Parent has both entries
      expect(logger.entries).toHaveLength(2);

      // Each child only has its own
      expect(child1.entries).toHaveLength(1);
      expect(child2.entries).toHaveLength(1);

      // Entries are independent — modifying one doesn't affect the other
      expect(child1.entries[0]!.context).toMatchObject({ scope: 'child1' });
      expect(child2.entries[0]!.context).toMatchObject({ scope: 'child2' });
    });

    it('child context overrides parent context', () => {
      const child = logger.child({ scope: 'parent' }).child({ scope: 'grandchild' }) as TestLogger;
      child.info('test');

      expect(child.entries[0]!.context).toMatchObject({ scope: 'grandchild' });
    });
  });
});
