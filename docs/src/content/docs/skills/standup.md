---
title: "/standup"
---

**Governance-aware morning briefing** that detects risks, surfaces leverage points, and recommends the highest-impact action for the day.

## Invocation

```
/ido4dev:standup
```

## What It Does

The standup skill gathers comprehensive governance data in a single composite call (`get_standup_data`), then analyzes it for patterns and anomalies:

1. **Container status** — Active container progress (wave/sprint/cycle), task distribution by status
2. **Blocker analysis** — Blocked tasks with cascade depth and dependency trees
3. **Review bottlenecks** — In Review tasks with PR status and review counts
4. **Temporal patterns** — Audit trail analysis for stale work, velocity trends
5. **Cycle time outliers** — Tasks exceeding expected completion time
6. **Agent load** — Who's working on what, idle agents, lock contention
7. **Compliance snapshot** — Current score and grade

## Output Format

Findings are grouped by urgency:

- **Needs Attention** — Blockers, stale reviews, governance violations
- **In Progress** — Active work with any concerns
- **Ready to Start** — Available tasks with scoring context

Ends with a single **highest-leverage recommendation** — the one action that creates the most downstream value.

## Example

```
STANDUP — wave-002-core (20% complete, 8 remaining)

NEEDS ATTENTION:
  #267 ETL transformations — In Progress 4 days (XL effort, HIGH risk)
    Cascade: blocks #268 → #269 (30% of wave)
  #270 Auth token service — FALSE STATUS: "In Review" with no PR
  #272 Session management — PR #281 open 4 days, 0 reviews

IN PROGRESS:
  #267 ETL transformations — agent-alpha (locked 4d)

READY TO START:
  #273 Data export (score:50) — highest cascade + freshness
  #271 OAuth integration (score:13) — matches agent-beta capabilities

COMPLIANCE: 92/A

RECOMMENDATION: Unblock the #267 cascade. agent-alpha has been on
ETL for 4 days — check if it needs to be decomposed or if there's
a specific blocker. This single action unblocks 30% of the wave.
```

## Data Sources

| Data | Tool |
|---|---|
| Container tasks and metrics | Container status tool (e.g., `get_wave_status`) |
| PR status for In Review tasks | `find_task_pr` per task |
| Dependency chains for blocked tasks | `analyze_dependencies` per blocker |
| Last 24h governance activity | `query_audit_trail` |
| Velocity and cycle time | `get_analytics` |
| Agent status and locks | `list_agents` |
| Compliance score | `compute_compliance_score` |

All gathered via `get_standup_data` in a single composite call.
