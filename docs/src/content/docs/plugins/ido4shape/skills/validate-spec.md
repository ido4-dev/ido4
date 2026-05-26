---
title: "/validate-spec"
description: "Two-pass validation of a strategic spec — deterministic parser checks plus content quality assertions. Run before sharing or handing the spec downstream."
---

`/validate-spec` runs structural and content validation on a strategic spec file. It's invoked automatically by `/synthesize-spec` after composition, and can also be run standalone — useful before sharing the spec with stakeholders or handing it to downstream tooling.

## When to use

- After hand-editing a spec file
- Before sharing the spec with stakeholders for review
- Before handing the spec to `ido4 MCP` decomposition or `ido4specs`
- As part of an iteration loop with `/refine-spec`

`/synthesize-spec` runs validation automatically — you don't need to invoke it manually after composition unless you want to re-check.

## Invocation

In Cowork:
```
/validate-spec my-project-spec.md
```

In Claude Code:
```
/ido4shape:validate-spec my-project-spec.md
```

The argument is the path to the spec file. If omitted, the skill looks for `*-spec.md` files in the project root.

## Two passes

### Pass 1 — Structural validation (deterministic)

Invokes the bundled `@ido4/spec-format` parser via Node:

```bash
node "${CLAUDE_PLUGIN_DATA}/spec-validator.js" <path-to-spec.md>
```

The parser outputs JSON. The skill interprets each error intelligently rather than relaying raw output:

| Error class | What the skill does |
|---|---|
| **Broken dependency reference** (`depends on X which does not exist`) | Looks at existing capability IDs and the description's intent; suggests the correct target |
| **Circular dependency** (`A → B → A`) | Reads each capability's description to understand intended data/control flow; suggests which edge to reverse |
| **Duplicate capability ref** | Identifies both occurrences; derives the next available number in the group's sequence |
| **Missing format marker** | Shows the exact line that should be present: `> format: strategic-spec \| version: 1.0` |
| **Invalid metadata value** | Lists allowed values; for close matches (e.g., "critical" → "high") suggests the mapping |
| **Implementation-level keys** (`effort`, `type`, `ai`, `size` in a strategic spec) | Explains these belong in the technical spec, not the strategic spec; suggests removing them |
| **Empty groups** (declared but no capabilities) | Likely incomplete synthesis; suggests returning to `/create-spec` or `/refine-spec` |
| **Orphan capabilities** (outside any group) | Names which capabilities need a home |

If the parser CLI isn't available (Node missing, validator not copied to plugin data), the skill notes it and falls back to LLM-only structural checks. The fallback is weaker — install Node 18+ for the full check.

### Pass 2 — Content quality (LLM judgment)

A battery of content assertions (A1–A12):

- **A1** — Capability descriptions are ≥200 chars with multi-stakeholder context
- **A2** — Success conditions are bulleted, specific, independently verifiable
- **A3** — Priorities are coherent across groups (no group is all `must-have` with no `should-have`)
- **A4** — Strategic risk is honest (no project-level `low` risk with cross-cutting infrastructure concerns)
- **A5** — Stakeholder attributions present where appropriate ("Per the architect: ...")
- **A6** — Constraints and non-goals sections present at project level
- **A7** — Cross-cutting concerns section present and substantive
- **A8** — Group prefixes match capability prefixes (NCO group → NCO-01, NCO-02)
- **A9** — Dependency graph is sensible (foundational before dependent, no orphans)
- **A10** — Open questions, if present, are real uncertainty, not laziness
- **A11** — `depends_on: -` is used where there are explicitly no dependencies (vs omitted = unspecified)
- **A12** — Tensions surfaced in the canvas either resolved or held as open questions

Each assertion is FAIL or PASS with specific per-capability or per-group references.

## Verdict

Three possible outcomes:

- **PASS** — clean across both passes. Ready for downstream ingestion or stakeholder review.
- **PASS WITH NOTES** — Pass 1 clean; Pass 2 has notes (e.g., a capability with thin stakeholder context, a priority distribution that's worth a sanity-check). The spec is structurally valid; the notes are judgment calls.
- **FAIL** — Pass 1 structural errors. Fix via `/refine-spec` and re-validate.

## Two-layer pattern

Pass 1 is deterministic — same input, same output, every time. Pass 2 is LLM judgment — useful for catching what the parser can't (description quality, attribution presence, priority coherence) but subject to model variance.

The two layers cross-check each other. If Pass 1 passes but Pass 2 flags issues, the spec is structurally usable but worth refining. If Pass 1 fails, fix the structural issues first — Pass 2 findings on a structurally-broken spec are unreliable.

## Common failures

- **`node` not found.** Pass 1 falls back to LLM checks. Install Node 18+ and re-validate for the full check.
- **`spec-validator.js` not in plugin data.** The SessionStart hook didn't run. Start a fresh session to retrigger.
- **Pass 1 reports a metric anomaly you don't understand.** The parser output includes a `metrics` object — the skill should interpret it, but if it doesn't, the JSON is human-readable. Worth opening directly to see what the parser saw.

## Related

- [`/synthesize-spec`](../synthesize-spec/) — runs validate automatically after composition
- [`/refine-spec`](../refine-spec/) — fix issues surfaced by validation
- [`/review-spec`](../review-spec/) — qualitative review across multiple lenses (different from validate's quality assertions)
