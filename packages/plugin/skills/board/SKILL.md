---
name: board
description: Intelligent kanban visualization with flow analysis — not just what is where, but whether work is flowing
user-invocable: true
allowed-tools: mcp__ido4__*
---

You are displaying an intelligent kanban board. Your job is NOT just to show where tasks are — it is to analyze whether work is flowing and surface patterns that need attention.

Use $ARGUMENTS as the wave name if provided. Otherwise, use the active wave.

## Step 1: Gather Data

1. `get_project_status` — overall context
2. `get_wave_status` — target wave's task breakdown
3. `list_tasks` filtered to the wave — full task details including epic, blocked status, duration in current state

## Step 2: Detect Phase

Determine the wave phase and adjust your flow analysis focus:
- **Early (<30%)**: Expect most tasks in Ready/Refinement. Flag anything already blocked — that's an early warning sign.
- **Mid (30-70%)**: Expect distribution across columns. Focus on identifying bottlenecks — where is work piling up?
- **Late (>70%)**: Expect most in Done. Remaining tasks are critical — every obstacle deserves attention.

## Step 3: Build the Board

Group tasks by workflow status into columns:

```
READY          IN PROGRESS     IN REVIEW       DONE
─────          ───────────     ─────────       ────
#12 Auth login #15 API setup   #10 DB schema   #8 Config
[Auth]         [Infra]         [Data] 3d       [Setup]
                               #11 Migrations
                               [Data] BLOCKED 2d
```

For each task show:
- Task number and short title
- Epic tag in brackets
- If blocked: `BLOCKED` marker with duration (days)
- If in Review: duration in review (days) — stale reviews (>2 days) get flagged

Include Backlog and Refinement columns only if they contain tasks.

## Step 4: Analyze Flow

### Column Balance
After building the board, analyze the distribution:

- **Review bottleneck**: In Review has more tasks than In Progress → "3 tasks waiting for review vs. 1 in progress — approvals are the bottleneck."
- **Underutilization**: Ready has many tasks, In Progress has few → "5 tasks ready but only 1 in progress — capacity available."
- **Healthy flow**: Tasks distributed across columns with majority in Done → no flags needed.
- **Front-loaded**: Most tasks in early columns → "Wave is early or tasks need more refinement."

### Blocked Health
- Calculate blocked tasks as percentage of total wave tasks
- \> 20% blocked = "Wave health concern: X% of tasks are blocked"
- For each blocked task, note what it blocks downstream if significant

### Epic Cohesion
- Group tasks by epic within columns
- If all tasks from one epic are in the same column → "Epic [name] is [stuck in X / moving together through X]"
- If an epic has tasks in Done AND tasks in Backlog → "Epic [name] has inconsistent flow"

### Completion Trajectory
- X of Y tasks done (Z%)
- Note if the wave appears on track based on the distribution

## Step 5: Present

### Example — Board With Flow Intelligence

> ```
> Wave-002 | 2/8 complete (25%) | 1 blocked
>
> READY          IN PROGRESS     IN REVIEW       DONE
> ─────          ───────────     ─────────       ────
> #12 Auth login #15 API setup   #10 DB schema   #8 Config
> [Auth]         [Infra]         [Data] 3d       [Setup]
> #13 Auth token                 #11 Migrations  #9 Env setup
> [Auth]                         [Data] BLOCKED  [Setup]
> ```
>
> **Flow:** Review bottleneck — 2 in Review vs. 1 in Progress. #11 blocked in Review (unusual). Data epic stuck: both tasks in Review, one blocked. Auth hasn't started — #12 unblocks #13, consider picking it up.

### Header
```
Wave-NNN | X/Y complete (Z%) | B blocked
```

### Board
Clean text kanban with columns, task cards, epic tags, blocked markers, and review durations.

### Flow Insights (Footer)
2-4 observations based on the analysis. Lead with the most actionable:
- Column balance issues
- Blocked percentage if concerning
- Epic cohesion patterns
- Next milestone ("1 task from completing the Auth epic")

### Anti-patterns — Do NOT:
- Show a plain bulleted list instead of a visual board layout
- Omit the flow analysis — the board without insight is just a data dump
- Ignore blocked tasks or hide how long they've been blocked
- Skip epic grouping — it reveals important cohesion patterns
- Over-decorate the board with ASCII art — keep it clean and scannable
