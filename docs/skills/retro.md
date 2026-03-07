# /retro

**Wave retrospective** — data-backed analysis with real metrics, audit trail evidence, and actionable insights.

## Invocation

```
/ido4:retro
/ido4:retro wave-001-foundation
```

Defaults to the most recently completed wave.

## What It Does

The retro skill analyzes a completed wave using real data from the audit trail and analytics services — not team feelings or subjective assessments:

1. **Delivery analysis** — Real throughput (tasks/day), not task counting
2. **Cycle time trends** — Which tasks took longest and why
3. **Blocking time** — Measured duration tasks spent blocked
4. **Actor patterns** — Who did what (agent-alpha did 60% of transitions)
5. **Governance quality** — Compliance score for the wave period
6. **Blocker analysis** — Recurring blockers, root causes
7. **Epic progress** — Which epics advanced, which stalled

## Key Principle

Every recommendation is data-backed with a specific action:

- **Not**: "We should communicate better"
- **Instead**: "Task #38 was blocked for 4.2 days waiting on API spec from #35. Enforce refinement step requiring API contracts before tasks enter Ready for Dev."

## Output Format

```
RETROSPECTIVE — wave-001-foundation (COMPLETED)

DELIVERY:
  Throughput: 1.4 tasks/day (5 tasks in 3.5 days)
  Cycle time: mean 2.3d, median 1.8d, p95 4.1d

OUTLIER: #3 (Config management) took 4.1 days — dependency on
  #1 wasn't declared, causing a 2-day delay mid-implementation

BLOCKING: 1.2 days total blocking time
  #4 blocked 0.8 days (waiting on external API access)

ACTOR ANALYSIS:
  agent-alpha: 9 transitions (60%) — primary executor
  agent-beta: 4 transitions (27%) — review-focused
  human:bogdan: 2 transitions (13%) — approvals only

GOVERNANCE: 95/A for wave-001 period
  All transitions followed proper workflow
  Zero overrides used

RECOMMENDATIONS:
  1. Declare dependencies during refinement — the #3 delay was
     avoidable with upfront dependency analysis
  2. Establish SLA for external access requests — #4's block
     was outside team control but trackable

--- FINDINGS ---
wave-001: throughput=1.4/day, cycle=2.3d mean, compliance=95/A
pattern: undeclared dependency caused 2-day delay
baseline: 1.4 tasks/day is the velocity reference for wave-002
```

## Memory Persistence

Retro findings are persisted to `MEMORY.md` in a structured block. This creates a velocity baseline that future plan-wave and standup skills reference for capacity estimation and trend detection.
