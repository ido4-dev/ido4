# Containers

A container is a methodology-specific unit that groups or schedules work. ido4's engine doesn't know what a "wave" or "sprint" means — it knows about **containers** with typed properties. The methodology profile defines how many container types exist, what each one means, and how they relate to each other.

## Container Types

Every methodology profile defines one or more container types. Each has a role:

| Role | Purpose | Examples |
|---|---|---|
| **Execution** | Schedules when work happens. Has singularity (only one active). | Wave, Sprint, Cycle |
| **Grouping** | Organizes related work. Tasks share a grouping container for coherence. | Epic, Bet |
| **Sub-grouping** | Optional finer-grained organization within a grouping container. | Scope (within a Bet) |

### Execution Containers

The execution container controls the flow of work. Key properties:

- **Singularity** — Only one can be active at a time. You can't work in Sprint 14 and Sprint 15 simultaneously.
- **Completion Rule** — Defines when the container is done. `all-terminal` means every task must reach a terminal state (Done, Shipped, Killed).
- **Ordering** — Execution containers have a natural sequence (wave-001 before wave-002, Sprint 14 before Sprint 15).

| Methodology | Execution Container | Naming Pattern | Completion Rule |
|---|---|---|---|
| Hydro | Wave | `wave-001-auth-system` | All tasks Done |
| Scrum | Sprint | `Sprint 14` | All tasks Done |
| Shape Up | Cycle | `cycle-001-notifications` | All tasks Shipped or Killed |

### Grouping Containers

Grouping containers organize related tasks that form a coherent deliverable. They represent capabilities, features, or commitments.

| Methodology | Grouping Container | Integrity Rule | Spans Execution? |
|---|---|---|---|
| Hydro | Epic | All tasks in same wave | No |
| Scrum | Epic | None | Yes (epics span sprints) |
| Shape Up | Bet | All tasks in same cycle | No |

**Epic Integrity (Hydro)**: If your Authentication epic has 4 tasks, all 4 must be in the same wave. You cannot ship token management in wave-002 and RBAC in wave-003. This prevents partial feature delivery.

**No Integrity (Scrum)**: Scrum epics span sprints by design. An epic might take 3 sprints to complete. The governance Scrum gets instead is type-scoped pipelines — different DoR/DoD per work item type.

**Bet Integrity (Shape Up)**: All tasks in a bet must be in the same cycle. A bet is a commitment for a fixed time period. If it doesn't ship by cycle end, the circuit breaker kills it.

### Sub-grouping Containers

Shape Up introduces a third level — **Scope** — as an optional sub-grouping within a bet. Scopes emerge during building as the team discovers the natural structure of the work.

```
Cycle (execution)
  Bet (grouping)
    Scope (sub-grouping, optional)
      Task
      Task
    Scope
      Task
```

Scopes are `managed: false` — the system doesn't actively manage them, but tracks them for visibility. Teams use scopes to organize work within a bet without governance overhead.

## Container Properties

Each container type is defined with these properties:

| Property | Description | Example |
|---|---|---|
| `id` | Unique identifier | `wave`, `sprint`, `cycle`, `epic`, `bet`, `scope` |
| `singular` / `plural` | Display names | Wave/Waves, Sprint/Sprints |
| `taskField` | GitHub Project field name | `Wave`, `Sprint`, `Cycle` |
| `singularity` | Only one can be active | `true` for execution containers |
| `completionRule` | When is it done | `all-terminal`, `none` |
| `durationWeeks` | Fixed time period | `6` for Shape Up cycles |
| `parent` | Parent container type | `bet` for Scope |
| `managed` | System actively manages it | `true` for most, `false` for Scope |
| `namePattern` | Naming regex | `^wave-\d{3}-[a-z0-9-]+$` |

## Container Tools

The MCP server dynamically generates container management tools based on the active profile's container definitions. If the profile defines `wave` and `epic`, you get wave tools and epic tools. If it defines `sprint` and `epic`, you get sprint tools and epic tools.

### Per-Container Tools

For each managed container type, these tools are generated:

| Tool Pattern | Example (Hydro) | Example (Scrum) | Example (Shape Up) |
|---|---|---|---|
| `list_{plural}` | `list_waves` | `list_sprints` | `list_cycles` |
| `get_{singular}_status` | `get_wave_status` | `get_sprint_status` | `get_cycle_status` |
| `create_{singular}` | `create_wave` | `create_sprint` | `create_cycle` |
| `assign_task_to_{singular}` | `assign_task_to_wave` | `assign_task_to_sprint` | `assign_task_to_cycle` |
| `validate_{singular}_completion` | `validate_wave_completion` | `validate_sprint_completion` | `validate_cycle_completion` |

Grouping container tools:

| Tool Pattern | Hydro | Scrum | Shape Up |
|---|---|---|---|
| `search_{plural}` | `search_epics` | `search_epics` | `search_bets` |
| `get_{singular}_tasks` | `get_epic_tasks` | `get_epic_tasks` | `get_bet_tasks` |
| `get_{singular}_timeline` | `get_epic_timeline` | `get_epic_timeline` | `get_bet_timeline` |
| `validate_{singular}_integrity` | `validate_epic_integrity` | `validate_epic_integrity` | `validate_bet_integrity` |

## Integrity Rules

Integrity rules declare relationships between container types. The engine enforces them generically — it doesn't know about "epics" or "waves," only about rule types.

### Same-Container Rule

> All tasks sharing the same `groupBy` container must share the same `mustMatch` container.

**Hydro**: All tasks with the same Epic must have the same Wave.
**Shape Up**: All tasks with the same Bet must have the same Cycle.
**Scrum**: No same-container rules (epics span sprints).

### Ordering Rule

> A task's execution container must be >= its dependency tasks' execution containers.

**Hydro**: If task A depends on task B, task A's wave must be >= task B's wave. You can't build the second floor before the foundation.

### Containment Rule

> All tasks in a child container must share the same parent container.

**Shape Up**: All tasks in a Scope must share the same Bet (scope is a child of bet).

## Container Lifecycle

### Planning Phase

During planning, tasks are assigned to containers:

```
# Hydro
assign_task_to_wave(#42, "wave-002-auth")
assign_task_to_epic(#42, "Authentication")

# Scrum
assign_task_to_sprint(#42, "Sprint 14")
assign_task_to_epic(#42, "Authentication")

# Shape Up
assign_task_to_cycle(#42, "cycle-001-notifications")
assign_task_to_bet(#42, "Push Notifications")
```

Every assignment is validated against integrity rules. Assigning a task to a wave that would break epic integrity is blocked.

### Execution Phase

During the active execution container, tasks flow through the workflow:

- Only tasks in the active execution container can be started (singularity enforcement)
- The BRE validates container assignment on every `start` transition
- Container status tools show real-time progress

### Completion Phase

An execution container completes when its completion rule is satisfied:

```
validate_wave_completion("wave-002-auth")
→ 12/12 tasks Done — wave can be completed

validate_cycle_completion("cycle-001-notifications")
→ 8/10 tasks Shipped, 2 Killed — cycle can be completed (all terminal)
```

## Containers in the Decomposition Pipeline

When ido4 ingests a technical spec (from the decomposition pipeline), capabilities become grouping containers:

| Technical Spec | Hydro | Scrum | Shape Up |
|---|---|---|---|
| `## Capability: Name` | Epic | Epic | Bet |
| `### PREFIX-NN: Title` | Task (assigned to wave) | Task (assigned to sprint) | Task (assigned to cycle) |

The spec's capabilities automatically map to the methodology's grouping container. Tasks become sub-issues of their parent capability.
