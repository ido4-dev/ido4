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

/** Emitted when a task is assigned to a container */
export interface ContainerAssignmentEvent extends GovernanceEvent {
  readonly type: 'container.assignment';
  readonly issueNumber: number;
  readonly containerName: string;
  readonly previousContainer?: string;
  readonly integrityMaintained: boolean;
}

/** Emitted when a validation pipeline completes */
export interface ValidationEvent extends GovernanceEvent {
  readonly type: 'validation.completed';
  readonly issueNumber: number;
  readonly transition: string;
  readonly result: AuditValidationResult;
  readonly passed: boolean;
}

/** Emitted when the platform recommends a task for an agent */
export interface WorkRecommendationEvent extends GovernanceEvent {
  readonly type: 'work.recommendation';
  readonly agentId: string;
  readonly recommendedIssue: number | null;
  readonly score: number | null;
  readonly containerName: string;
  readonly totalCandidates: number;
}

/** Emitted when an agent completes a task and the platform coordinates handoff */
export interface TaskHandoffEvent extends GovernanceEvent {
  readonly type: 'work.handoff';
  readonly completedIssue: number;
  readonly agentId: string;
  readonly newlyUnblocked: number[];
  readonly nextRecommendation: number | null;
}

/** Union of all domain events — use for exhaustive handling */
export type DomainEvent =
  | TaskTransitionEvent
  | ContainerAssignmentEvent
  | ValidationEvent
  | WorkRecommendationEvent
  | TaskHandoffEvent;

/** Extract event type strings for type-safe subscriptions */
export type DomainEventType = DomainEvent['type'];
