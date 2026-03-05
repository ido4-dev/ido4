---
name: plan-wave
description: Principle-aware wave composition engine that produces a valid-by-construction wave plan respecting all 5 governance principles
user-invocable: true
allowed-tools: mcp__ido4__*, Read, Grep
---

You are composing the next development wave. Your job is to produce a wave plan that is valid by construction — meaning it satisfies all 5 governance principles before a single task is assigned. This is wave planning as a governance exercise, not a backlog grooming session.

Use $ARGUMENTS as the wave name if provided.

## Step 0: Context from Previous Governance Findings

Before gathering live data, check your auto-memory (MEMORY.md is automatically loaded at session start) for governance intelligence that informs planning:

- **Last retro findings** — Extract velocity (tasks per wave), recurring blockers, recommendations. If the last retro said "reduce wave size" or "front-load dependency resolution," honor it.
- **Last compliance audit** — Unresolved violations. If there's an Epic Integrity violation, this wave plan MUST address it.
- **Known recurring patterns** — Issues that affect planning (e.g., "External API dependency blocks tasks every wave — plan a mock").

If no previous governance findings exist in memory, proceed with live data only.

## Step 1: Gather Constraints

1. `get_project_status` — understand overall state, completed waves, active wave
2. `list_tasks` — all tasks, focus on unassigned and future-wave tasks
3. `search_epics` — find all epics in the project
4. For each epic with unassigned tasks, call `get_epic_tasks` to get the full task list

Build a mental model of: what's available, what's grouped by epic, what depends on what.

## Step 2: Epic-First Grouping (Principle 1 — Epic Integrity)

**This is NON-NEGOTIABLE.** For every candidate task:

1. Find its epic.
2. Pull ALL tasks from that epic.
3. They go together or not at all.
4. If pulling an entire epic would exceed capacity, defer the ENTIRE epic. Never split it.

Explain this constraint in your output: "All 4 Auth tasks are included because Epic Integrity requires all tasks in an epic to be in the same wave."

## Step 3: Dependency Analysis (Principles 3 & 4)

Call `analyze_dependencies` for candidate tasks.

**Dependency Coherence (Principle 3)**: A task's wave must be numerically equal to or higher than its dependencies' waves. If a candidate task depends on something in a future, uncompleted wave — it CANNOT be in this wave.

**Self-Contained Execution (Principle 4)**: Every task in the proposed wave must be completable using only:
- Work within this wave
- Work from already-completed prior waves

If a dependency is missing, either pull it into this wave or defer the dependent tasks.

Call `validate_dependencies` on the proposed composition to verify.

## Step 4: Conflict Detection

When two epics share a dependency that creates a conflict:
- Identify the specific conflicting dependency
- Present the trade-off clearly: "Including Epic A means deferring Epic B because both need #38, and including all of B's tasks would exceed capacity."
- Recommend based on downstream impact and business value

## Step 5: Risk Assessment

For the proposed composition, flag:
- Tasks with high `risk_level` field value
- Complex dependency chains (3+ levels deep within the wave)
- Tasks with no effort estimate (planning blind spot)
- Epics where some tasks haven't been through Refinement (may not be ready)
- Recurring blockers from retro findings that might affect this wave

## Step 6: Capacity Reasoning

- How many tasks were in the last completed wave? (Check retro findings if available)
- How long did that wave take?
- Use this as a rough capacity ceiling for the new wave.
- If the proposed wave exceeds this ceiling, flag it: "This wave has N tasks vs. last wave's M — risk of overloading."

A focused wave that completes is better than an ambitious wave that stalls.

## Step 7: Validate the Plan

Call `validate_epic_integrity` for each epic in the proposed wave.
Call `validate_dependencies` for the wave composition.

If validation fails, adjust and re-validate. Present only a validated plan.

## Example — What Principle-Aware Planning Sounds Like

> **Recommended Wave-003 (9 tasks, 2 epics):**
>
> Epic: Auth (4 tasks) — #50 Token service, #51 Session mgmt, #52 Login flow, #53 Logout. All included per Epic Integrity. #50 → #51 → #52 chain; #53 independent.
>
> Epic: Dashboard (5 tasks) — #55 Layout, #56 Widgets, #57 Data binding, #58 Refresh, #59 Export. #57 depends on #50 (Auth token) — satisfied within this wave.
>
> **Deferred:** Epic: Settings (3 tasks) — ready but would exceed last wave's capacity (8 tasks). Deferring lowest-impact epic.
>
> **Risk:** #57→#50 has a 3-task chain above it. If #50 slips, Dashboard stalls.
>
> **Governance applied:** Epic Integrity kept Auth whole. Dependency Coherence verified — no forward dependencies. Self-Contained: all deps satisfiable within wave + completed waves.

## Output Format

### Recommended Wave Composition
Per-epic breakdown with task lists, dependency rationale, risk flags.

### Deferred to Future Waves
What and why. When it could be included.

### Governance Constraints Applied
Which principles influenced the composition and how.

### Risks and Considerations
Capacity, dependency chains, missing estimates, trade-offs.

### Anti-patterns — Do NOT:
- Propose tasks individually without checking their epic membership
- Split an epic across waves under ANY circumstances
- Ignore dependency chains
- Exceed historical capacity without flagging it
- Present a plan without explaining the governance constraints that shaped it
- Skip validation — always call `validate_epic_integrity` and `validate_dependencies`
- Ignore previous retro recommendations about capacity or recurring blockers
