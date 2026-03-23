---
title: "Waves & Epics"
---

This page covers Hydro's container model. For a comprehensive view of all methodologies, see:

- **[Methodologies](methodologies.md)** — Compare Hydro, Scrum, and Shape Up
- **[Containers](containers.md)** — The methodology-agnostic container abstraction

---

## Waves

A wave is Hydro's execution container — a self-contained unit of delivery with strict ordering. Only one wave can be active at a time.

### Wave Lifecycle

```
Created -> Active -> Completed
```

- **Created**: Tasks assigned during planning. Wave not yet started.
- **Active**: Team is working on tasks. Only one wave active at a time (Wave Singularity).
- **Completed**: All tasks Done. Next wave can activate.

### Wave Naming

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
| Only one active wave | Active Wave Singularity | ContainerSingularityValidation |
| All tasks Done to complete | Atomic Completion | Container completion rule |
| No forward dependencies | Dependency Coherence | DependencyValidation |
| Self-contained | Self-Contained Execution | validate_wave_completion |

### Wave Tools

```
list_waves               -> See all waves with completion %
get_wave_status          -> Detailed breakdown of a specific wave
create_wave              -> Create a new wave
assign_task_to_wave      -> Assign a task (with Epic Integrity check)
validate_wave_completion -> Check if all tasks are Done
```

## Epics

An epic is Hydro's grouping container — related tasks that must ship together. Implemented as GitHub parent issues with sub-issues.

### Epic Integrity

> **All tasks in an epic MUST be in the same wave.**

This is Hydro's Principle 1. If your Authentication epic has 4 tasks, all 4 must be in the same wave. You cannot ship token management in wave-002 and RBAC in wave-003.

**Why**: Partial feature delivery creates integration risk, testing gaps, and user-facing inconsistencies.

**Note**: This is Hydro-specific. Scrum epics span sprints (no integrity rule). Shape Up uses Bets with Bet Integrity (same concept, different naming).

### Epic Tools

```
search_epics             -> Find epics by name
get_epic_tasks           -> All tasks in an epic with status and wave
get_epic_timeline        -> Full epic view with sub-issues and progress
validate_epic_integrity  -> Check if a task's epic assignment is valid
```

## Task Statuses (Hydro)

```
Backlog -> In Refinement -> Ready for Dev -> In Progress -> In Review -> Done
                                                   |
                                               Blocked
```

For Scrum and Shape Up status flows, see [Methodologies](methodologies.md).
