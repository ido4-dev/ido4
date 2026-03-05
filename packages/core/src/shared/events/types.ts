/**
 * Governance Event Types — Typed domain events for the ido4 event system.
 *
 * Every governance action (transition, wave assignment, validation) produces
 * a typed event. CI/CD gates, audit persistence, compliance dashboards,
 * and cross-agent coordination subscribe to these events.
 *
 * Events carry `sessionId` and `actor` for cross-session correlation.
 */

import type { ActorIdentity } from '../logger.js';
import type { AuditValidationResult } from '../../container/interfaces.js';

/** Base shape for all governance events */
export interface GovernanceEvent {
  /** Discriminator for type-safe handler dispatch */
  readonly type: string;
  /** ISO-8601 timestamp */
  readonly timestamp: string;
  /** Session that produced this event — correlates with ServiceContainer.sessionId */
  readonly sessionId: string;
  /** Actor who triggered the event */
  readonly actor: ActorIdentity;
}

/** Emitted when a task transitions between workflow states */
export interface TaskTransitionEvent extends GovernanceEvent {
  readonly type: 'task.transition';
  readonly issueNumber: number;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly transition: string;
  readonly validationResult?: AuditValidationResult;
  readonly dryRun: boolean;
}

/** Emitted when a task is assigned to a wave */
export interface WaveAssignmentEvent extends GovernanceEvent {
  readonly type: 'wave.assignment';
  readonly issueNumber: number;
  readonly waveName: string;
  readonly previousWave?: string;
  readonly epicIntegrityMaintained: boolean;
}

/** Emitted when a validation pipeline completes */
export interface ValidationEvent extends GovernanceEvent {
  readonly type: 'validation.completed';
  readonly issueNumber: number;
  readonly transition: string;
  readonly result: AuditValidationResult;
  readonly passed: boolean;
}

/** Union of all domain events — use for exhaustive handling */
export type DomainEvent =
  | TaskTransitionEvent
  | WaveAssignmentEvent
  | ValidationEvent;

/** Extract event type strings for type-safe subscriptions */
export type DomainEventType = DomainEvent['type'];
