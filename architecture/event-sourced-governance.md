# Event-Sourced Governance — Audit Trail as Single Source of Truth

## The Design Decision

ido4 uses event sourcing for governance data. The audit trail (append-only JSONL) is the **single source of truth** for all governance intelligence. AnalyticsService and ComplianceService do not maintain their own storage — they derive all metrics by replaying audit events.

This means:
- Zero data synchronization between services
- No consistency bugs between "what happened" and "what metrics say happened"
- Any new governance intelligence service can be added by replaying the same log
- The audit trail is the complete, immutable history of everything the governance engine has done

## Architecture

```
EventBus (in-memory pub/sub)
    │
    │  on('*')                on('*')                on('*')
    │
    ▼
AuditService              AnalyticsService       ComplianceService
    │                         │                       │
    ├── Ring buffer (500)     ├── Queries audit       ├── Queries audit
    │   (fast session reads)  │   via IAuditService    │   via IAuditService
    │                         │                       │
    └── IAuditStore (JSONL)   └── Cache (30s TTL)     └── Cache (30s TTL)
        (persistent)              Invalidated on       Invalidated on
                                  any new event        any new event
```

### How It Works

1. **Every domain operation emits an event** via the EventBus — task transitions, container assignments, work recommendations, task handoffs. Dry-run operations are excluded.

2. **AuditService subscribes to all events** (`eventBus.on('*')`), serializes them, and persists to an append-only JSONL file via `IAuditStore`. It also maintains an in-memory ring buffer (default 500 events) for fast session queries.

3. **AnalyticsService queries AuditService** to compute metrics. It builds per-task timelines from `task.transition` events, then computes cycle time, lead time, throughput, and blocking time. It uses the profile to derive semantic meaning — which transitions start the clock (active states), which stop it (closing transitions), which represent blocking.

4. **ComplianceService queries AuditService** to compute governance scores. It reads transition events to compute BRE pass rate, quality gate satisfaction, process adherence (lifecycle step coverage), container integrity, and flow efficiency. Flow efficiency additionally queries AnalyticsService for per-task blocking time.

5. **Cache invalidation is event-driven.** Both AnalyticsService and ComplianceService subscribe to `EventBus('*')` and `cache.clear()` on any new event. This ensures stale metrics are never served — the next query replays the updated audit trail.

## Why Not Separate Storage?

The alternative is each service maintaining its own materialized views (a separate analytics database, a compliance score table, etc.). This creates:

- **Synchronization complexity**: What if the analytics DB misses an event? What if compliance scores diverge from audit reality?
- **Schema evolution burden**: Adding a new metric requires migrating two stores instead of writing a new replay query.
- **Testing complexity**: Must verify both that events are emitted correctly AND that materialized views are updated correctly.

With event sourcing, correctness is reduced to one question: "Are events emitted and persisted correctly?" If yes, all derived data is correct by construction.

## Trade-offs

**Cost of replay:** Every analytics or compliance query replays events from the audit store. For small-to-medium projects (hundreds of tasks, thousands of events), this is fast — sub-second. For very large projects, the 30-second cache TTL amortizes replay cost. If this becomes a bottleneck, materialized views can be added as a performance optimization *without changing the architecture* — the audit trail remains the source of truth, views are just caches.

**Ring buffer for hot path:** The most common query pattern is "recent events for standup/board." The ring buffer (in-memory, 500 events) serves these without touching the file store.

**Fire-and-forget persistence:** AuditService persists events asynchronously (`store.appendEvent().catch(...)`) to avoid blocking domain operations. An event that fails to persist is logged but does not break the operation. This accepts a small risk of event loss during crashes in exchange for zero-latency governance operations.

## Event Types

Five domain event types flow through this architecture:

| Event | Emitted By | Key Data |
|---|---|---|
| `task.transition` | TaskService | issueNumber, transition, actor, validationResult, dryRun |
| `container.assignment` | ContainerService | issueNumber, containerName, integrityMaintained, actor |
| `work.recommendation` | WorkDistributionService | agentId, recommendedIssue, score, containerName |
| `work.handoff` | WorkDistributionService | agentId, completedIssue, newlyUnblocked, nextRecommendation |
| `validation` | TaskTransitionValidator | issueNumber, transition, passed, failedSteps |

All events carry: `type`, `timestamp`, `sessionId`, `actor` (identity of who/what triggered it).

## How Services Use the Audit Trail

### AnalyticsService

Builds per-task timelines from chronologically ordered `task.transition` events:
- **Cycle time**: First transition into an active state → closing transition
- **Lead time**: First non-backlog transition → closing transition
- **Blocking time**: Sum of (unblock timestamp - block timestamp) intervals
- **Throughput**: Completed tasks / time span (tasks/day)
- **Velocity**: Count of completed tasks per container

Active states, closing transitions, and block/unblock actions are all derived from the methodology profile — not hardcoded. This makes analytics methodology-agnostic.

### ComplianceService

Computes a weighted 0-100 score across 5 categories:

| Category | What It Measures | Source |
|---|---|---|
| BRE Pass Rate | % of transitions where all validation steps passed | `validationResult` in transition events |
| Quality Gates | % of closing transitions where PR/test/security steps passed | Quality gate step results in transition events |
| Process Adherence | % of lifecycle steps followed per completed task | Transition history vs. profile's `compliance.lifecycle` |
| Container Integrity | % of container assignments that maintained integrity rules | `integrityMaintained` in assignment events |
| Flow Efficiency | Ratio of active time to total cycle time (excl. blocking) | Computed via AnalyticsService (which itself replays audit) |

Weights are profile-driven (`profile.compliance.weights`). Different methodologies can emphasize different categories.

## Implications for Future Architecture

This pattern directly enables the **governance maturity levels** described in the ideas backlog:

- **Level 2 (context-aware)**: The audit trail contains the full context needed for conditional governance — "how many tasks remain in this wave?" is a replay query.
- **Level 3 (recommending)**: Pattern detection over accumulated events is a replay query with thresholds. "Coverage gate bypassed 40% of tasks" = count events where quality gate steps failed.
- **Level 4 (self-adapting)**: Adaptations are themselves events. The audit trail records both what happened and what the system did about it.

## Key Source Files

- AuditService: `packages/core/src/domains/audit/audit-service.ts`
- AuditStore (JSONL): `packages/core/src/domains/audit/audit-store.ts`
- AnalyticsService: `packages/core/src/domains/analytics/analytics-service.ts`
- ComplianceService: `packages/core/src/domains/compliance/compliance-service.ts`
- Event types: `packages/core/src/shared/events/types.ts`
- EventBus: `packages/core/src/shared/events/in-memory-event-bus.ts`
