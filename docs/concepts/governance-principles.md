# The 5 Governance Principles

ido4's governance model is built on 5 principles that cannot be bypassed. They are enforced deterministically by the Business Rule Engine — no override, no exception, no "just this once."

These principles exist because AI agents operating at scale need hard boundaries. Without them, an agent optimizing for speed will violate dependency order. An agent optimizing for throughput will split epics across waves. An agent optimizing for its own task will ignore coordination constraints.

## Principle 1: Epic Integrity

> All tasks within an epic MUST be assigned to the same wave.

**Why**: An epic represents a coherent feature. Shipping authentication tokens in wave-002 but RBAC in wave-003 means deploying an incomplete security model. Partial feature delivery creates integration risk, testing gaps, and user-facing inconsistencies.

**Enforcement**: The BRE's `EpicIntegrityValidation` step runs on every wave assignment and task transition. If assigning task #42 to wave-003 would split its epic (other tasks are in wave-002), the assignment is blocked.

**Example violation**:
```
assign_task_to_wave(#276, "wave-003")

BLOCKED: Epic Integrity violation
  Task #276 (RBAC) belongs to epic "Authentication"
  Other tasks in this epic are in wave-002: #270, #271, #272
  All tasks in an epic must be in the same wave.
```

## Principle 2: Active Wave Singularity

> Only one wave can be active at a time.

**Why**: Focus. When two waves are active simultaneously, resources scatter, context-switching increases, and completion dates become unpredictable. One wave, driven to completion, then the next.

**Enforcement**: The `WaveAssignmentValidation` step ensures tasks can only be started if they belong to the currently active wave. `validate_wave_completion` must pass before the next wave activates.

## Principle 3: Dependency Coherence

> A task's wave must be numerically equal to or higher than its dependencies' waves.

**Why**: You can't start building the second floor before the foundation is done. If task A depends on task B, task A must be in the same wave or a later wave than task B.

**Enforcement**: The `DependencyValidation` step checks that all dependency tasks are in Done status before allowing a `start` transition. The `analyze_dependencies` tool visualizes the full dependency graph with depth and circular detection.

## Principle 4: Self-Contained Execution

> Each wave contains all dependencies needed for its own completion.

**Why**: A wave must be completable without waiting for work outside the wave. If wave-003 contains task A, and task A depends on task B, then task B must be in wave-003 or an earlier (already completed) wave.

**Enforcement**: `validate_wave_completion` checks that no task in the wave has unsatisfied dependencies pointing outside the wave to incomplete work.

## Principle 5: Atomic Completion

> A wave is complete only when ALL its tasks reach Done.

**Why**: A wave at 90% completion is not complete. Leaving tasks behind creates technical debt, breaks epic integrity assumptions, and makes the next wave's dependency calculations unreliable.

**Enforcement**: `validate_wave_completion` returns a hard FAIL if any task in the wave is not in Done status. The compliance score's "flow efficiency" category penalizes partial completion.

## How They Work Together

The principles form a coherent system:

1. **Epic Integrity** ensures features ship whole
2. **Dependency Coherence** ensures build order is correct
3. **Self-Contained Execution** ensures waves don't have external blockers
4. **Active Wave Singularity** ensures focus on one wave at a time
5. **Atomic Completion** ensures nothing gets left behind

An AI agent following all 5 principles will produce the same delivery sequence as a well-run human team — but faster, and with zero methodology drift.

## Configuring Principles

Principles can be enabled or disabled per project in `.ido4/methodology.json`:

```json
{
  "principles": {
    "epicIntegrity": true,
    "activeWaveSingularity": true,
    "dependencyCoherence": true,
    "selfContainedExecution": true,
    "atomicCompletion": true
  }
}
```

Disabling a principle removes its BRE validation step from the pipeline. This is available for teams with specific needs, but the default is all 5 enabled. Governance is only as strong as the rules you enforce.
