---
title: "Business Rule Engine (BRE)"
---

The BRE is the automated quality checkpoint that runs on every task state transition. It catches dependency violations, integrity breaks, and missing criteria *before* they cascade — using deterministic TypeScript code, not LLM instructions that can be hallucinated or skipped.

**Why this matters:** Deterministic validation is faster than human review for standard checks (are dependencies complete? is the container assigned?), consistent every time (no tired reviewer, no skipped steps), and fully auditable (every pass and fail is recorded). It lets AI agents work autonomously while guaranteeing that quality standards are met.

<details>
<summary>BRE Validation Pipeline — 34-step flow diagram</summary>
<div style="width: 100%; height: 605px; overflow: hidden;">
<iframe src="/diagrams/04-bre-pipeline.html" width="1300" height="1100" style="transform: scale(0.55); transform-origin: top left; border: none;" loading="lazy"></iframe>
</div>
</details>

<details>
<summary>Request Flow — tool call lifecycle diagram</summary>
<div style="width: 100%; height: 605px; overflow: hidden;">
<iframe src="/diagrams/02-request-flow.html" width="1300" height="1100" style="transform: scale(0.55); transform-origin: top left; border: none;" loading="lazy"></iframe>
</div>
</details>

## Key Design Principles

**Fail-safe execution.** Every step runs regardless of prior failures. A dependency check failing doesn't skip the security scan. The full picture is always available — agents get actionable guidance on everything that needs fixing, not one error at a time.

**Profile-driven pipelines.** Which steps run for each transition is defined in the methodology profile — not hardcoded. Adding a custom validation step means adding its name to a pipeline, not modifying engine code.

**Type-scoped overrides.** Different work item types can have different rules. User Stories need acceptance criteria. Bugs need reproduction steps. Spikes have relaxed Definition of Done. The BRE checks for `{action}:{type}` first, falls back to `{action}`.

**Parameterized steps.** Steps accept configuration via colon syntax: `PRReviewValidation:2` requires 2 approving reviews. `ContainerAssignmentValidation:wave` checks wave assignment. One step class handles multiple configurations.

## How It Works

When a task transition is requested (e.g., "start task #42"), the BRE:

1. Resolves the pipeline — checks for type-scoped override (`start:bug`), falls back to default (`start`)
2. Instantiates each step via the ValidationStepRegistry (factory pattern with dependency injection)
3. Runs ALL steps, collecting results (fail-safe — no early exit)
4. Returns a structured result with per-step pass/fail/warn and remediation guidance
5. Blocks the transition if any error-severity step fails

```
start_task(#42)
  |
+------------------------------------+
| BRE Pipeline for "start"           |
|                                    |
| 1. SourceStatus           PASS     |
| 2. SpecCompleteness       PASS     |
| 3. StatusTransition       PASS     |
| 4. DependencyValidation   PASS     |
| 5. ContainerAssignment    PASS     |
| 6. ContainerSingularity   PASS     |
| 7. AISuitability          WARN     |
| 8. RiskLevel              PASS     |
| 9. ContainerIntegrity     PASS     |
|                                    |
| Result: PASS (1 warning)           |
+------------------------------------+
  |
Status updated: Ready for Dev -> In Progress
Audit event recorded
```

### What happens when validation fails?

- **Error-severity failure** — transition is blocked. The response includes which steps failed, why, and what to do about it (remediation). The agent can fix the issue and retry.
- **Warning** — transition proceeds but the warning is recorded. Example: `AISuitabilityValidation` warns when an AI agent starts a human-review task.
- **Skip** — step was not applicable (e.g., `TaskLockValidation` when AgentService isn't configured). Skips don't affect the result.

## Pipeline Examples by Methodology

### Hydro

```
refine:  SourceStatus -> BaseTaskFields -> StatusTransition -> ContainerIntegrity
ready:   SourceStatus -> FastTrack -> AcceptanceCriteria -> SpecCompleteness -> EffortEstimation -> DependencyIdentification -> StatusTransition -> ContainerIntegrity
start:   SourceStatus -> SpecCompleteness -> StatusTransition -> Dependency -> ContainerAssignment -> ContainerSingularity -> AISuitability -> RiskLevel -> ContainerIntegrity
review:  StatusTransition -> ImplementationReadiness -> ContainerIntegrity
approve: StatusTransition -> ApprovalRequirement -> ContextCompleteness -> ContainerIntegrity
```

### Scrum (with type-scoped overrides)

```
plan:            SourceStatus -> SpecCompleteness -> StatusTransition
plan:story:      SourceStatus -> AcceptanceCriteria -> SpecCompleteness -> EffortEstimation -> StatusTransition
plan:bug:        SourceStatus -> BaseTaskFields -> SpecCompleteness -> StatusTransition
plan:spike:      SourceStatus -> StatusTransition
start:           SourceStatus -> SpecCompleteness -> StatusTransition -> Dependency -> ContainerAssignment -> ContainerSingularity
approve:spike:   StatusTransition (relaxed DoD)
approve:tech-debt: StatusTransition -> ApprovalRequirement -> ContextCompleteness -> PRReview:2
```

Type-scoped pipelines in action: `plan:story` requires acceptance criteria and effort estimation. `plan:spike` only requires a valid status transition. Same action, different rules based on work item type.

### Shape Up

```
shape:   SourceStatus -> SpecCompleteness -> StatusTransition
bet:     SourceStatus -> StatusTransition -> ContainerAssignment -> ContainerIntegrity
start:   SourceStatus -> SpecCompleteness -> StatusTransition -> ContainerSingularity -> CircuitBreaker
review:  StatusTransition -> CircuitBreaker
ship:    StatusTransition -> ApprovalRequirement -> ContextCompleteness
kill:    TaskAlreadyCompleted -> StatusTransition
```

Note `CircuitBreaker` on `start` and `review` — Shape Up's time-based kill mechanism. If the cycle deadline has passed, the step fails.

## The 34 Validation Steps

The BRE ships with 34 validation steps. Each methodology profile activates a subset per transition.

### State Guards (10)

| Step | What It Checks |
|---|---|
| `SourceStatusValidation` | Task is in expected source state (parameterized) |
| `StatusTransitionValidation` | From/to status pair is valid in the state machine (parameterized) |
| `BackwardTransitionValidation` | Return target is a valid backward status |
| `TaskAlreadyCompletedValidation` | Task is not already in a terminal state |
| `TaskAlreadyBlockedValidation` | Task is already blocked (prevents double-blocking) |
| `TaskNotBlockedValidation` | Task is not blocked (for unblock) |
| `TaskBlockedValidation` | Task is in blocked state (for return from blocked) |
| `StatusAlreadyDoneValidation` | Task is already Done |
| `RefineFromBacklogValidation` | Source is Backlog (Hydro-specific shorthand) |
| `StartFromReadyForDevValidation` | Source is Ready for Dev (Hydro-specific shorthand) |

### Readiness & Field Requirements (8)

| Step | What It Checks |
|---|---|
| `BaseTaskFieldsValidation` | Required fields (title, body) are populated |
| `AcceptanceCriteriaValidation` | Task has acceptance criteria or success conditions |
| `SpecCompletenessValidation` | Description content >= 200 chars |
| `EffortEstimationValidation` | Effort field is set |
| `DependencyIdentificationValidation` | Dependencies field is explicitly set (even if empty) |
| `ReadyFromRefinementOrBacklogValidation` | Source is Refinement or Backlog (Hydro-specific) |
| `FastTrackValidation` | Allows fast-tracking from Backlog to Ready (skips refinement) |
| `WaveAssignmentValidation` | Task assigned to a wave (Hydro-specific shorthand) |

### Dependency & Integrity (2)

| Step | What It Checks |
|---|---|
| `DependencyValidation` | All dependency tasks are in terminal state |
| `SubtaskCompletionValidation` | All sub-issues are in terminal state before parent closes |

### Container Governance (4)

| Step | What It Checks |
|---|---|
| `ContainerAssignmentValidation` | Task assigned to active container (parameterized: wave, sprint, cycle) |
| `ContainerSingularityValidation` | Only one container of this type is active (parameterized) |
| `ContainerIntegrityValidation` | Integrity rule satisfied, e.g., all epic tasks in same wave (parameterized) |
| `CircuitBreakerValidation` | Cycle has time remaining — Shape Up timebox enforcement (parameterized) |

### Risk, Suitability & Approval (4)

| Step | What It Checks |
|---|---|
| `AISuitabilityValidation` | Warns for human-review or human-only tasks started by AI |
| `RiskLevelValidation` | Risk level assessment and process requirements |
| `ApprovalRequirementValidation` | Closing transition has appropriate approval evidence |
| `ContextCompletenessValidation` | Completion context provided (what was built, decisions, interfaces) |

### Quality Gates (3)

| Step | What It Checks |
|---|---|
| `PRReviewValidation` | PR has minimum approving reviews (parameterized: count) |
| `TestCoverageValidation` | Test coverage meets threshold (parameterized: %) |
| `SecurityScanValidation` | No critical/high security vulnerabilities |

### Implementation & Review (2)

| Step | What It Checks |
|---|---|
| `ImplementationReadinessValidation` | Implementation evidence exists (PR, commits, or context) |
| `EpicIntegrityValidation` | Epic-wave integrity (Hydro-specific shorthand) |

### Multi-Agent (1)

| Step | What It Checks |
|---|---|
| `TaskLockValidation` | Warns if task is locked by a different agent |

## Parameterized Steps Reference

| Step | Parameter | Example | Effect |
|---|---|---|---|
| `SourceStatusValidation` | Source states | `:READY_FOR_DEV` | Only passes if task is in Ready for Dev |
| `StatusTransitionValidation` | Target state | `:IN_PROGRESS` | Validates transition to In Progress |
| `ContainerAssignmentValidation` | Container type | `:wave` | Checks wave assignment |
| `ContainerSingularityValidation` | Container type | `:sprint` | Checks sprint singularity |
| `ContainerIntegrityValidation` | Rule ID | `:epic-wave-integrity` | Checks specific integrity rule |
| `CircuitBreakerValidation` | Container type | `:cycle` | Checks cycle time remaining |
| `PRReviewValidation` | Min approvals | `:2` | Requires 2 approving reviews |
| `TestCoverageValidation` | Threshold | `:90` | Requires 90% coverage |

## Validation Results

Every BRE run returns a structured result:

```typescript
{
  canProceed: boolean;        // true if no error-severity failures
  stepResults: [{
    stepName: string;         // "DependencyValidation"
    passed: boolean;          // step-level pass/fail
    severity: 'error' | 'warning' | 'info';
    message: string;          // Human-readable explanation
    details?: object;         // Step-specific data
  }];
  failedSteps: number;
  warnedSteps: number;
  executionTimeMs: number;
  suggestions: Suggestion[];  // Actionable next steps
}
```

## Dry Run

Every transition tool supports `dryRun: true`, which runs the full BRE pipeline without executing the transition:

```
validate_transition(#42, "start")
-> Runs all steps, returns results, changes nothing
```

The `validate_all_transitions` tool runs the BRE for all possible transitions on a task, showing exactly what's allowed and what's blocked — and why. This is how agents explore the state machine without side effects.

## Audit Integration

Every BRE evaluation (pass or fail) is recorded in the audit trail:

- **Pass**: Records the transition, actor, timestamp, and all step results
- **Fail**: Records the attempted transition, which steps failed, and remediation guidance
- **Skip (dry run)**: Not recorded — dry runs leave no audit trace

The compliance score uses BRE pass/fail ratios as its highest-weighted category (35-40% depending on methodology).

## Extensibility

The ValidationStepRegistry is already a plugin architecture. Each step is registered by name with a factory function. Adding a custom step:

1. Implement the `ValidationStep` interface (name + validate method)
2. Register with the registry: `registry.register('MyCustomStep', (deps) => new MyCustomStep(deps))`
3. Add to a profile pipeline: `"approve": { "steps": ["StatusTransition", "MyCustomStep"] }`

No engine changes. The profile references step names, the registry resolves them. See [Validation Extensibility](https://github.com/ido4-dev/ido4/blob/main/architecture/validation-extensibility.md) for the full architecture.
