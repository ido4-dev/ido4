import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonlAuditStore } from '../../../src/domains/audit/audit-store.js';
import type { SerializedDomainEvent } from '../../../src/domains/audit/audit-store.js';
import { TestLogger } from '../../helpers/test-logger.js';

function makeEvent(overrides?: Partial<SerializedDomainEvent>): SerializedDomainEvent {
  return {
    type: 'task.transition',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    actor: { type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' },
    issueNumber: 42,
    transition: 'start',
    fromStatus: 'Ready for Dev',
    toStatus: 'In Progress',
    ...overrides,
  };
}

describe('JsonlAuditStore', () => {
  let tmpDir: string;
  let store: JsonlAuditStore;
  let logger: TestLogger;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-test-'));
    logger = new TestLogger();
    store = new JsonlAuditStore(tmpDir, logger);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('appendEvent', () => {
    it('creates the .ido4 directory and file on first append', async () => {
      await store.appendEvent(makeEvent());

      const filePath = path.join(tmpDir, '.ido4', 'audit-log.jsonl');
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    });

    it('appends events as JSONL lines', async () => {
      await store.appendEvent(makeEvent({ issueNumber: 1 }));
      await store.appendEvent(makeEvent({ issueNumber: 2 }));
      await store.appendEvent(makeEvent({ issueNumber: 3 }));

      const content = await fs.readFile(path.join(tmpDir, '.ido4', 'audit-log.jsonl'), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(3);

      const first = JSON.parse(lines[0]!);
      expect(first.id).toBe(1);
      expect(first.event.issueNumber).toBe(1);

      const third = JSON.parse(lines[2]!);
      expect(third.id).toBe(3);
      expect(third.event.issueNumber).toBe(3);
    });

    it('assigns sequential IDs', async () => {
      await store.appendEvent(makeEvent());
      await store.appendEvent(makeEvent());

      const { events } = await store.readEvents({});
      expect(events[0]!.id).toBe(1);
      expect(events[1]!.id).toBe(2);
    });
  });

  describe('readEvents', () => {
    it('returns empty array for missing file', async () => {
      const { events, total } = await store.readEvents({});
      expect(events).toEqual([]);
      expect(total).toBe(0);
    });

    it('reads all events with no filters', async () => {
      await store.appendEvent(makeEvent({ issueNumber: 1 }));
      await store.appendEvent(makeEvent({ issueNumber: 2 }));

      const { events, total } = await store.readEvents({});
      expect(events).toHaveLength(2);
      expect(total).toBe(2);
    });

    it('filters by time range (since)', async () => {
      await store.appendEvent(makeEvent({ timestamp: '2024-01-01T00:00:00Z' }));
      await store.appendEvent(makeEvent({ timestamp: '2024-06-01T00:00:00Z' }));
      await store.appendEvent(makeEvent({ timestamp: '2024-12-01T00:00:00Z' }));

      const { events } = await store.readEvents({ since: '2024-05-01T00:00:00Z' });
      expect(events).toHaveLength(2);
    });

    it('filters by time range (until)', async () => {
      await store.appendEvent(makeEvent({ timestamp: '2024-01-01T00:00:00Z' }));
      await store.appendEvent(makeEvent({ timestamp: '2024-06-01T00:00:00Z' }));

      const { events } = await store.readEvents({ until: '2024-03-01T00:00:00Z' });
      expect(events).toHaveLength(1);
    });

    it('filters by actorId', async () => {
      await store.appendEvent(makeEvent({ actor: { type: 'ai-agent', id: 'agent-1' } }));
      await store.appendEvent(makeEvent({ actor: { type: 'ai-agent', id: 'agent-2' } }));
      await store.appendEvent(makeEvent({ actor: { type: 'ai-agent', id: 'agent-1' } }));

      const { events } = await store.readEvents({ actorId: 'agent-1' });
      expect(events).toHaveLength(2);
    });

    it('filters by transition', async () => {
      await store.appendEvent(makeEvent({ transition: 'start' }));
      await store.appendEvent(makeEvent({ transition: 'approve' }));
      await store.appendEvent(makeEvent({ transition: 'start' }));

      const { events } = await store.readEvents({ transition: 'start' });
      expect(events).toHaveLength(2);
    });

    it('filters by issueNumber', async () => {
      await store.appendEvent(makeEvent({ issueNumber: 10 }));
      await store.appendEvent(makeEvent({ issueNumber: 20 }));
      await store.appendEvent(makeEvent({ issueNumber: 10 }));

      const { events } = await store.readEvents({ issueNumber: 10 });
      expect(events).toHaveLength(2);
    });

    it('filters by sessionId', async () => {
      await store.appendEvent(makeEvent({ sessionId: 'sess-a' }));
      await store.appendEvent(makeEvent({ sessionId: 'sess-b' }));

      const { events } = await store.readEvents({ sessionId: 'sess-a' });
      expect(events).toHaveLength(1);
    });

    it('filters by eventType', async () => {
      await store.appendEvent(makeEvent({ type: 'task.transition' }));
      await store.appendEvent(makeEvent({ type: 'wave.assignment' }));

      const { events } = await store.readEvents({ eventType: 'task.transition' });
      expect(events).toHaveLength(1);
    });

    it('applies limit', async () => {
      for (let i = 0; i < 10; i++) {
        await store.appendEvent(makeEvent({ issueNumber: i }));
      }

      const { events, total } = await store.readEvents({ limit: 3 });
      expect(events).toHaveLength(3);
      expect(total).toBe(10);
    });

    it('applies offset and limit for pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await store.appendEvent(makeEvent({ issueNumber: i }));
      }

      const { events } = await store.readEvents({ offset: 2, limit: 3 });
      expect(events).toHaveLength(3);
      expect(events[0]!.event.issueNumber).toBe(2);
    });

    it('skips corrupt lines and logs warning', async () => {
      const filePath = path.join(tmpDir, '.ido4', 'audit-log.jsonl');
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      const validEntry = JSON.stringify({
        id: 1,
        event: makeEvent(),
        persistedAt: new Date().toISOString(),
      });
      const corruptLine = '{corrupt json!!!';

      await fs.writeFile(filePath, `${validEntry}\n${corruptLine}\n`, 'utf-8');

      const { events, total } = await store.readEvents({});
      expect(events).toHaveLength(1);
      expect(total).toBe(1);
      expect(logger.getEntries('warn')).toHaveLength(1);
    });
  });

  describe('getEventCount', () => {
    it('returns 0 for missing file', async () => {
      expect(await store.getEventCount()).toBe(0);
    });

    it('returns count of events', async () => {
      await store.appendEvent(makeEvent());
      await store.appendEvent(makeEvent());
      await store.appendEvent(makeEvent());

      expect(await store.getEventCount()).toBe(3);
    });

    it('caches count after first read', async () => {
      await store.appendEvent(makeEvent());

      // First call reads file
      expect(await store.getEventCount()).toBe(1);

      // Second call uses cache (append increments cached count)
      await store.appendEvent(makeEvent());
      expect(await store.getEventCount()).toBe(2);
    });
  });

  describe('append-only semantics', () => {
    it('never overwrites existing entries', async () => {
      await store.appendEvent(makeEvent({ issueNumber: 1 }));
      await store.appendEvent(makeEvent({ issueNumber: 2 }));

      const { events: firstRead } = await store.readEvents({});
      expect(firstRead).toHaveLength(2);

      await store.appendEvent(makeEvent({ issueNumber: 3 }));

      const { events: secondRead } = await store.readEvents({});
      expect(secondRead).toHaveLength(3);
      expect(secondRead[0]!.event.issueNumber).toBe(1);
      expect(secondRead[1]!.event.issueNumber).toBe(2);
      expect(secondRead[2]!.event.issueNumber).toBe(3);
    });
  });
});
