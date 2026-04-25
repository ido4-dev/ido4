import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../../../src/domains/audit/audit-service.js';
import type { IAuditStore, SerializedDomainEvent, PersistedAuditEvent } from '../../../src/domains/audit/audit-store.js';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import type { TaskTransitionEvent, ContainerAssignmentEvent, ValidationEvent } from '../../../src/shared/events/types.js';
import { TestLogger } from '../../helpers/test-logger.js';

function createMockStore(): IAuditStore {
  return {
    appendEvent: vi.fn().mockResolvedValue(undefined),
    readEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
    getEventCount: vi.fn().mockResolvedValue(0),
  };
}

function makeTransitionEvent(overrides?: Partial<TaskTransitionEvent>): TaskTransitionEvent {
  return {
    type: 'task.transition',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    actor: { type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' },
    issueNumber: 42,
    fromStatus: 'Ready for Dev',
    toStatus: 'In Progress',
    transition: 'start',
    dryRun: false,
    ...overrides,
  };
}

function makeContainerAssignmentEvent(overrides?: Partial<ContainerAssignmentEvent>): ContainerAssignmentEvent {
  return {
    type: 'container.assignment',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    actor: { type: 'ai-agent', id: 'mcp-session' },
    issueNumber: 42,
    containerName: 'wave-001',
    integrityMaintained: true,
    ...overrides,
  };
}

function makeValidationEvent(overrides?: Partial<ValidationEvent>): ValidationEvent {
  return {
    type: 'validation.completed',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    actor: { type: 'ai-agent', id: 'mcp-session' },
    issueNumber: 42,
    transition: 'start',
    result: { stepsRun: 5, stepsPassed: 5, stepsFailed: 0, stepsWarned: 0, details: [] },
    passed: true,
    ...overrides,
  };
}

describe('AuditService', () => {
  let store: ReturnType<typeof createMockStore>;
  let eventBus: InMemoryEventBus;
  let logger: TestLogger;
  let service: AuditService;

  beforeEach(() => {
    store = createMockStore();
    eventBus = new InMemoryEventBus();
    logger = new TestLogger();
    service = new AuditService(store, eventBus, logger);
  });

  describe('event bus subscription', () => {
    it('subscribes to all events and persists them', async () => {
      const event = makeTransitionEvent();
      eventBus.emit(event);

      // Wait for async persistence
      await vi.waitFor(() => {
        expect(store.appendEvent).toHaveBeenCalledTimes(1);
      });

      const persisted = vi.mocked(store.appendEvent).mock.calls[0]![0]!;
      expect(persisted.type).toBe('task.transition');
      expect(persisted.issueNumber).toBe(42);
    });

    it('persists container assignment events', async () => {
      eventBus.emit(makeContainerAssignmentEvent());

      await vi.waitFor(() => {
        expect(store.appendEvent).toHaveBeenCalledTimes(1);
      });

      const persisted = vi.mocked(store.appendEvent).mock.calls[0]![0]!;
      expect(persisted.type).toBe('container.assignment');
    });

    it('persists validation events', async () => {
      eventBus.emit(makeValidationEvent());

      await vi.waitFor(() => {
        expect(store.appendEvent).toHaveBeenCalledTimes(1);
      });

      const persisted = vi.mocked(store.appendEvent).mock.calls[0]![0]!;
      expect(persisted.type).toBe('validation.completed');
    });

    it('skips dry-run events', () => {
      const dryRunEvent = makeTransitionEvent({ dryRun: true });
      eventBus.emit(dryRunEvent);

      expect(store.appendEvent).not.toHaveBeenCalled();
    });

    it('logs warning when persistence fails', async () => {
      vi.mocked(store.appendEvent).mockRejectedValueOnce(new Error('disk full'));
      eventBus.emit(makeTransitionEvent());

      await vi.waitFor(() => {
        expect(logger.getEntries('warn')).toHaveLength(1);
      });

      expect(logger.getEntries('warn')[0]!.message).toBe('Failed to persist audit event');
    });
  });

  describe('ring buffer', () => {
    it('stores events in memory for fast retrieval', async () => {
      eventBus.emit(makeTransitionEvent({ issueNumber: 1 }));
      eventBus.emit(makeTransitionEvent({ issueNumber: 2 }));

      const recent = await service.getRecentEvents();
      expect(recent).toHaveLength(2);
      expect(recent[0]!.event.issueNumber).toBe(1);
      expect(recent[1]!.event.issueNumber).toBe(2);
    });

    it('limits to specified count', async () => {
      for (let i = 1; i <= 5; i++) {
        eventBus.emit(makeTransitionEvent({ issueNumber: i }));
      }

      const recent = await service.getRecentEvents(2);
      expect(recent).toHaveLength(2);
      expect(recent[0]!.event.issueNumber).toBe(4);
      expect(recent[1]!.event.issueNumber).toBe(5);
    });

    it('evicts oldest events when buffer exceeds capacity', async () => {
      // Use a small ring buffer for testing
      const smallService = new AuditService(store, eventBus, logger, 5);

      for (let i = 1; i <= 8; i++) {
        eventBus.emit(makeTransitionEvent({ issueNumber: i }));
      }

      const recent = await smallService.getRecentEvents(10);
      expect(recent).toHaveLength(5);
      // Should have events 4-8 (oldest 3 evicted)
      expect(recent[0]!.event.issueNumber).toBe(4);
      expect(recent[4]!.event.issueNumber).toBe(8);
    });

    it('maintains chronological ordering', async () => {
      eventBus.emit(makeTransitionEvent({ issueNumber: 1, timestamp: '2024-01-01T00:00:00Z' }));
      eventBus.emit(makeContainerAssignmentEvent({ issueNumber: 2 }));
      eventBus.emit(makeTransitionEvent({ issueNumber: 3, timestamp: '2024-03-01T00:00:00Z' }));

      const recent = await service.getRecentEvents();
      expect(recent).toHaveLength(3);
      expect(recent[0]!.event.issueNumber).toBe(1);
      expect(recent[1]!.event.issueNumber).toBe(2);
      expect(recent[2]!.event.issueNumber).toBe(3);
    });
  });

  describe('queryEvents', () => {
    it('delegates to store with query filters', async () => {
      const mockEvents: PersistedAuditEvent[] = [{
        id: 1,
        event: { type: 'task.transition', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', actor: { type: 'ai-agent', id: 'mcp-session' } },
        persistedAt: '2024-01-01T00:00:01Z',
      }];
      vi.mocked(store.readEvents).mockResolvedValue({ events: mockEvents, total: 1 });

      const result = await service.queryEvents({ since: '2024-01-01T00:00:00Z', transition: 'start' });

      expect(store.readEvents).toHaveBeenCalledWith({
        since: '2024-01-01T00:00:00Z',
        transition: 'start',
      });
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.query).toEqual({ since: '2024-01-01T00:00:00Z', transition: 'start' });
    });

    it('passes actorType filter through to store', async () => {
      vi.mocked(store.readEvents).mockResolvedValue({ events: [], total: 0 });

      await service.queryEvents({ actorType: 'ai-agent' });

      expect(store.readEvents).toHaveBeenCalledWith({ actorType: 'ai-agent' });
    });
  });

  describe('getSummary', () => {
    it('computes summary from stored events', async () => {
      const events: PersistedAuditEvent[] = [
        {
          id: 1,
          event: {
            type: 'task.transition', timestamp: '2024-01-01T00:00:00Z',
            sessionId: 's1', actor: { type: 'ai-agent', id: 'agent-1' },
            transition: 'start',
          },
          persistedAt: '2024-01-01T00:00:01Z',
        },
        {
          id: 2,
          event: {
            type: 'task.transition', timestamp: '2024-01-02T00:00:00Z',
            sessionId: 's1', actor: { type: 'ai-agent', id: 'agent-1' },
            transition: 'approve',
          },
          persistedAt: '2024-01-02T00:00:01Z',
        },
        {
          id: 3,
          event: {
            type: 'container.assignment', timestamp: '2024-01-03T00:00:00Z',
            sessionId: 's1', actor: { type: 'ai-agent', id: 'agent-2' },
          },
          persistedAt: '2024-01-03T00:00:01Z',
        },
      ];
      vi.mocked(store.readEvents).mockResolvedValue({ events, total: 3 });

      const summary = await service.getSummary();

      expect(summary.totalEvents).toBe(3);
      expect(summary.byType).toEqual({ 'task.transition': 2, 'container.assignment': 1 });
      expect(summary.byActor).toEqual({ 'agent-1': 2, 'agent-2': 1 });
      expect(summary.byTransition).toEqual({ start: 1, approve: 1 });
      expect(summary.recentActivity).toHaveLength(3);
    });

    it('returns empty summary for no events', async () => {
      vi.mocked(store.readEvents).mockResolvedValue({ events: [], total: 0 });

      const summary = await service.getSummary();

      expect(summary.totalEvents).toBe(0);
      expect(summary.byType).toEqual({});
      expect(summary.byActor).toEqual({});
      expect(summary.byTransition).toEqual({});
      expect(summary.recentActivity).toEqual([]);
    });
  });

  describe('getEventCount', () => {
    it('delegates to store', async () => {
      vi.mocked(store.getEventCount).mockResolvedValue(42);

      const count = await service.getEventCount();
      expect(count).toBe(42);
    });
  });

  describe('dispose', () => {
    it('unsubscribes from event bus', () => {
      service.dispose();

      // Emit after dispose — should not persist
      eventBus.emit(makeTransitionEvent());
      expect(store.appendEvent).not.toHaveBeenCalled();
    });
  });
});
