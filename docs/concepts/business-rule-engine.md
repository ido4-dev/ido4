# Business Rule Engine (BRE)

The Business Rule Engine is the core of ido4's governance. It's a composable validation pipeline that evaluates every task state transition against a set of deterministic rules. The BRE runs real TypeScript code — not LLM instructions, not YAML configuration interpreted by an AI. Real code with real results.

## How It Works

When a task transition is requested (e.g., "start task #42"), the BRE:

1. Loads the validation steps configured for that transition type in the active methodology profile
2. Checks for type-scoped pipeline overrides (e.g., `start:bug` instead of `start`)
3. Runs each step sequentially, collecting results
4. Returns a structured result with per-step pass/fail/warn details
5. Blocks the transition if any step fails (unless `skipValidation` is explicitly used)

```
start_task(#42)
  |
+------------------------------------+
| BRE Pipeline for "start"           |
|                                    |
| 1. SourceStatus           PASS     |
| 2. SpecCompleteness       PASS     |
| 3. StatusTransition        PASS     |
| 4. DependencyValidation   PASS     |
| 5. ContainerAssignment     PASS     |
| 6. ContainerSingularity    PASS     |
| 7. AISuitability           WARN     |
| 8. RiskLevel               PASS     |
| 9. ContainerIntegrity      PASS     |
|                                    |
| Result: PASS (1 warning)           |
+------------------------------------+
  |
Status updated: Ready for Dev -> In Progress
Audit event recorded
```

## Profile-Driven Pipelines

The BRE pipeline is fully driven by the methodology profile. Each profile defines which validation steps run for each transition:

### Hydro Pipeline Example

```
refine:  SourceStatus -> BaseTaskFields -> StatusTransition -> ContainerIntegrity
ready:   SourceStatus -> FastTrack -> AcceptanceCriteria -> SpecCompleteness -> EffortEstimation -> DependencyIdentification -> StatusTransition -> ContainerIntegrity
start:   SourceStatus -> SpecCompleteness -> StatusTransition -> Dependency -> ContainerAssignment -> ContainerSingularity -> AISuitability -> RiskLevel -> ContainerIntegrity
review:  StatusTransition -> ImplementationReadiness -> ContainerIntegrity
approve: StatusTransition -> ApprovalRequirement -> ContextCompleteness -> ContainerIntegrity
```

### Scrum Pipeline Example

```
plan:         SourceStatus -> SpecCompleteness -> StatusTransition
plan:story:   SourceStatus -> AcceptanceCriteria -> SpecCompleteness -> EffortEstimation -> StatusTransition
plan:bug:     SourceStatus -> BaseTaskFields -> SpecCompleteness -> StatusTransition
plan:spike:   SourceStatus -> StatusTransition
start:        SourceStatus -> SpecCompleteness -> StatusTransition -> Dependency -> ContainerAssignment -> ContainerSingularity
approve:spike: StatusTransition (relaxed DoD)
approve:tech-debt: StatusTransition -> ApprovalRequirement -> ContextCompleteness -> PRReview:2
```

### Shape Up Pipeline Example

```
shape:   SourceStatus -> SpecCompleteness -> StatusTransition
bet:     SourceStatus -> StatusTransition -> ContainerAssignment -> ContainerIntegrity
start:   SourceStatus -> SpecCompleteness -> StatusTransition -> ContainerSingularity -> CircuitBreaker
review:  StatusTransition -> CircuitBreaker
ship:    StatusTransition -> ApprovalRequirement -> ContextCompleteness
kill:    TaskAlreadyCompleted -> StatusTransition
```

## The 32 Built-in Validation Steps

The BRE ships with 32 validation steps organized into 7 categories. Each methodology profile activates a subset per transition.

### Source Status Steps (5)

These verify the task is in the expected state before a transition.

| Step | What It Checks | Used By |
|---|---|---|
| `SourceStatusValidation` | Task is in one of the expected source states (parameterized) | All profiles |
| `TaskAlreadyCompletedValidation` | Task is not already in a terminal state | All (block, unblock, return, kill) |
| `TaskAlreadyBlockedValidation` | Task is already blocked (prevents double-blocking) | Hydro |
| `TaskNotBlockedValidation` | Task is not blocked (for unblock transition) | Hydro |
| `TaskBlockedValidation` | Task is in blocked state (validates return from blocked) | Hydro |
| `StatusAlreadyDoneValidation` | Task is already Done (for administrative complete) | Hydro |

### Status Transition Steps (2)

| Step | What It Checks | Used By |
|---|---|---|
| `StatusTransitionValidation` | The from/to status pair is valid in the state machine (parameterized with target state) | All profiles, all transitions |
| `BackwardTransitionValidation` | Return target is a valid backward status | All profiles (return) |

### Readiness & Quality Steps (7)

These check that work meets quality standards before progressing.

| Step | What It Checks | Used By |
|---|---|---|
| `BaseTaskFieldsValidation` | Required fields (title, body) are populated | Hydro (refine), Scrum (plan:bug) |
| `AcceptanceCriteriaValidation` | Task has acceptance criteria or success conditions | Hydro (ready), Scrum (plan:story) |
| `SpecCompletenessValidation` | Task has sufficient description content (>= 200 chars) | All profiles (start, plan) |
| `EffortEstimationValidation` | Effort field is set | Hydro (ready), Scrum (plan:story) |
| `DependencyIdentificationValidation` | Dependencies field is explicitly set (even if empty) | Hydro (ready) |
| `ImplementationReadinessValidation` | Implementation evidence exists (PR, commits, or context) | All profiles (review) |
| `FastTrackValidation` | Allows fast-tracking from Backlog to Ready (skips refinement) | Hydro (ready) |

### Dependency Steps (1)

| Step | What It Checks | Used By |
|---|---|---|
| `DependencyValidation` | All dependency tasks are in a terminal state | All profiles (start) |

### Container Steps (4)

These are the methodology-agnostic container enforcement steps that replaced methodology-specific validation.

| Step | What It Checks | Parameters | Used By |
|---|---|---|---|
| `ContainerAssignmentValidation` | Task is assigned to an active container | Container type ID | All profiles (start) |
| `ContainerSingularityValidation` | Only one container of this type is active | Container type ID | All profiles (start) |
| `ContainerIntegrityValidation` | Integrity rule is satisfied (e.g., all tasks in same epic share same wave) | Rule ID | Hydro, Shape Up |
| `CircuitBreakerValidation` | Cycle has time remaining (not past deadline) | Container type ID | Shape Up (start, review, unblock, return) |

### Risk & Suitability Steps (4)

| Step | What It Checks | Used By |
|---|---|---|
| `AISuitabilityValidation` | Warns for human-review or human-only tasks started by AI | Hydro (start) |
| `RiskLevelValidation` | Risk level assessment and process requirements | Hydro (start) |
| `ApprovalRequirementValidation` | Closing transition has appropriate approval evidence | All profiles (approve/ship) |
| `ContextCompletenessValidation` | Completion context provided (what was built, decisions, interfaces) | All profiles (approve/ship) |

### Quality Gate Steps (4)

| Step | What It Checks | Parameters | Used By |
|---|---|---|---|
| `PRReviewValidation` | PR has minimum approving reviews | Min approvals count | Scrum (approve:tech-debt), configurable |
| `TestCoverageValidation` | Test coverage meets threshold from CI checks | Threshold % | Configurable |
| `SecurityScanValidation` | No critical/high security vulnerabilities | — | Configurable |
| `TaskLockValidation` | Warns if task is locked by a different agent | — | Configurable |

### Hierarchy Steps (2)

| Step | What It Checks | Used By |
|---|---|---|
| `SubtaskCompletionValidation` | All sub-issues are in terminal state before parent closes | Hydro (complete), Scrum (approve) |

### Legacy Compatibility Steps (3)

These exist for backward compatibility with pre-profile configurations:

| Step | Replaced By | Status |
|---|---|---|
| `StartFromReadyForDevValidation` | `SourceStatusValidation:READY_FOR_DEV` | Hydro-specific |
| `RefineFromBacklogValidation` | `SourceStatusValidation:BACKLOG` | Hydro-specific |
| `ReadyFromRefinementOrBacklogValidation` | `SourceStatusValidation:IN_REFINEMENT,BACKLOG` | Hydro-specific |
| `WaveAssignmentValidation` | `ContainerAssignmentValidation:wave` | Hydro-specific |
| `EpicIntegrityValidation` | `ContainerIntegrityValidation:epic-wave-integrity` | Hydro-specific |

## Parameterized Steps

Many steps accept parameters via colon-separated syntax in the profile's pipeline definition:

| Step | Parameter | Example | Effect |
|---|---|---|---|
| `SourceStatusValidation` | Expected source states | `SourceStatusValidation:READY_FOR_DEV` | Only passes if task is in Ready for Dev |
| `StatusTransitionValidation` | Target state | `StatusTransitionValidation:IN_PROGRESS` | Validates transition to In Progress |
| `ContainerAssignmentValidation` | Container type | `ContainerAssignmentValidation:wave` | Checks wave assignment |
| `ContainerSingularityValidation` | Container type | `ContainerSingularityValidation:sprint` | Checks sprint singularity |
| `ContainerIntegrityValidation` | Rule ID | `ContainerIntegrityValidation:epic-wave-integrity` | Checks specific integrity rule |
| `CircuitBreakerValidation` | Container type | `CircuitBreakerValidation:cycle` | Checks cycle time remaining |
| `PRReviewValidation` | Min approvals | `PRReviewValidation:2` | Requires 2 approving reviews |
| `TestCoverageValidation` | Threshold | `TestCoverageValidation:90` | Requires 90% coverage |

## Type-Scoped Pipelines

The Scrum profile demonstrates type-scoped pipeline overrides. When a transition is requested, the BRE checks for a type-specific pipeline first:

1. Look for `{action}:{workItemType}` (e.g., `plan:story`)
2. If not found, fall back to `{action}` (e.g., `plan`)

This enables different Definition of Ready and Definition of Done checks per work item type — User Stories need acceptance criteria, Bugs need reproduction steps, Spikes have relaxed DoD.

## Validation Results

Every BRE run returns a structured result:

```typescript
{
  valid: boolean;           // Overall pass/fail
  stepResults: [{
    stepName: string;       // "DependencyValidation"
    status: 'pass' | 'fail' | 'warn' | 'skip';
    message: string;        // Human-readable explanation
    details?: any;          // Step-specific data
    remediation?: string;   // What to do if it failed
  }];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
  };
}
```

## Dry Run

Every transition tool supports `dryRun: true`, which runs the full BRE pipeline without executing the transition:

```
validate_transition(#42, "start")
-> Runs all steps, returns results, changes nothing
```

The `validate_all_transitions` tool runs the BRE for all possible transitions on a task, showing exactly what's allowed and what's blocked — and why.

## Audit Integration

Every BRE evaluation (pass or fail) is recorded in the audit trail:

- **Pass**: Records the transition, actor, timestamp, and all step results
- **Fail**: Records the attempted transition, which steps failed, and remediation guidance
- **Skip (dry run)**: Not recorded — dry runs leave no audit trace

The compliance score uses BRE pass/fail ratios as its highest-weighted category (35-40% depending on methodology).
