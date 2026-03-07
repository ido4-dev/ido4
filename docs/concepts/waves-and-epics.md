# Waves & Epics

ido4 organizes work into **waves** and groups related work into **epics**. Together they provide a governance-friendly structure that AI agents can reason about and the BRE can enforce.

## Waves

A wave is a self-contained unit of execution — similar to a sprint, but with stricter governance constraints.

### Wave Lifecycle

```
Created → Active → Completed
```

- **Created**: Tasks are assigned to the wave during planning. The wave isn't started yet.
- **Active**: The team (human or AI) is working on tasks in this wave. Only one wave can be active at a time (Principle 2).
- **Completed**: All tasks in the wave are Done. The next wave can be activated.

### Wave Naming Convention

Waves follow a numbered naming pattern:

```
wave-001-foundation
wave-002-core
wave-003-advanced
wave-004-polish
```

The number determines execution order. The suffix is descriptive.

### Wave Rules

| Rule | Principle | Enforcement |
|---|---|---|
| Only one active wave | Active Wave Singularity (#2) | BRE blocks starting tasks outside active wave |
| All tasks must be Done to complete | Atomic Completion (#5) | `validate_wave_completion` fails if any task isn't Done |
| No forward dependencies | Dependency Coherence (#3) | BRE blocks starting tasks with incomplete dependencies |
| Self-contained | Self-Contained Execution (#4) | All dependencies must be within the wave or completed earlier |

### Wave Tools

```
list_waves               → See all waves with completion %
get_wave_status          → Detailed breakdown of a specific wave
create_wave              → Create a new wave
assign_task_to_wave      → Assign a task (with epic integrity check)
validate_wave_completion → Check if a wave can be marked complete
```

## Epics

An epic is a container for related tasks that must ship together. In ido4, epics are implemented as GitHub parent issues with sub-issues.

### Epic Integrity

The most important rule about epics:

> **All tasks in an epic MUST be in the same wave.**

This is Principle 1 — Epic Integrity. If your Authentication epic has 4 tasks, all 4 must be in the same wave. You cannot ship token management in wave-002 and RBAC in wave-003.

**Why**: Partial feature delivery creates integration risk, testing gaps, security holes, and user-facing inconsistencies. Governance ensures features ship whole.

### Epic Detection

ido4 detects epics via GitHub's sub-issues API. A parent issue with sub-issues is treated as an epic. The epic's name becomes a governance field on each task.

### Epic Tools

```
search_epics             → Find epics by name
get_epic_tasks           → All tasks in an epic with status and wave
get_epic_timeline        → Full epic view with sub-issues and progress
validate_epic_integrity  → Check if a task's epic assignment is valid
```

## Planning a Wave

The `/ido4:plan-wave` skill composes waves following all governance constraints:

1. **Epic-first grouping** — Group tasks by epic to ensure integrity
2. **Dependency analysis** — Ensure all dependencies are satisfiable
3. **Capacity estimation** — Use real throughput data from analytics
4. **Risk assessment** — Consider task risk levels and AI suitability
5. **Validation** — Verify the composed wave satisfies all 5 principles

The output is a valid-by-construction wave plan — every task assignment has been validated against the governance model before the plan is presented.

## Task Statuses

Tasks flow through these statuses:

```
Backlog → In Refinement → Ready for Dev → In Progress → In Review → Done
                                               ↕
                                           Blocked
```

Each arrow represents a transition validated by the BRE. The `Blocked` status can be entered from multiple states and requires a reason.
