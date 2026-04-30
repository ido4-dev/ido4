---
title: "/validate-spec"
description: "Phase 3 (deterministic): runs the bundled tech-spec parser plus a battery of content assertions, returns PASS / PASS WITH WARNINGS / FAIL with intelligent error interpretation."
---

`/validate-spec` is the deterministic half of the two-layer review pattern. It runs the bundled `@ido4/tech-spec-format` parser, then applies a battery of content assertions. Returns a verdict (PASS / PASS WITH WARNINGS / FAIL) with specific findings.

It pairs with [`/review-spec`](./review-spec/), which applies qualitative LLM judgment over the same artifact. Both run quickly (~2–5 min each) and surface different kinds of issues — run both before treating the spec as ingestion-ready.

## When to use

- After `/synthesize-spec` produced a fresh technical spec
- After `/refine-spec` made edits (the refine skill auto-revalidates, but you may want a thorough verdict)
- Periodically during long pipeline work, as a structural sanity check
- Before handing the spec downstream (to `ido4dev` or any other tool)

## Invocation

```
/validate-spec <path-to-tech-spec.md>
```

The argument is the technical spec path (typically `specs/your-tech-spec.md`). The skill stops with a usage hint if no argument is given; it won't auto-search for spec files.

## What it does

Two passes:

### Pass 1 — structural validation (parser-driven)

Runs `@ido4/tech-spec-format`'s parser. Returns errors and warnings. Common error types:

- **Heading patterns** — capability headings must match `## Capability: NAME-NN: Title`; task headings match `### NAME-NNA: Title`
- **Ref format** — task refs match the regex `[A-Z]{2,5}-\d{2,3}[A-Z]?` (e.g., `WHF-01`, `STOR-03A`, `PLAT-001B`). Lowercase or non-zero-padded refs fail.
- **Metadata keys + values** — `effort`, `risk`, `type`, `ai`, `depends_on` only; values from the allowed sets only
- **Dependency graph integrity** — every `depends_on` reference must point to an existing task ref; no circular dependencies
- **Format marker** — the `> format: tech-spec | version: 1.0` line must be present and correctly placed

If Pass 1 fails, the skill reports the first 3 errors verbatim and suggests `/refine-spec` to fix them. Pass 2 doesn't run.

### Pass 2 — content assertions

Applies a battery of quality assertions against the parsed structure:

- Project header has its WHY (why we're building this), constraints, non-goals, and stakes
- Tasks are code-grounded — descriptions reference paths or modules
- Effort traces back to the canvas's complexity assessment (no surprise XL on what the canvas called "low complexity")
- Risk reflects real unknowns rather than blanket-medium
- AI calibration is honest — external integrations rarely warrant `full`; compliance work warrants `pair` or `human`
- Success conditions are independently verifiable
- Stakeholder attributions preserved from the strategic spec
- Dependency graph is sensible — no cycles, infrastructure precedes consumers, capability sub-tasks have predictable patterns
- Capability coherence — 1–8 tasks per capability. Single-task capabilities are fine for M-effort or larger work; large capabilities should split.

The skill **interprets findings intelligently** rather than relaying raw parser output. If a `depends_on` points to a non-existent task, it suggests likely correct targets. If there's a cycle, it identifies which edge to reverse.

## Output

A formatted report with:

- **Verdict**: PASS / PASS WITH WARNINGS / FAIL
- **Errors** (FAIL or PASS WITH WARNINGS only) — specific blocking issues with task/line refs
- **Warnings** (PASS WITH WARNINGS only) — non-blocking quality issues
- **Suggestions** — non-blocking improvements
- **Format issues resolved** — any structural fixes the parser handled automatically (rare)
- **Next step** — recommended action given the verdict
- **Supporting metrics** — capability/task/dependency counts, max depth, root tasks, distribution stats

If a finding has an actionable fix (typo in a ref, missing `depends_on` target, etc.), the skill names it specifically. You can address findings via [`/refine-spec`](./refine-spec/) or treat them as informational.

## Verdict meanings

- **PASS** — clean structurally and content-wise. Ready for downstream ingestion.
- **PASS WITH WARNINGS** — structurally valid (no errors blocking ingestion), but content checks flagged things. Typical warnings: a task with description shorter than 200 chars, a single-task S-effort capability that might be over-decomposed, an `ai: full` task for an external integration. You can ingest with caveats or fix via `/refine-spec`.
- **FAIL** — structural errors blocking ingestion. Cannot proceed to downstream. Fix via `/refine-spec` and re-validate.

## Common failures

- **Validator not found in plugin data.** The bundled validator binaries weren't copied to `${CLAUDE_PLUGIN_DATA}` by the SessionStart hook. Start a fresh Claude Code session to retrigger the hook, or run `/doctor` for a full diagnostic.
- **Strategic spec passed instead of tech spec.** The skill checks the format marker — if it sees `format: strategic-spec`, it stops and points you at `/ido4shape:review-spec` (the strategic-spec equivalent).

For deeper troubleshooting, see the [FAQ + troubleshooting](../faq/) page.

## Related

- [Phase 3 in the walkthrough](../how-it-works/#phase-3--review-and-validate) — narrative context
- [`/review-spec`](./review-spec/) — the qualitative half of Phase 3
- [`/refine-spec`](./refine-spec/) — fix findings via natural-language edits
- [`@ido4/tech-spec-format`](https://github.com/ido4-dev/ido4/tree/main/packages/tech-spec-format) — the parser package on npm
