---
title: "/create-spec"
description: "Phase 1 of the ido4specs pipeline: parse a strategic spec, explore the codebase or integration targets, produce a per-capability technical canvas."
---

`/create-spec` is the entry point. It reads your strategic spec, explores the relevant codebase (or integration targets in greenfield mode), and produces a **technical canvas** — a per-capability markdown artifact that grounds each capability in real file paths, patterns, and discovered architecture.

The canvas is the **context-preservation layer** for the rest of the pipeline. Phase 2 (`/synthesize-spec`) reads ONLY the canvas, not your original strategic spec, so the canvas needs to carry forward everything Phase 2 will need: stakeholder attributions, success conditions, cross-cutting constraints, integration target findings.

## When to use

- Starting a fresh pipeline run — you have a strategic spec and want a technical spec
- After updating the strategic spec — re-running produces a fresh canvas reflecting the new spec
- Investigating spec → codebase fit — the canvas's "Discoveries & Adjustments" section surfaces gaps and surprises

Do NOT use this skill to update an existing technical spec — use [`/refine-spec`](./refine-spec/) for that.

## Invocation

```
/create-spec <path-to-strategic-spec.md>
```

The argument is a path to your strategic spec — typically `specs/your-strategic-spec.md` or `your-strategic-spec.md` at the project root.

If you invoke without an argument, the skill prints a usage hint and stops. It will not auto-search for spec files.

## Stages

The skill runs in five stages and reports progress at each boundary:

| Stage | What it does | Typical duration |
|---|---|---|
| **0. Parse strategic spec** | Validates the spec via `@ido4/spec-format`. Reports project name, capability count, dependency structure, cross-cutting concerns. Stops on parse errors. | < 1 sec |
| **0.5. Detect mode + create artifact dir** | Detects `existing` / `greenfield-with-context` / `greenfield-standalone` mode. Creates `specs/` if needed. | < 1 sec |
| **1a. Explore (parallel)** | Spawns parallel `Explore` subagents on the codebase or integration targets. Each subagent gets a focused brief and returns concrete findings. | 1–3 min |
| **1b–1c. Synthesize the canvas** | Reads the strategic spec text directly (verbatim context preservation). Composes per-capability technical canvas. | 10–25 min |
| **1d. Verify** | Counts `## Capability:` sections in the written canvas. Must match the strategic capability count exactly. | < 1 sec |

Total wall time: typically 15–30 minutes for a 30+ capability strategic spec, dominated by Stage 1c (the synthesis is the heavy lift).

## Output

A markdown file at `specs/{spec-name}-tech-canvas.md` (where `{spec-name}` is derived from your strategic spec's filename — `your-strategic-spec.md` produces `your-tech-canvas.md`).

The canvas typically lands at 2,000–3,000 lines. It contains:

- **Project Context** + **Ecosystem Architecture** (project mode-specific framing)
- **Tech Stack Decisions** + **Architecture Projection**
- **Cross-Cutting Concern Mapping** (per concern, what's provided / what's built)
- **One `## Capability:` section per strategic capability**, with: Strategic Context (verbatim), Cross-Cutting Constraints, Integration Target Analysis, Patterns to Follow, Architecture Context, What's Provided vs What's Built, Code-Level Dependencies Discovered, Complexity Assessment
- **Risk Assessment Summary** (per-capability risk table)
- **What Exists vs What's Built** (project-level rollup)
- **Discoveries & Adjustments** (shared infrastructure, dependency-order adjustments, surprises, research-task candidates)

After Stage 1d completes, the skill stops at the canvas — it does NOT auto-invoke `/synthesize-spec`. You review the canvas, then invoke Phase 2 manually.

## Common failures

- **Spec parse errors at Stage 0.** The strategic spec doesn't match the `@ido4/spec-format` grammar. Fix the spec in your authoring tool and re-run. Run `node "${CLAUDE_PLUGIN_DATA}/spec-validator.js" your-spec.md` directly for the parser's exact diagnostic.
- **Capability count mismatch at Stage 1d.** The canvas was written but doesn't have the right number of `## Capability:` sections — the synthesis was incomplete (truncated, output budget hit, etc.). Re-run the skill.
- **Filesystem search for the agent template.** Occasionally the skill spends extra time looking for the canvas template file. Doesn't block the run, just adds latency. Resolves on its own.

For deeper troubleshooting, see the [FAQ + troubleshooting](../faq/) page.

## Related

- [Phase 1 in the walkthrough](../how-it-works/#phase-1--create-spec) — the same content with more narrative context
- [`/synthesize-spec`](./synthesize-spec/) — Phase 2, reads the canvas and produces the technical spec
- [Get started](../get-started/) — install + prerequisites + first run
