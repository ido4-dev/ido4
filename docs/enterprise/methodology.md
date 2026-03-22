# Configurable Methodology

ido4 is methodology-agnostic. The governance engine reads methodology profiles that define everything: states, transitions, containers, integrity rules, validation pipelines, principles, and compliance scoring. Three built-in profiles ship with ido4, and teams can create custom profiles through inheritance.

## Built-in Profiles

| Profile | ID | Tools | Key Feature |
|---|---|---|---|
| **Hydro | 58 | Wave-based governance with epic integrity |
| **Scrum** | `scrum` | 56 | Sprint-based with type-scoped pipelines |
| **Shape Up** | `shape-up` | 53 | Fixed time, variable scope, circuit breaker |

Select during initialization:

```
init_project({ mode: "create", repository: "org/repo", methodology: "scrum" })
```

This writes `.ido4/methodology-profile.json`:

```json
{
  "id": "scrum",
  "extends": "scrum"
}
```

## Profile Inheritance

Custom profiles extend a built-in profile and override only what they need:

```json
{
  "extends": "hydro",
  "id": "my-enterprise-hydro",
  "name": "Enterprise Hydro",
  "pipelines": {
    "approve": {
      "steps": [
        "StatusTransitionValidation:DONE",
        "ApprovalRequirementValidation",
        "ContextCompletenessValidation",
        "PRReviewValidation:2",
        "TestCoverageValidation:90",
        "SecurityScanValidation",
        "ContainerIntegrityValidation:epic-wave-integrity"
      ]
    }
  }
}
```

This inherits everything from the Hydro profile but replaces the `approve` pipeline with a stricter version requiring 2 PR reviewers, 90% test coverage, and security scan clearance.

### What Can Be Overridden

| Section | Override Effect |
|---|---|
| `states` | Replace the entire state machine |
| `transitions` | Replace all transition definitions |
| `containers` | Replace container type definitions |
| `integrityRules` | Replace integrity rule set |
| `principles` | Replace principle definitions |
| `pipelines` | Override individual pipelines (merge with base) |
| `compliance` | Override lifecycle and weights |
| `behaviors` | Override closing transitions, block/return |
| `workItems` | Override work item types |

### Pipeline Override Behavior

Pipeline overrides are **per-key** — specifying `"approve"` in your custom profile replaces only the approve pipeline. All other pipelines inherit from the base profile.

## What the Profile Controls

### Dynamic Tool Generation

MCP tools are generated from the profile at server startup:
- Transition tools from `transitions` (e.g., `shape_task` only exists for Shape Up)
- Container tools from `containers` (e.g., `list_waves` for Hydro, `list_sprints` for Scrum)
- The exact tool count depends on the profile

### Dynamic Prompt Generation

Prompts use the profile's terminology:
- Hydro prompts reference Waves, Epics, and the 5 Principles
- Scrum prompts reference Sprints, DoR/DoD, and Sprint Goals
- Shape Up prompts reference Cycles, Bets, Appetite, and the Circuit Breaker

### BRE Pipeline Assembly

The validation pipeline for each transition is assembled from the profile's `pipelines` section. Steps are parameterized:

```json
"start": {
  "steps": [
    "SourceStatusValidation:READY_FOR_DEV",
    "SpecCompletenessValidation",
    "StatusTransitionValidation:IN_PROGRESS",
    "DependencyValidation",
    "ContainerAssignmentValidation:wave",
    "ContainerSingularityValidation:wave",
    "AISuitabilityValidation",
    "RiskLevelValidation",
    "ContainerIntegrityValidation:epic-wave-integrity"
  ]
}
```

### Compliance Scoring

Each profile defines its own compliance weights:

| Category | Hydro | Scrum | Shape Up |
|---|---|---|---|
| BRE Pass Rate | 40% | 40% | 35% |
| Quality Gates | 20% | 25% | 25% |
| Process Adherence | 20% | 25% | 20% |
| Container Integrity | 10% | — | 10% |
| Flow Efficiency | 10% | 10% | 10% |

## Example: Enterprise Configurations

### Strict Enterprise (Regulated Industry)

Maximum governance — every quality gate enforced:

```json
{
  "extends": "hydro",
  "id": "enterprise-strict",
  "pipelines": {
    "start": {
      "steps": [
        "SourceStatusValidation:READY_FOR_DEV",
        "SpecCompletenessValidation",
        "StatusTransitionValidation:IN_PROGRESS",
        "DependencyValidation",
        "ContainerAssignmentValidation:wave",
        "ContainerSingularityValidation:wave",
        "AISuitabilityValidation",
        "RiskLevelValidation",
        "ContainerIntegrityValidation:epic-wave-integrity",
        "TaskLockValidation"
      ]
    },
    "approve": {
      "steps": [
        "StatusTransitionValidation:DONE",
        "ApprovalRequirementValidation",
        "ContextCompletenessValidation",
        "PRReviewValidation:2",
        "TestCoverageValidation:90",
        "SecurityScanValidation",
        "SubtaskCompletionValidation",
        "ContainerIntegrityValidation:epic-wave-integrity"
      ]
    }
  }
}
```

### Lightweight Startup

Minimal governance — fast execution, basic guards:

```json
{
  "extends": "scrum",
  "id": "startup-light",
  "pipelines": {
    "plan": {
      "steps": ["SourceStatusValidation:BACKLOG", "StatusTransitionValidation:SPRINT"]
    },
    "start": {
      "steps": ["SourceStatusValidation:SPRINT", "StatusTransitionValidation:IN_PROGRESS", "DependencyValidation"]
    },
    "approve": {
      "steps": ["StatusTransitionValidation:DONE"]
    }
  }
}
```

### Shape Up with Mandatory Context

Shape Up with required completion context on every ship:

```json
{
  "extends": "shape-up",
  "id": "shape-up-documented",
  "pipelines": {
    "ship": {
      "steps": [
        "StatusTransitionValidation:SHIPPED",
        "ApprovalRequirementValidation",
        "ContextCompletenessValidation",
        "PRReviewValidation:1"
      ]
    }
  }
}
```

## 32 Available Validation Steps

All steps are available for composition in custom profiles. See the [Business Rule Engine](../concepts/business-rule-engine.md) documentation for the complete step reference with parameters.
