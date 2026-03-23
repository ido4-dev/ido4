# Audit Trail

Every governance action in ido4 creates an immutable audit entry. The audit trail is the substrate for institutional memory — it powers compliance scoring, real analytics, context assembly, and enterprise reporting. It's how the system remembers what happened across sessions, agents, and time.

## Architecture

### Storage

- **Primary**: Append-only JSONL file at `.ido4/audit-log.jsonl`
- **Fast access**: In-memory ring buffer (500 most recent events)
- **Persistence**: Fire-and-forget write — audit failures are logged but never block transitions

### Event Flow

```
TaskService.startTask()
  → emits TaskTransitionEvent on EventBus
    → AuditService (subscribed to *) receives event
      → Appends to ring buffer (in-memory)
      → Appends to .ido4/audit-log.jsonl (file)
```

## Event Types

### task.transition

Recorded on every task state change:

```json
{
  "type": "task.transition",
  "timestamp": "2026-03-07T14:22:33.000Z",
  "sessionId": "session-abc123",
  "actor": {
    "type": "agent",
    "id": "agent-alpha",
    "name": "Alpha"
  },
  "issueNumber": 42,
  "fromStatus": "READY_FOR_DEV",
  "toStatus": "IN_PROGRESS",
  "transition": "start",
  "dryRun": false
}
```

### task.recommendation

Recorded when `get_next_task` produces a recommendation:

```json
{
  "type": "task.recommendation",
  "timestamp": "2026-03-07T14:25:00.000Z",
  "agentId": "agent-alpha",
  "recommendedTask": 273,
  "score": 50,
  "activeWave": "wave-002-core",
  "candidateCount": 3
}
```

### task.handoff

Recorded when `complete_and_handoff` executes:

```json
{
  "type": "task.handoff",
  "timestamp": "2026-03-07T15:00:00.000Z",
  "agentId": "agent-alpha",
  "completedTask": 267,
  "newlyUnblocked": [268, 269],
  "nextRecommendation": 273
}
```

## Querying

### By Time Range

```
query_audit_trail(since: "2026-03-06T00:00:00Z", until: "2026-03-07T00:00:00Z")
→ All events from yesterday
```

### By Actor

```
query_audit_trail(actorId: "agent-alpha")
→ Everything agent-alpha has done
```

### By Transition Type

```
query_audit_trail(transition: "approve")
→ All task approvals
```

### By Issue

```
query_audit_trail(issueNumber: 42)
→ Complete history of task #42
```

### Combined Filters

```
query_audit_trail(
  since: "2026-03-01T00:00:00Z",
  transition: "block",
  actorId: "agent-beta",
  limit: 10
)
→ Last 10 times agent-beta blocked a task this month
```

## Summary View

```
get_audit_summary(since: "2026-03-01T00:00:00Z")
→ {
    totalEvents: 47,
    byType: { "task.transition": 38, "task.recommendation": 7, "task.handoff": 2 },
    byTransition: { "start": 12, "review": 8, "approve": 7, "block": 5, ... },
    byActor: { "agent-alpha": 22, "agent-beta": 15, "human:bogdan": 10 },
    recentActivity: [ ... last 5 events ... ]
  }
```

## What's NOT Recorded

- **Dry runs** — `dryRun: true` events are skipped (no audit noise)
- **Read operations** — Queries and status checks leave no trace
- **Failed BRE checks** — The transition didn't happen, so no transition event (visible in compliance metrics as pass/fail ratios)

## Analytics Derived from Audit

The `AnalyticsService` computes real metrics from audit events:

| Metric | How It's Computed |
|---|---|
| Cycle time | Time between `start` and `approve` events for same issue |
| Lead time | Time between first non-backlog event and `approve` |
| Throughput | Count of `approve` events per day |
| Blocking time | Duration between `block` and `unblock` events |

These are real measurements, not estimates. If the audit trail shows a task was blocked for 3.2 days, that's exactly how long it was blocked.
