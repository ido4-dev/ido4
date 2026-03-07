# Business Rule Engine (BRE)

The Business Rule Engine is the core of ido4's governance. It's a composable validation pipeline that evaluates every task state transition against a set of deterministic rules. The BRE runs real TypeScript code — not LLM instructions, not YAML configuration interpreted by an AI. Real code with real results.

## How It Works

When a task transition is requested (e.g., "start task #42"), the BRE:

1. Loads the validation steps configured for that transition type
2. Runs each step sequentially, collecting results
3. Returns a structured result with per-step pass/fail/warn details
4. Blocks the transition if any step fails (unless `skipValidation` is explicitly used)

```
start_task(#42)
  ↓
┌─────────────────────────────┐
│ BRE Pipeline for "start"    │
│                             │
│ 1. StartFromReadyForDev  ✓  │
│ 2. StatusTransition      ✓  │
│ 3. DependencyValidation  ✓  │
│ 4. WaveAssignment        ✓  │
│ 5. AISuitability         ⚠  │
│ 6. RiskLevel             ✓  │
│ 7. EpicIntegrity         ✓  │
│                             │
│ Result: PASS (1 warning)    │
└─────────────────────────────┘
  ↓
Status updated: Ready for Dev → In Progress
Audit event recorded
```

## The 27 Built-in Validation Steps

### Workflow Steps

| Step | Transitions | What It Checks |
|---|---|---|
| `StartFromReadyForDevValidation` | start | Task is in Ready for Dev status |
| `StatusTransitionValidation` | all | From/to status is a valid state machine path |
| `RequiredFieldsValidation` | start, review | Required fields are populated |

### Dependency Steps

| Step | Transitions | What It Checks |
|---|---|---|
| `DependencyValidation` | start | All dependency tasks are in Done status |
| `DependencyCompletionValidation` | approve | No downstream tasks are actively blocked |

### Governance Steps

| Step | Transitions | What It Checks |
|---|---|---|
| `WaveAssignmentValidation` | start | Task belongs to the currently active wave |
| `EpicIntegrityValidation` | start, assign | Epic tasks are all in the same wave |
| `ActiveWaveSingularityValidation` | start | Only one wave is active |
| `BackwardTransitionValidation` | return | Return target is a valid backward status |

### Quality Gate Steps

| Step | Transitions | What It Checks |
|---|---|---|
| `PRReviewValidation` | approve | PR has minimum number of approving reviews |
| `TestCoverageValidation` | approve | Test coverage meets threshold (from CI checks) |
| `SecurityScanValidation` | approve | No critical/high security vulnerabilities |
| `TaskLockValidation` | start | Warns if task is locked by a different agent |

### Risk & Suitability Steps

| Step | Transitions | What It Checks |
|---|---|---|
| `AISuitabilityValidation` | start, review | AI suitability level (warns for human-review items) |
| `RiskLevelValidation` | start | Risk level assessment and process requirements |

## Configurable Pipeline

The BRE pipeline is fully configurable via `.ido4/methodology.json`. Each transition type maps to an ordered list of validation steps:

```json
{
  "transitions": {
    "start": {
      "steps": [
        "StartFromReadyForDev",
        "StatusTransition",
        "Dependency",
        "WaveAssignment",
        "AISuitability",
        "RiskLevel",
        "EpicIntegrity"
      ]
    },
    "approve": {
      "steps": [
        "StatusTransition",
        "PRReview:minApprovals=2",
        "TestCoverage:threshold=80",
        "SecurityScan"
      ]
    }
  }
}
```

### Parameterized Steps

Some steps accept parameters via colon-separated syntax:

- `PRReview:minApprovals=2` — Require 2 approving PR reviews
- `TestCoverage:threshold=80` — Require 80% test coverage
- `SecurityScan` — Block on any critical/high vulnerability

### Custom Validation Steps

The `IValidationStepRegistry` allows registering custom steps:

```typescript
registry.register('CustomCheck', (params) => ({
  name: 'CustomCheck',
  validate: async (context) => {
    // Your validation logic
    return { valid: true, message: 'Check passed' };
  }
}));
```

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
→ Runs all 7 steps, returns results, changes nothing
```

The `validate_all_transitions` tool runs the BRE for all 9 possible transitions on a task, showing exactly what's allowed and what's blocked — and why.

## Audit Integration

Every BRE evaluation (pass or fail) is recorded in the audit trail:

- **Pass**: Records the transition, actor, timestamp, and all step results
- **Fail**: Records the attempted transition, which steps failed, and remediation guidance
- **Skip (dry run)**: Not recorded — dry runs leave no audit trace

The compliance score uses BRE pass/fail ratios as its highest-weighted category (40%).
