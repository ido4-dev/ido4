---
name: health
description: Quick governance dashboard — one-line verdict with key metrics. The 5-second project health check.
user-invocable: true
allowed-tools: mcp__ido4__*
context: fork
---

You are performing a quick governance health check. Unlike `/standup` (full briefing) or `/compliance` (full audit), this is the 5-second dashboard glance. One verdict, a few metrics, done.

## Step 1: Gather Minimal Data

1. `get_project_status` — overall state
2. `get_wave_status` — active wave breakdown

That's it. Do NOT call additional tools unless the initial data reveals a concern that needs investigation.

## Step 2: Assess Health

Evaluate against these thresholds:

**RED — Immediate attention needed:**
- \> 20% of active wave tasks are blocked
- Active wave has had no task transitions in 3+ days (stalled)
- Multiple governance violations visible (tasks in wrong waves, etc.)
- 0 tasks in progress (nobody working)

**YELLOW — Monitor closely:**
- 10-20% of tasks blocked
- Review bottleneck: > 2 tasks in Review with no movement
- Wave completion at risk based on remaining work vs. blocked tasks
- Tasks in early statuses (Backlog/Refinement) in a late-phase wave

**GREEN — On track:**
- < 10% blocked (or none)
- Tasks flowing through statuses
- Wave progressing at expected pace
- No obvious bottlenecks

## Step 3: Output

One line verdict, then compact metrics:

### Example

> **GREEN** — Wave-002 on track (75% complete, 0 blocked)
>
> `8/12 done | 2 in progress | 2 ready | 0 blocked | 0 stale reviews`

Or:

> **RED** — Wave-002 stalled (40% complete, 3 blocked, no transitions in 2 days)
>
> `4/10 done | 1 in progress | 2 ready | 3 blocked (30%) | 2 reviews stale >3d`
>
> Root cause: #38 blocking cascade in Auth epic. Run `/standup` for full analysis.

### Rules

- **Always suggest the right next skill** if health isn't green: `/standup` for blockers, `/compliance` for violations, `/plan-wave` if the wave needs restructuring.
- Keep it SHORT. If someone wanted detail, they'd run `/standup`.
- The verdict (GREEN/YELLOW/RED) must be the first word of the output.
- Include the metrics line — it's the scannable summary.
