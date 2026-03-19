# Governance Principles

Each methodology defines its own governance principles — rules enforced deterministically by the Business Rule Engine. These principles exist because AI agents operating at scale need hard boundaries. Without them, an agent optimizing for speed will violate dependency order. An agent optimizing for throughput will split features across containers. An agent optimizing for its own task will ignore coordination constraints.

## Principles by Methodology

### Hydro (5 Principles)

| Principle | Description | Severity | Enforcement |
|---|---|---|---|
| **Epic Integrity** | All tasks in an epic must be in the same wave | Error | ContainerIntegrityValidation |
| **Active Wave Singularity** | Only one wave can be active at a time | Error | ContainerSingularityValidation |
| **Dependency Coherence** | A task's wave must be >= its dependency tasks' waves | Warning | Ordering integrity rule |
| **Self-Contained Execution** | Each wave contains all dependencies needed for its tasks | Warning | SelfContainedExecutionValidation |
| **Atomic Completion** | A wave is complete only when ALL its tasks reach Done | Error | Container completion rule |

### Scrum (1 Principle)

| Principle | Description | Severity | Enforcement |
|---|---|---|---|
| **Sprint Singularity** | Only one sprint can be active at a time | Error | ContainerSingularityValidation |

Scrum relies on type-scoped pipelines (different DoR/DoD per work item type) rather than structural integrity rules. Epics intentionally span sprints.

### Shape Up (4 Principles)

| Principle | Description | Severity | Enforcement |
|---|---|---|---|
| **Bet Integrity** | All tasks in a bet must be in the same cycle | Error | ContainerIntegrityValidation |
| **Active Cycle Singularity** | Only one cycle can be active at a time | Error | ContainerSingularityValidation |
| **Circuit Breaker** | If a bet isn't shipped by cycle end, it's killed. No extensions. | Error | CircuitBreakerValidation |
| **Fixed Appetite** | Time is fixed, scope is variable. Hammer scope, not timelines. | Warning | — |

## Universal Governance Patterns

While principles differ, three governance patterns appear across all methodologies:

### 1. Execution Container Singularity

Every methodology enforces that only one execution container is active at a time — one wave, one sprint, or one cycle. This prevents resource scatter and context-switching.

### 2. Dependency Validation

Every methodology validates dependencies before allowing work to start. You cannot begin a task until its dependencies are complete, regardless of whether you're using waves, sprints, or cycles.

### 3. Audit Everything

Every state transition, in every methodology, creates an immutable audit event. The audit trail captures the actor (human or AI), timestamp, validation results, and any overrides. This is non-negotiable — governance without visibility is theater.

## How Principles Are Enforced

Principles map to enforcement mechanisms in the profile:

| Mechanism | What It Does | Used By |
|---|---|---|
| `integrity-rule` | Validates relationships between containers (e.g., all tasks in same epic must share same wave) | Epic Integrity, Bet Integrity |
| `container-constraint` | Enforces container-level rules (singularity, completion) | Wave/Sprint/Cycle Singularity, Atomic Completion |
| `validation-step` | Runs a specific BRE validation step | Self-Contained Execution, Circuit Breaker |

## Epic Integrity (Hydro)

> All tasks within an epic MUST be assigned to the same wave.

An epic represents a coherent feature. Shipping authentication tokens in wave-002 but RBAC in wave-003 means deploying an incomplete security model. Partial feature delivery creates integration risk, testing gaps, and user-facing inconsistencies.

**Enforcement**: The BRE's `ContainerIntegrityValidation` step runs on every wave assignment and task transition. If assigning task #42 to wave-003 would split its epic, the assignment is blocked.

```
assign_task_to_wave(#276, "wave-003")

BLOCKED: Epic Integrity violation
  Task #276 (RBAC) belongs to epic "Authentication"
  Other tasks in this epic are in wave-002: #270, #271, #272
  All tasks in an epic must be in the same wave.
```

## Circuit Breaker (Shape Up)

> If a bet is not shipped by the end of a cycle, it is killed. No extensions.

This is Shape Up's defining discipline. The circuit breaker prevents runaway projects — if a bet can't ship within the fixed cycle time, the scope was wrong, not the timeline. The work returns to the cooldown for reshaping.

**Enforcement**: The `CircuitBreakerValidation` step checks the cycle's remaining time on every transition (start, review, unblock, return). As the deadline approaches, it provides increasingly urgent warnings. Once the cycle expires, tasks in non-terminal states are candidates for the `kill` transition.

```
start_task(#88)

WARNING: Circuit breaker
  Cycle cycle-001-notifications has 3 days remaining (of 42)
  This bet has 4 tasks not yet shipped
  Consider scope cuts or the kill transition
```

## Configuring Principles

Custom profiles can adjust principles:

```json
{
  "extends": "hydro",
  "id": "my-team",
  "principles": [
    {
      "id": "epic-integrity",
      "name": "Epic Integrity",
      "description": "All tasks in an epic must be in the same wave",
      "severity": "warning"
    }
  ]
}
```

Changing severity from `error` to `warning` downgrades the principle — violations produce warnings instead of blocking transitions. Removing a principle from the profile disables its enforcement entirely.

Governance is only as strong as the rules you enforce.
