# Audit Trail & Compliance

Every governance action in ido4 creates an immutable audit entry. This isn't optional logging — it's the foundation for compliance scoring, real analytics, and enterprise reporting.

## Audit Trail

### Event Sourcing

The audit trail is event-sourced: every state transition produces a `TaskTransitionEvent` that is persisted to an append-only JSONL file (`.ido4/audit-log.jsonl`) and held in an in-memory ring buffer (500 events) for fast session queries.

```json
{
  "type": "task.transition",
  "timestamp": "2026-03-07T14:22:33.000Z",
  "sessionId": "session-abc123",
  "actor": { "type": "agent", "id": "agent-alpha", "name": "Alpha" },
  "issueNumber": 42,
  "fromStatus": "READY_FOR_DEV",
  "toStatus": "IN_PROGRESS",
  "transition": "start",
  "dryRun": false
}
```

### What Gets Recorded

| Event Type | When | Data |
|---|---|---|
| `task.transition` | Any status change | From/to status, transition type, actor, validation results |
| `task.recommendation` | `get_next_task` | Recommended task, score breakdown, agent ID |
| `task.handoff` | `complete_and_handoff` | Completed task, unblocked tasks, next recommendation |
| `governance.override` | `check_merge_readiness` with override | Override reason, who authorized it |

### Querying the Audit Trail

```
query_audit_trail(
  since: "2026-03-06T00:00:00Z",
  transition: "approve",
  actorId: "agent-alpha"
)
→ All approval transitions by agent-alpha in the last day
```

Filter by: time range, actor, transition type, issue number, session ID, event type.

### What Doesn't Get Recorded

- **Dry runs** — Validation-only calls leave no trace
- **Read operations** — `list_tasks`, `get_wave_status`, etc. are silent
- **Failed writes** — If the BRE blocks a transition, no audit event is created (the block itself is visible in compliance metrics)

## Compliance Scoring

The `compute_compliance_score` tool produces a deterministic 0-100 score across 5 weighted categories:

### Categories

| Category | Weight | What It Measures |
|---|---|---|
| **BRE Pass Rate** | 40% | Percentage of transitions that passed BRE validation without overrides |
| **Quality Gate Satisfaction** | 20% | PR reviews completed, test coverage met, security scans clean |
| **Process Adherence** | 20% | Tasks following the full workflow (start → review → approve) vs shortcuts |
| **Container Integrity** | 10% | Grouping containers maintaining execution container cohesion (Hydro: 10%, Shape Up: 10%, Scrum: N/A — redistributed to other categories) |
| **Flow Efficiency** | 10% | Ratio of active work time vs blocked/waiting time |

### Letter Grades

| Score | Grade | Meaning |
|---|---|---|
| 90-100 | A | Excellent compliance |
| 80-89 | B | Good compliance with minor gaps |
| 70-79 | C | Acceptable — some process shortcuts detected |
| 60-69 | D | Concerning — significant governance gaps |
| 0-59 | F | Failing — methodology not being followed |

### Per-Category Breakdown

```
compute_compliance_score()
→ {
    score: 92,
    grade: "A",
    categories: {
      brePassRate: { score: 95, weight: 40, contribution: 38 },
      qualityGates: { score: 88, weight: 20, contribution: 17.6 },
      processAdherence: { score: 90, weight: 20, contribution: 18 },
      epicIntegrity: { score: 100, weight: 10, contribution: 10 },
      flowEfficiency: { score: 84, weight: 10, contribution: 8.4 }
    },
    recommendations: [
      "Review PR turnaround time — 2 PRs waited >3 days for review"
    ]
  }
```

## Real Analytics

Analytics are computed from the audit trail — no separate data store, no manual tracking:

| Metric | Definition |
|---|---|
| **Cycle time** | Duration from `start` to `approve` for a task |
| **Lead time** | Duration from first non-backlog status to `approve` |
| **Throughput** | Tasks completed per day (from `approve` events) |
| **Blocking time** | Duration between `block` and `unblock` events |
| **Container velocity** | Tasks completed per execution container (wave/sprint/cycle) |

```
get_analytics(waveName: "wave-002-core")  // or sprintName, cycleName
→ {
    cycleTime: { mean: 2.3, median: 1.8, p95: 5.1 },  // days
    throughput: { tasksPerDay: 1.4 },
    blockingTime: { totalDays: 4.2, avgPerTask: 1.4 }
  }
```

## Enterprise Reporting

The compliance score, audit trail, and analytics together provide everything an enterprise client needs:

1. **Compliance report** — `/ido4:compliance` produces a three-part assessment: quantitative score, structural principle audit, and cross-referenced synthesis
2. **Audit evidence** — Every transition with actor, timestamp, and validation results
3. **Velocity metrics** — Real data showing delivery pace and trends
4. **Risk indicators** — Blocking patterns, stale reviews, process shortcuts

Every claim is backed by data. Every metric is derived from actual events. Nothing is estimated or hardcoded.
