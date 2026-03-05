---
name: retro
description: Wave retrospective — analyze a completed wave to extract actionable insights and persist findings for future governance
user-invocable: true
allowed-tools: mcp__ido4__*
---

You are conducting a wave retrospective. Your job is to extract actionable insights from the completed (or completing) wave that improve future wave planning and execution. Every recommendation must be grounded in data from this wave — no generic advice.

Use $ARGUMENTS as the wave name if provided. Otherwise, analyze the most recently completed wave.

## Step 0: Load Historical Context

Before analyzing this wave, check your auto-memory (MEMORY.md is automatically loaded at session start) for previous retrospective findings:

- **Previous wave metrics** — velocity, blocked counts, review turnaround from past waves. If they exist, you can compare and detect trends.
- **Known recurring patterns** — blockers, bottlenecks, process issues flagged before.

This context is essential for trend detection: "This is the third wave where review turnaround exceeded 2 days" is far more valuable than "review turnaround was slow this wave."

## Step 1: Gather Wave Data

1. `get_project_status` — overall context and wave history
2. `get_wave_status` for the target wave — task breakdown and completion data
3. `list_tasks` filtered to the target wave — full task details with statuses
4. `list_waves` — to compare with previous waves if they exist
5. For tasks that were In Review, call `find_task_pr` and `get_pr_reviews` to assess review turnaround

## Step 2: Analyze

### Delivery
- How many tasks were planned for this wave?
- How many were actually completed (Done status)?
- Were tasks added mid-wave? (Scope creep — compare initial vs. final task count if possible)
- Were tasks deferred out? Why?

### Flow
Where did tasks spend the most time? Which status was the bottleneck?
- Many tasks stuck In Review for long → review process constraint
- Many tasks blocked → external dependencies or poor dependency planning
- Tasks fly through early stages but stall later → late-stage process issue
- Tasks stuck in Refinement → specification quality issue

### Blockers
- How many tasks were blocked during this wave?
- What was the average block duration?
- What were the blocking reasons? Group by category: dependency, external system, missing info
- Pattern detection: same dependency blocking multiple tasks = systemic issue
- Cross-reference with previous retros: is this a recurring pattern or new?

### Velocity
- Tasks completed in this wave
- Compare to previous waves if data exists (from retro files or `list_waves`)
- Is velocity improving, declining, or stable?
- What might explain the trend?

### Epic Progress
- Which epics had tasks in this wave?
- Which epics are now fully complete?
- Which still have remaining work?
- Did any epic stall (tasks started but none completed)?

## Step 3: Formulate Recommendations

Based on DATA from this wave — not generic retrospective platitudes:

- If review turnaround was slow → "24-hour review SLA" or "pair review sessions"
- If blockers recurred on same dependency → "create a mock service" or "front-load dependency resolution"
- If scope changed mid-wave → "lock wave scope after activation" or "add 1-2 task buffer"
- If velocity dropped → investigate cause and recommend accordingly

Every recommendation must trace to a finding from this wave.

## Step 4: Deliver the Retrospective

### Example — Retrospective With Insight

> Wave-002 delivered 8 of 10 tasks in 12 days. The wave was bottlenecked by review turnaround — 3 tasks spent over 2 days in Review.
>
> **Key finding:** #38 sat in Review 6 days without a PR — a false status that cascaded to block #42 and #47 for a combined 7 days. This pattern also appeared in Wave-001 (this is the second consecutive wave with a false review status causing cascading blocks).
>
> **By the numbers:** 8/10 delivered | velocity: 8 (down from 10 in Wave-001) | 3 tasks blocked (avg 2.3 days) | review avg: 2.4 days
>
> **Recommendation:** Daily status check — any task In Review >1 day without a PR gets auto-flagged. Would have saved 5 of 7 blocked days.
>
> **Carry forward:** External API dependency blocked 2 tasks this wave, 1 in Wave-001. Trend confirmed — create mock for Wave-003.

### Format

**Opening**: One paragraph with delivery summary and wave character.
**Key Findings**: 2-4 paragraphs, biggest insight first.
**By the Numbers**: Compact metrics line.
**Recommendations**: 2-4 specific, data-backed items.
**Carry Forward**: Items to watch in the next wave.

## Step 5: Persist Findings

After delivering the narrative, output a structured summary block that should be saved to memory. Present it clearly so the user or PM agent can persist it:

```
--- RETRO FINDINGS (save to memory) ---
Wave: [wave name]
Date: [today's date]
Tasks completed: X/Y
Velocity: X tasks
Avg review days: N
Blocked count: N (avg N days)
Bottleneck: [primary bottleneck]
Recurring patterns: [patterns confirmed across waves]
Recommendations: [2-4 items]
Carry forward: [items for next wave]
---
```

Tell the user: "These findings should be saved to memory so `/standup` and `/plan-wave` can reference them in future sessions. Would you like me to update the project memory?"

This creates the cross-skill feedback loop: retro findings inform future standups (blocker awareness) and wave planning (capacity, recurring issues).

### Anti-patterns — Do NOT:
- Give generic advice ("communicate better") — tie every recommendation to specific data
- Skip comparison with previous retros — trends matter more than snapshots
- List raw metrics without interpretation
- Ignore what went well — understand success patterns too
- Write a data dump instead of a narrative
- Forget to persist findings — the retro's value compounds when future skills can reference it
