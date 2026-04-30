---
title: "/synthesize-spec"
description: "Phase 2 of the ido4specs pipeline: pure transform from technical canvas to technical spec, with auto-validation."
---

`/synthesize-spec` is a pure transform: canvas in, technical spec out. **No codebase exploration** — Phase 1 already did that work and grounded the canvas. This skill decomposes each capability in the canvas into right-sized implementation tasks with metadata, dependencies, and code-verifiable success conditions.

The output is a markdown file in the format the bundled `@ido4/tech-spec-format` parser consumes — meaning any downstream tool that knows the format can ingest it (`ido4dev`, custom tooling, your team's PM stack).

## When to use

- After Phase 1 — you've reviewed the canvas and want to produce the technical spec
- Re-running after a canvas regeneration (e.g., the strategic spec changed and you re-ran `/create-spec`)

Do NOT use this skill to edit an existing technical spec — use [`/refine-spec`](./refine-spec/).

## Invocation

```
/synthesize-spec <path-to-tech-canvas.md>
```

The argument is the canvas path produced by Phase 1 (typically `specs/your-tech-canvas.md`). If the canvas file is missing or doesn't have the expected structure, the skill stops and tells you what's missing.

## What it does

The skill reads the canvas and decomposes each capability into tasks. For each task it sets:

- **Effort**: S / M / L / XL — grounded in the canvas's complexity assessment, not guessed
- **Risk**: low / medium / high / critical
- **Type**: feature / bug / research / infrastructure
- **AI suitability**: full / assisted / pair / human — reflecting how much of the work can be automated. External integrations rarely warrant `full`; security/compliance work is typically `pair` or `human`
- **`depends_on`**: explicit list of task refs (in the form `[A-Z]{2,5}-\d{2,3}[A-Z]?`) that this task depends on
- **Description**: ≥ 200 characters, code-grounded, references file paths and patterns from the canvas
- **Success conditions**: at least 2 per task, each independently verifiable

Stage 1d of the skill **auto-runs the bundled `tech-spec-validator.js`** against the written file before returning. This catches structural drift immediately — if the parser fails, the skill reports the errors instead of claiming success.

Wall time: typically 10–20 minutes for a 30+ capability canvas.

## Output

A markdown file at `specs/{spec-name}-tech-spec.md` (mirroring the canvas naming).

The file's first lines include the format marker so downstream tools can identify it:

```
> format: tech-spec | version: 1.0
```

Followed by capability sections (`## Capability: NAME-NN: Title`) each containing tasks (`### NAME-NNA: Title` with metadata blocks).

End-of-phase summary reports:
- Capability count + task count
- Dependency edge count + max depth
- Root tasks (the ones with no upstream deps — those can begin in parallel)
- Risk distribution (counts of low/medium/high/critical)
- Type distribution

Plus a structural validation result and a cross-sell suggestion to run Phase 3 (`/review-spec`, `/validate-spec`).

After the skill returns, it stops — it does NOT auto-invoke any Phase 3 skill.

## Common failures

- **Canvas missing required sections.** The canvas wasn't fully synthesized in Phase 1, or it was hand-edited and broken. Stage 1a checks for `## Capability:` sections, strategic context, cross-cutting concerns, dependency layers — all four required. Re-run `/create-spec` to regenerate.
- **Stage 1d structural validation fails.** The synthesis produced a tech spec that doesn't parse against `@ido4/tech-spec-format`. Common causes: malformed task ref (e.g., dropped the leading zero), `depends_on` referencing a non-existent task, circular dependencies. The skill reports the first 3 errors verbatim. Fix via [`/refine-spec`](./refine-spec/).
- **Output budget truncation.** Rare, but if the synthesis hits a model output budget mid-spec, you might see a partial file. Re-run the skill — the second attempt usually completes.

For deeper troubleshooting, see the [FAQ + troubleshooting](../faq/) page.

## Related

- [Phase 2 in the walkthrough](../how-it-works/#phase-2--synthesize-spec) — narrative context
- [`/create-spec`](./create-spec/) — Phase 1, produces the canvas this skill consumes
- [`/validate-spec`](./validate-spec/) — Phase 3 deterministic content checks
- [`/review-spec`](./review-spec/) — Phase 3 qualitative review
- [`/refine-spec`](./refine-spec/) — for editing the produced tech spec
