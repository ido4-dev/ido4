import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import type { TaskTransitionEvent, ContainerAssignmentEvent, DomainEvent } from '../../../src/shared/events/types.js';

function createTransitionEvent(overrides: Partial<TaskTransitionEvent> = {}): TaskTransitionEvent {
  return {
    type: 'task.transition',
    timestamp: new Date().toISOString(),
    sessionId: 'session-1',
    actor: { type: 'ai-agent', id: 'agent-1', name: 'Claude' },
    issueNumber: 42,
    fromStatus: 'Ready for Dev',
    toStatus: 'In Progress',
    transition: 'start',
    dryRun: false,
    ...overrides,
  };
}

function createContainerEvent(overrides: Partial<ContainerAssignmentEvent> = {}): ContainerAssignmentEvent {
  return {
    type: 'container.assignment',
    timestamp: new Date().toISOString(),
    sessionId: 'session-1',
    actor: { type: 'human', id: 'jdoe' },
    issueNumber: 42,
    containerName: 'wave-001',
    integrityMaintained: true,
    ...overrides,
  };
}

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it('dispatches events to type-specific handlers', () => {
    const handler = vi.fn();
    bus.on('task.transition', handler);

    const event = createTransitionEvent();
    bus.emit(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not dispatch to wrong type handlers', () => {
    const transitionHandler = vi.fn();
    const containerHandler = vi.fn();

    bus.on('task.transition', transitionHandler);
    bus.on('container.assignment', containerHandler);

    bus.emit(createTransitionEvent());

    expect(transitionHandler).toHaveBeenCalledOnce();
    expect(containerHandler).not.toHaveBeenCalled();
  });

  it('dispatches to wildcard handlers for all events', () => {
    const handler = vi.fn();
    bus.on('*', handler);

    bus.emit(createTransitionEvent());
    bus.emit(createContainerEvent());

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('dispatches to both type-specific and wildcard handlers', () => {
    const specificHandler = vi.fn();
    const wildcardHandler = vi.fn();

    bus.on('task.transition', specificHandler);
    bus.on('*', wildcardHandler);

    bus.emit(createTransitionEvent());

    expect(specificHandler).toHaveBeenCalledOnce();
    expect(wildcardHandler).toHaveBeenCalledOnce();
  });

  it('supports multiple handlers for the same type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('task.transition', handler1);
    bus.on('task.transition', handler2);

    bus.emit(createTransitionEvent());

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('unsubscribe removes the handler', () => {
    const handler = vi.fn();
    const unsubscribe = bus.on('task.transition', handler);

    bus.emit(createTransitionEvent());
    expect(handler).toHaveBeenCalledOnce();

    unsubscribe();

    bus.emit(createTransitionEvent());
    expect(handler).toHaveBeenCalledOnce(); // Still 1, not 2
  });

  it('removeAllListeners clears all handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('task.transition', handler1);
    bus.on('*', handler2);

    bus.removeAllListeners();

    bus.emit(createTransitionEvent());

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('catches handler errors and calls onError', () => {
    const onError = vi.fn();
    const errorBus = new InMemoryEventBus({ onError });

    const error = new Error('handler boom');
    errorBus.on('task.transition', () => { throw error; });

    const event = createTransitionEvent();
    errorBus.emit(event);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error, event);
  });

  it('continues dispatching after a handler error', () => {
    const onError = vi.fn();
    const errorBus = new InMemoryEventBus({ onError });

    const handler1 = vi.fn(() => { throw new Error('boom'); });
    const handler2 = vi.fn();

    errorBus.on('task.transition', handler1);
    errorBus.on('task.transition', handler2);

    errorBus.emit(createTransitionEvent());

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('silently swallows errors when no onError provided', () => {
    bus.on('task.transition', () => { throw new Error('no crash'); });

    // Should not throw
    expect(() => bus.emit(createTransitionEvent())).not.toThrow();
  });

  it('handles emit with no subscribers gracefully', () => {
    expect(() => bus.emit(createTransitionEvent())).not.toThrow();
  });

  it('preserves event immutability across handlers', () => {
    const events: DomainEvent[] = [];
    bus.on('task.transition', (e) => events.push(e));
    bus.on('*', (e) => events.push(e));

    const event = createTransitionEvent();
    bus.emit(event);

    expect(events[0]).toBe(event);
    expect(events[1]).toBe(event);
  });
});
