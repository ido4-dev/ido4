# /board

**Flow intelligence report** that surfaces blockers, cascade risks, false statuses, and epic cohesion with a compact task reference.

## Invocation

```
/ido4:board
/ido4:board wave-002-core
```

## What It Does

The board skill analyzes whether work is actually flowing — not just what status tasks are in, but whether those statuses are truthful and whether movement is happening:

1. **Blocked cascades** — Tasks blocking multiple downstream tasks
2. **False statuses** — Tasks in "In Review" with no PR
3. **Review bottlenecks** — PRs with zero reviews for days
4. **Epic fragmentation** — Epics split across waves
5. **Cycle time outliers** — Tasks exceeding expected duration
6. **Agent coordination** — Lock contention, idle agents

## Output Format

The board outputs a **critical finding headline** plus a **compact task reference table** — not a kanban board. The table includes annotations for cycle time, agent locks, and cascade depth.

```
BOARD — wave-002-core

CRITICAL: 50% of remaining work is blocked or stalled

┌────────┬──────────────────────┬─────────────┬─────────────────────┐
│   #    │        Title         │   Status    │    Annotations      │
├────────┼──────────────────────┼─────────────┼─────────────────────┤
│ #267   │ ETL transformations  │ In Progress │ 4d, agent-alpha, ⚡3 │
│ #268   │ Data validation      │ Blocked     │ ← #267              │
│ #269   │ API rate limiting    │ Blocked     │ ← #268 ← #267       │
│ #270   │ Auth token service   │ In Review   │ ⚠ NO PR             │
│ #271   │ OAuth integration    │ Ready       │                     │
│ #272   │ Session management   │ In Review   │ PR#281, 0 reviews   │
│ #273   │ Data export service  │ Ready       │ score:50 🎯         │
│ #274   │ Batch processing     │ Refinement  │                     │
└────────┴──────────────────────┴─────────────┴─────────────────────┘

Legend: ⚡N = cascade depth, ⚠ = governance violation, 🎯 = top recommendation

FLOW DIAGNOSIS: The #267 cascade is the primary bottleneck.
Agent-alpha has been on this task for 4 days. Two options:
1. Decompose #267 into smaller tasks if it's too large
2. Assign a second agent to pair on it
```

## Anti-Pattern

The board skill **never renders a kanban board**. Kanban boards show status distribution but miss flow issues. The task reference table with annotations is more information-dense and actionable.
