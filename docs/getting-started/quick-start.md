# Quick Start

This guide walks you through initializing ido4 governance on a real GitHub repository and executing your first governed workflow.

## 1. Initialize a Project

With Claude Code and the plugin loaded:

```
> Initialize ido4 governance for my-org/my-project
```

Claude will call `init_project`, which:
- Creates a GitHub Project V2 linked to your repository
- Sets up custom fields (Status, Wave, Epic, Dependencies, AI Suitability, Risk Level, Effort, Task Type)
- Configures status options (Backlog, In Refinement, Ready for Dev, In Progress, In Review, Done, Blocked)
- Writes `.ido4/project-info.json` with project metadata

## 2. Create Tasks

```
> Create a task: "Build user authentication service"
>   Epic: Authentication, Wave: wave-001, Effort: L, Risk: HIGH
```

Claude calls `create_task` with the parameters. The task becomes a GitHub issue, linked to the project board with all governance fields populated.

## 3. Start Working

```
> Start working on task #42
```

Before changing any status, ido4 runs the BRE validation pipeline:

```
BRE Validation for #42 → In Progress:
  ✓ StartFromReadyForDev — task is in Ready for Dev
  ✓ StatusTransition — Ready for Dev → In Progress is valid
  ✓ DependencyValidation — all dependencies satisfied
  ✓ WaveAssignment — assigned to active wave
  ✓ EpicIntegrity — epic is cohesive
  ⚠ AISuitability — ai-reviewed (human oversight recommended)
  ✓ RiskLevel — HIGH risk, standard process applies

All checks passed. Transitioning to In Progress.
```

If any check fails, the transition is **blocked** — not warned, blocked. The BRE explains exactly what failed and what to do about it.

## 4. The Governance Loop

The typical workflow:

```
Ready for Dev → start_task → In Progress
                               ↓ (do the work)
In Progress   → review_task → In Review
                               ↓ (PR review)
In Review     → approve_task → Done
```

At every arrow, the BRE validates. At every transition, an audit event is recorded.

### When Things Go Wrong

```
> Start task #43

BRE: BLOCKED
  ✗ DependencyValidation — dependency #42 not completed (In Progress)

  You cannot start #43 until #42 is Done.
  Recommended: finish #42 first, or use block_task if #43 is
  waiting on external factors.
```

## 5. Check Governance Status

```
> /ido4:standup
```

The standup skill gathers wave status, blocked tasks, review bottlenecks, audit trail activity, and compliance score — then delivers a concise briefing with the single highest-leverage action for the day.

```
> /ido4:health
```

The health skill gives a 5-second verdict: GREEN (everything flowing), YELLOW (some concerns), or RED (action needed).

## 6. Multi-Agent Setup

If you're deploying multiple AI agents:

```
> Register agent "agent-alpha" as a coding agent with
>   capabilities: backend, data, API
```

Claude calls `register_agent`. Now when agent-alpha asks "what should I work on?", `get_next_task` scores all candidates and recommends the highest-leverage task based on:

- **Cascade value** — What does this task unblock?
- **Epic momentum** — Is this epic close to completion?
- **Capability match** — Does this agent's profile fit the task?
- **Dependency freshness** — Was a dependency just completed?

## Next Steps

- [Sandbox Demo](sandbox.md) — See governance discovering violations in a controlled environment
- [The 5 Governance Principles](../concepts/governance-principles.md) — Understand the rules
- [Business Rule Engine](../concepts/business-rule-engine.md) — How validation works under the hood
