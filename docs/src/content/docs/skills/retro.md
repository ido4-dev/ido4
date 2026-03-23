---
title: "Retrospective Skills"
---

ido4 provides methodology-specific retrospective skills that analyze completed execution containers using real governance data.

| Skill | Methodology | What It Analyzes |
|---|---|---|
| `/ido4dev:retro` | Hydro (alias) | Completed wave |
| `/ido4dev:retro-wave` | Hydro | Wave delivery, epic integrity, velocity |
| `/ido4dev:retro-sprint` | Scrum | Sprint delivery, type distribution, DoR/DoD compliance |
| `/ido4dev:retro-cycle` | Shape Up | Cycle delivery, bet outcomes, circuit breaker analysis |

## How Retros Work

All retrospective skills follow the same pattern:

1. Call composite data tools to gather governance data
2. Compute real metrics from the audit trail (not estimates)
3. Analyze patterns — what went well, what didn't, what to change
4. Persist findings to memory for future reference
5. Present a structured retrospective report

Every claim is backed by data. If the retro says "velocity improved by 15%", it's because the audit trail shows 15% more tasks completed per unit time.

## /ido4dev:retro-wave (Hydro)

```
/ido4dev:retro
/ido4dev:retro wave-001-foundation
```

Defaults to the most recently completed wave. Analyzes:

- **Delivery**: Real throughput (tasks/day), cycle time distribution
- **Epic Integrity**: Were epics kept cohesive? Any split-epic incidents?
- **Blocking Time**: Measured duration tasks spent blocked, root cause analysis
- **Actor Patterns**: Who did what (agent-alpha did 60% of transitions)
- **Governance Quality**: Compliance score for the wave period
- **Dependency Health**: Blocking chains, satisfaction timing
- **Velocity Trend**: Compared to previous waves

### Output

```
RETROSPECTIVE -- wave-001-foundation (COMPLETED)

DELIVERY:
  Throughput: 1.4 tasks/day (5 tasks in 3.5 days)
  Cycle time: mean 2.3d, median 1.8d, p95 4.1d

OUTLIER: #3 (Config management) took 4.1 days -- dependency on
  #1 wasn't declared, causing a 2-day delay mid-implementation

BLOCKING: 1.2 days total blocking time
  #4 blocked 0.8 days (waiting on external API access)

ACTOR ANALYSIS:
  agent-alpha: 9 transitions (60%) -- primary executor
  agent-beta: 4 transitions (27%) -- review-focused
  human:bogdan: 2 transitions (13%) -- approvals only

GOVERNANCE: 95/A for wave-001 period
  All transitions followed proper workflow
  Zero overrides used

RECOMMENDATIONS:
  1. Declare dependencies during refinement
  2. Establish SLA for external access requests
```

### Key Principle

Every recommendation is data-backed with a specific action:

- **Not**: "We should communicate better"
- **Instead**: "Task #38 was blocked for 4.2 days waiting on API spec from #35. Enforce refinement step requiring API contracts before tasks enter Ready for Dev."

## /ido4dev:retro-sprint (Scrum)

```
/ido4dev:retro-sprint
/ido4dev:retro-sprint "Sprint 14"
```

Scrum-specific analysis:

- **Sprint Goal Achievement**: Was the sprint goal met?
- **Spillover**: Items carried over from previous sprint — how much, why
- **Type Distribution**: Story vs Bug vs Spike vs Tech Debt ratio
- **DoR Compliance**: Items entering sprint without full Definition of Ready
- **DoD Compliance**: Items approved without full Definition of Done (per type)
- **Velocity**: Story points delivered vs committed
- **Pipeline Effectiveness**: Did type-scoped pipelines catch quality issues?

## /ido4dev:retro-cycle (Shape Up)

```
/ido4dev:retro-cycle
/ido4dev:retro-cycle cycle-001-notifications
```

Shape Up-specific analysis:

- **Bet Outcomes**: Which bets shipped, which were killed, why
- **Circuit Breaker**: Was it triggered? Should it have been triggered earlier?
- **Appetite Accuracy**: Did bets fit within their appetite? Scope creep detected?
- **Scope Changes**: Tasks added mid-cycle outside original pitch
- **Hill Chart Review**: Where bets stalled (uphill unknowns vs downhill execution)
- **Cooldown Assessment**: What's shaped and ready for the next betting table

## Memory Persistence

All retro skills persist findings to memory in structured blocks:

```
--- FINDINGS ---
wave-001: throughput=1.4/day, cycle=2.3d mean, compliance=95/A
pattern: undeclared dependency caused 2-day delay
baseline: 1.4 tasks/day is the velocity reference for wave-002
--- /FINDINGS ---
```

These findings create a velocity baseline that future planning and standup skills reference for capacity estimation and trend detection.
