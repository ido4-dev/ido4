/**
 * InMemoryEventBus — Synchronous, error-safe event bus implementation.
 *
 * Design decisions:
 * - Synchronous dispatch: correct for Phase 1-2 (single-process MCP server)
 * - Errors in handlers are caught and forwarded to `onError` callback — never break the emitter
 * - Supports wildcard '*' subscriptions
 * - Per-container lifecycle: `removeAllListeners()` for cleanup
 */

import type { DomainEvent, DomainEventType } from './types.js';
import type { IEventBus, EventHandler, Unsubscribe } from './event-bus.js';

export interface InMemoryEventBusOptions {
  /** Called when a handler throws — prevents error swallowing */
  onError?: (error: unknown, event: DomainEvent) => void;
}

export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly onError: (error: unknown, event: DomainEvent) => void;

  constructor(options?: InMemoryEventBusOptions) {
    this.onError = options?.onError ?? (() => {});
  }

  on<T extends DomainEvent>(type: DomainEventType | '*', handler: EventHandler<T>): Unsubscribe {
    let handlersForType = this.handlers.get(type);
    if (!handlersForType) {
      handlersForType = new Set();
      this.handlers.set(type, handlersForType);
    }

    const genericHandler = handler as EventHandler;
    handlersForType.add(genericHandler);

    return () => {
      handlersForType.delete(genericHandler);
      if (handlersForType.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  emit(event: DomainEvent): void {
    // Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        this.safeCall(handler, event);
      }
    }

    // Dispatch to wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        this.safeCall(handler, event);
      }
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  private safeCall(handler: EventHandler, event: DomainEvent): void {
    try {
      handler(event);
    } catch (error) {
      this.onError(error, event);
    }
  }
}
