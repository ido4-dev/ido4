---
title: "/synthesize-spec"
description: "Crystallize the knowledge canvas into a structured strategic spec markdown file. The composition step that produces the artifact downstream tools consume."
---

`/synthesize-spec` is the composition step. It takes the mature knowledge canvas, runs a pre-flight readiness check, reconciles source materials against the canvas to prevent content loss, and delegates the heavy reasoning to the `canvas-synthesizer` sub-agent (running on Opus, in a clean context window). The output is a strategic spec markdown file conforming to the `@ido4/spec-format` grammar.

This is a deliberate skill — invoke it when the canvas feels ready, not on a timer. The agent will tell you honestly if it isn't.

## When to use

- The canvas's **Understanding Assessment** shows depth across at least Problem, Solution, and Boundaries
- **Multiple stakeholders** have contributed (single-perspective canvases produce weaker specs)
- **Active tensions** that affect group boundaries or capability definitions have been resolved or explicitly held open as known unknowns
- **Cross-cutting concerns** have substance (if NFRs, performance targets, or security requirements came up in conversation, they should be captured before crystallization)

If any of these aren't true, the pre-flight check will say so and suggest returning to `/create-spec` to fill the gaps. You can override by insisting, but the resulting spec will reflect the canvas's weaknesses.

## Invocation

In Cowork:
```
/synthesize-spec
```

In Claude Code:
```
/ido4shape:synthesize-spec
```

No arguments. The skill uses the project name from `.ido4shape/` to derive the output filename.

## What it does

**Pre-flight readiness check.** Reads the canvas, stakeholders, decisions, and tensions files. Verifies the Understanding Assessment is deep enough, multiple perspectives are represented, structural decisions are settled, and no group-affecting tensions remain open. Refuses to synthesize a clearly-unready canvas.

**Source material reconciliation.** Scans the project folder for materials (PRDs, design docs, notes) and compares their substantive content against what's captured in the canvas. If something from your materials wasn't contradicted by conversation but also wasn't captured, the skill presents it to you: *"These items from your source materials weren't discussed — should they be included, excluded, or discussed before synthesis?"*

**Optional pre-composition review.** For specs with 4+ groups or 10+ capabilities, the skill suggests running `/review-spec` first. The dependency auditor catches structural issues that are expensive to fix after composition.

**Composition.** Delegates to the `canvas-synthesizer` sub-agent (Opus, clean context). The sub-agent reads the full workspace and produces the spec. Heavy reasoning happens there because the entire project structure needs to fit in mind simultaneously.

**Auto-validation.** After composition, the skill runs `/validate-spec` automatically. If Pass 1 (structural) reports format drift — wrong section headings, inline success conditions, missing metadata labels — the skill fixes those directly. If Pass 2 (content) flags substantive issues — thin descriptions, vague success conditions, missing stakeholder attributions — the findings go to you to decide whether to refine.

## Output

A markdown file at `{project-name}-spec.md` in your project root, with:

- **Format marker:** `> format: strategic-spec | version: 1.0`
- **Project header** with WHY, constraints, non-goals, stakeholders, cross-cutting concerns
- **Groups** (`## Group: NAME`) with priority metadata
- **Capabilities** (`### PREFIX-NN: TITLE`) under each group, with substantive description (≥200 chars with multi-stakeholder context), success conditions, priority + strategic risk + `depends_on` metadata

The format is the trust boundary with downstream tooling — `ido4 MCP` (decomposition), [`ido4specs`](../../../ido4specs/) (technical spec generation), or any consumer using `@ido4/spec-format` from npm reads the file with the same parser.

## What synthesis does NOT do

- **No effort estimates.** `effort` is a downstream metadata field, set by `ido4specs` during technical decomposition.
- **No task breakdowns.** Capabilities don't have child tasks — that's also downstream.
- **No AI-suitability flags.** No `ai: full/assisted/pair/human` fields. Strategic specs describe what to build, not how the work gets done.
- **No code references.** The strategic spec is methodology-neutral and codebase-neutral. Code grounding happens in `ido4specs`' technical canvas, not here.

## Common failures

- **Refuses to synthesize because canvas is thin.** The pre-flight check is doing its job. Return to `/create-spec` and deepen the dimensions it named. If you genuinely want to crystallize a thin canvas (e.g., for early stakeholder review), insist — but read the resulting spec critically.
- **Source materials weren't reconciled.** If you dropped a document in the project folder after the conversation had moved on, the agent might not have noticed it during its scan. Drag it into `.ido4shape/sources/` explicitly and re-run.
- **Auto-validation reports format drift.** The skill fixes Pass 1 issues directly — you shouldn't normally see these. If a fix is genuinely ambiguous (e.g., a circular dependency where the correct direction isn't clear from context), the skill stops and asks.

## Related

- [`/create-spec`](../create-spec/) — the discovery skill that builds the canvas
- [`/review-spec`](../review-spec/) — independent multi-lens reviewers, useful before synthesis
- [`/validate-spec`](../validate-spec/) — runs automatically after synthesis; can also be invoked standalone
- [`/refine-spec`](../refine-spec/) — natural-language edits to the synthesized spec
