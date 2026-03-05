/**
 * IEventBus — Per-container event bus interface (ADR-12).
 *
 * Design decisions:
 * - `on()` returns an unsubscribe function (not `off()` with handler reference)
 * - Per-container, not global singleton — supports multi-session/multi-agent
 * - Interface does not prescribe sync/async — implementations choose
 * - Wildcard '*' subscribes to all event types
 */

import type { DomainEvent, DomainEventType } from './types.js';

/** Handler function for domain events */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void;

/** Unsubscribe function returned by `on()` */
export type Unsubscribe = () => void;

export interface IEventBus {
  /**
   * Subscribe to events of a specific type, or '*' for all events.
   * Returns an unsubscribe function.
   */
  on<T extends DomainEvent>(type: DomainEventType | '*', handler: EventHandler<T>): Unsubscribe;

  /** Emit an event to all matching subscribers */
  emit(event: DomainEvent): void;

  /** Remove all subscribers (cleanup on container disposal) */
  removeAllListeners(): void;
}
