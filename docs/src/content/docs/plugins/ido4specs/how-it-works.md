---
title: "How it works"
description: "Detailed walkthrough of the ido4specs pipeline — what each phase does, what artifacts are produced, what you review at each checkpoint."
---

This page walks through the three phases of the `ido4specs` pipeline in detail. For the high-level picture and the diagram, see the [Overview](./).

## Before you start

You need a **strategic spec**. That's a markdown document describing capabilities (what should exist), success conditions, dependencies, and cross-cutting concerns. The author is a product owner, founder, lead engineer, or anyone with a clear picture of what the work involves.

If you don't have one yet, [`ido4shape`](https://github.com/ido4-dev/ido4shape) is the upstream plugin that helps you write it through Socratic conversation. It's the natural pair for `ido4specs`. But any markdown spec following the format will work — `ido4specs` ships an example fixture you can use as a template.

You also need [Claude Code](https://www.anthropic.com/claude-code) installed. `ido4specs` is a Claude Code plugin and runs entirely as skills inside it.

**Quick health check.** Once installed, run `/doctor` to confirm everything's in place. It reports plugin version, validator versions, checksums, and the next sensible action given your workspace state. Run it any time something feels off.

**The typical flow at a glance:**

```bash
# 1. Read the spec, explore code, produce canvas
/create-spec specs/your-strategic-spec.md

# (review the canvas, then:)

# 2. Decompose canvas into tasks
/synthesize-spec specs/your-tech-canvas.md

# (review the tech spec, then:)

# 3. Cross-check with both review layers
/review-spec   specs/your-tech-spec.md     # qualitative
/validate-spec specs/your-tech-spec.md     # deterministic

# (if either review surfaced findings:)

# 3+. Apply edits + re-validate
/refine-spec specs/your-tech-spec.md
```

Each phase is detailed below.

## Phase 1 — `/create-spec`

You invoke:

```
/create-spec specs/your-strategic-spec.md
```

The skill runs in stages and reports progress as it goes:

**Stage 0 — Parse the strategic spec.** Validates the spec against the bundled `@ido4/spec-format` parser. Reports project name, capability count by group, dependency structure, and cross-cutting concerns. Stops here if the spec has parse errors — you fix them in your spec authoring tool, then re-run.

**Stage 0.5 — Detect project mode and create the artifact directory.** Three modes: `existing` (your project already has source code), `greenfield-with-context` (no code yet, but the spec references integration targets like a sibling plugin or external API), or `greenfield-standalone` (truly green field, no targets). Creates a `specs/` directory if one doesn't exist.

**Stage 1a — Explore.** Spawns parallel `Explore` subagents on your codebase (or integration targets in greenfield-with-context mode). Each subagent gets a focused brief and returns concrete findings: file paths, patterns, conventions, anything relevant to the spec's capabilities. You'll see something like *"Done (22 tool uses · 79.9k tokens · 1m 40s)"* — the heavy lifting in this phase.

**Stage 1b–1c — Synthesize the canvas.** Reads the strategic spec text directly (for verbatim context preservation), composes a per-capability technical canvas. Each capability section has: strategic context (preserved from the original spec), cross-cutting constraints, integration target analysis, patterns to follow, architecture context, what's provided vs what's built, code-level dependencies discovered, complexity assessment.

**Stage 1d — Verify.** Counts `## Capability:` sections in the written canvas; must match the strategic capability count exactly. Mismatch means the canvas is incomplete and you'll want to re-run.

The canvas typically lands at 2,000–3,000 lines for a 30+ capability strategic spec. It's the **context-preservation layer** for the rest of the pipeline — Phase 2 reads ONLY the canvas, not your original strategic spec, so the canvas needs to carry forward everything Phase 2 will need.

You'll review the canvas, then invoke Phase 2.

## Phase 2 — `/synthesize-spec`

Pure transform: canvas in, technical spec out. No codebase exploration.

```
/synthesize-spec specs/your-tech-canvas.md
```

The skill decomposes each capability in the canvas into right-sized **tasks**. For each task:
- **Effort**: S / M / L / XL — grounded in the complexity assessment from the canvas, not guessed
- **Risk**: low / medium / high / critical
- **Type**: feature / bug / research / infrastructure
- **AI suitability**: full / assisted / pair / human — reflecting how much the work can be automated
- **`depends_on`**: explicit dependency list, references task IDs that exist in the spec
- **Description**: ≥ 200 characters, code-grounded, references file paths and patterns
- **Success conditions**: at least 2 per task, each independently verifiable

The output is a markdown file with the format marker `> format: tech-spec | version: 1.0` at the top — so any consumer can identify it as a technical spec parseable by `@ido4/tech-spec-format`. Stage 1d auto-runs that bundled parser before returning, catching structural drift immediately.

You'll see end-of-phase metrics: capability count, task count, dependency edges, max dependency depth, root tasks (the ones with no upstream deps — those can begin in parallel). Plus a cross-sell suggestion to run Phase 3.

## Phase 3 — review and validate

Two skills, two layers, designed to cross-check each other.

### `/validate-spec` — deterministic content checks

Runs the bundled `@ido4/tech-spec-format` parser, then applies a battery of content assertions:

- Project header has its WHY, constraints, non-goals, and stakes
- Tasks are code-grounded — descriptions reference paths or modules
- Effort traces to canvas complexity
- Risk reflects real unknowns
- AI calibration is honest (external integrations rarely warrant `full`)
- Success conditions are independently verifiable
- Stakeholder attributions preserved
- Dependency graph is sensible (no cycles, sane topology)
- Capability coherence — 1–8 tasks per capability, scoped together

Verdict: **PASS** / **PASS WITH WARNINGS** / **FAIL**. The skill interprets parser errors intelligently — broken deps suggest the correct target, cycles identify which edge to reverse — instead of relaying raw parser output.

### `/review-spec` — qualitative LLM judgment

Reads the spec content and produces a **Spec Review Report**:
- Errors (will block ingestion if present)
- Warnings (won't fail ingestion but indicate quality issues)
- Suggestions (non-blocking improvements)
- Downstream notes (informational signals about `ai: human`, `risk: critical`, dependency density)
- Dependency graph (root tasks, critical path, cross-capability deps, hub tasks)

Where `validate-spec` is fast and deterministic, `review-spec` catches what the parser can't:
- Missing dependencies named in description text but not declared in `depends_on`
- Sibling-pattern inconsistencies (e.g., one task uses `size: S` where its peers use `size: M` for similar work)
- Hub-task identification (which tasks block the most others?)
- Narrative-grade quality (is the description code-grounded enough that an engineer could pick it up?)

Both skills mention each other and `/refine-spec` in their end messages, so you can pick the next move based on findings.

## Refining the spec

If the reviews surface issues:

```
/refine-spec specs/your-tech-spec.md
```

The skill takes natural-language instructions ("apply W1 and W2", "split capability X", "change ai: full to ai: assisted on Y") and applies surgical edits via the `Edit` tool. After every edit pass it re-runs the bundled parser to catch structural regressions — if you accidentally introduce a dependency cycle, it tells you immediately rather than at the next `validate-spec`.

The skill announces the plan before editing. For complex refines (splitting capabilities, large dependency rewrites) it surfaces ripple effects upfront so you can confirm scope.

## What you do with the result

You have a technical spec at `specs/your-tech-spec.md`. It's plain markdown that any downstream tool can read.

The natural pair is [`ido4dev`](https://github.com/ido4-dev/ido4dev), which ingests the spec into GitHub issues — capabilities become parent issues, tasks become sub-issues with the metadata mapped to GitHub Projects custom fields. But the format is open. Read the file with your own tooling, parse it with `@ido4/tech-spec-format` from npm, paste it into your team's wiki, generate Jira tickets — your call.

The traceability comes for free. Every task ID maps back to the strategic capability it came from, which maps back to the strategic spec the author wrote. When engineering asks *"why are we building this?"* six weeks later, the chain is intact.

## Practical tips

- **Expect a permission prompt or two on first run.** The validator is invoked via Node.js, and Claude Code asks before running new binaries. Pick "Yes, don't ask again for: `node *`" if you want a smooth flow on subsequent runs.
- **Phase 1 is the long stage.** 15–30 minutes for 30+ capability specs is normal — codebase exploration is the bulk of it. Token count flowing means progress is real; if it stalls completely, cancel and retry.
- **Read the canvas before Phase 2.** Phase 2 reads ONLY the canvas, so anything missing from the canvas won't be in the tech spec. Spend 5 minutes reviewing the canvas's "Discoveries & Adjustments" section and risk hot-spots.
- **Both review layers, not just one.** `/validate-spec` and `/review-spec` catch different things. Run both before treating the spec as ingestion-ready.
- **`/doctor` answers "is the plugin healthy?"** Run it any time something seems off. Reports plugin version, validator versions, checksums, workspace state, and the next pipeline action.
- **Skill boundaries are checkpoints.** Nothing auto-progresses. If you take a break, you pick back up by invoking the next phase's skill against the artifact the prior phase produced.
