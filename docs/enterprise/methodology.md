# Configurable Methodology

ido4 ships with wave-based development as the default methodology, but the BRE pipeline is fully configurable. Teams can adopt ido4 with their existing process (Scrum, Kanban, SAFe) while getting deterministic enforcement.

## Configuration File

Create `.ido4/methodology.json` in your project root:

```json
{
  "name": "my-methodology",
  "transitions": {
    "start": {
      "steps": [
        "StartFromReadyForDev",
        "StatusTransition",
        "Dependency",
        "WaveAssignment",
        "AISuitability",
        "RiskLevel",
        "EpicIntegrity",
        "TaskLock"
      ]
    },
    "review": {
      "steps": [
        "StatusTransition",
        "RequiredFields"
      ]
    },
    "approve": {
      "steps": [
        "StatusTransition",
        "PRReview:minApprovals=2",
        "TestCoverage:threshold=80",
        "SecurityScan"
      ]
    },
    "block": {
      "steps": ["StatusTransition"]
    },
    "unblock": {
      "steps": ["StatusTransition"]
    },
    "return": {
      "steps": ["StatusTransition", "BackwardTransition"]
    },
    "refine": {
      "steps": ["StatusTransition"]
    },
    "ready": {
      "steps": ["StatusTransition"]
    }
  },
  "principles": {
    "epicIntegrity": true,
    "activeWaveSingularity": true,
    "dependencyCoherence": true,
    "selfContainedExecution": true,
    "atomicCompletion": true
  }
}
```

## Parameterized Steps

Some validation steps accept parameters via colon-separated syntax:

| Step | Parameter | Default | Example |
|---|---|---|---|
| `PRReview` | `minApprovals` | 1 | `PRReview:minApprovals=3` |
| `TestCoverage` | `threshold` | 80 | `TestCoverage:threshold=90` |

## Built-in Validation Steps

All 27 steps are available for composition:

### Workflow
- `StartFromReadyForDev` — Task must be in Ready for Dev
- `StatusTransition` — Valid state machine transition
- `RequiredFields` — Required fields are populated
- `BackwardTransition` — Valid return target status

### Dependencies
- `Dependency` — All dependencies are Done
- `DependencyCompletion` — No blocked downstream tasks

### Governance
- `WaveAssignment` — Task in active wave
- `EpicIntegrity` — Epic tasks in same wave
- `ActiveWaveSingularity` — Single active wave

### Quality
- `PRReview` — PR has approving reviews
- `TestCoverage` — Coverage meets threshold
- `SecurityScan` — No critical vulnerabilities
- `TaskLock` — Warns if locked by another agent

### Risk
- `AISuitability` — AI suitability assessment
- `RiskLevel` — Risk level enforcement

## Default Methodology

If no `.ido4/methodology.json` exists, ido4 uses the built-in `DEFAULT_METHODOLOGY` — the full wave-based governance pipeline with all steps enabled. The default is backward-compatible and requires no configuration.

## Adapting to Your Process

### Lightweight (Startups)

Minimal governance — fast execution, basic guards:

```json
{
  "transitions": {
    "start": { "steps": ["StatusTransition", "Dependency"] },
    "approve": { "steps": ["StatusTransition"] }
  },
  "principles": {
    "epicIntegrity": false,
    "activeWaveSingularity": false,
    "dependencyCoherence": true
  }
}
```

### Strict (Enterprise / Regulated)

Maximum governance — every quality gate enforced:

```json
{
  "transitions": {
    "start": {
      "steps": ["StatusTransition", "Dependency", "WaveAssignment", "EpicIntegrity", "TaskLock", "AISuitability", "RiskLevel"]
    },
    "approve": {
      "steps": ["StatusTransition", "PRReview:minApprovals=2", "TestCoverage:threshold=90", "SecurityScan", "DependencyCompletion"]
    }
  },
  "principles": {
    "epicIntegrity": true,
    "activeWaveSingularity": true,
    "dependencyCoherence": true,
    "selfContainedExecution": true,
    "atomicCompletion": true
  }
}
```
