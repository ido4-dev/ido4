---
title: "/ido4dev:spec-validate"
---

The spec-validate skill runs pre-ingestion validation on a technical spec artifact, checking format compliance and content quality before feeding it into the ingestion pipeline.

## What It Does

`/ido4dev:spec-validate path/to/technical-spec.md` performs two stages of validation:

### Stage 1: Format Compliance

- Verifies the spec follows the `## Capability:` / `### PREFIX-NN:` heading pattern
- Checks all required metadata fields are present (effort, risk, type, ai for tasks; size, risk for capabilities)
- Validates metadata values are in allowed sets
- Ensures `depends_on` references point to existing task IDs
- Runs circular dependency detection on the dependency graph
- Verifies success conditions are present for each task

### Stage 2: Content Quality

- Checks task descriptions meet minimum length (>= 200 characters)
- Assesses description quality: does it contain implementation guidance, not just titles?
- Checks success conditions are specific and verifiable
- Flags tasks with `ai: human` that lack explanation of why human involvement is needed
- Validates effort/risk consistency (e.g., S-effort task with critical risk is suspicious)

## Output

The skill produces a structured validation report:

```
Spec Validation: Real-time Notification System
  Format: 12/12 checks passed
  Content: 10/12 checks passed, 2 warnings

  Warnings:
  - NCO-03 (Routing Engine): Description references "user preferences"
    but depends_on doesn't include PRF-01. Missing dependency?
  - EML-03 (Bounce Handler): risk=medium but effort=S — verify
    webhook integration complexity is genuinely small

  Ready for ingestion: YES (with warnings)
```

## When to Use

- After the technical spec writer produces a spec (as part of `/ido4dev:decompose`)
- When manually authoring a technical spec
- Before running `ingest_spec` to catch issues early
- As a quality gate in the decomposition pipeline

## Metadata Reference

### Task Metadata

| Field | Values | Required |
|---|---|---|
| `effort` | S, M, L, XL | Yes |
| `risk` | low, medium, high, critical | Yes |
| `type` | feature, bug, research, infrastructure | Yes |
| `ai` | full, assisted, pair, human | Yes |
| `depends_on` | Comma-separated IDs, or `-` for none | Yes |

### Capability Metadata

| Field | Values | Required |
|---|---|---|
| `size` | S, M, L, XL | Yes |
| `risk` | low, medium, high, critical | Yes |

## Related

- [/ido4dev:decompose](decompose.md) — Full decomposition pipeline (includes validation)
- [Tool Reference: ingest_spec](../reference/tools.md) — The ingestion tool that consumes validated specs
