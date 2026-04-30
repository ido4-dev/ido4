---
title: "/review-spec"
description: "Phase 3 (qualitative): LLM-driven review of the technical spec. Catches missing dependencies, calibration drift, and code-grounding gaps the parser can't see."
---

`/review-spec` is the qualitative half of the two-layer review pattern. Where [`/validate-spec`](./validate-spec/) runs deterministic checks against the format spec, `/review-spec` reads the spec's content and applies LLM judgment to surface issues a parser can't measure: missing dependencies named in description text, sibling-pattern inconsistencies, hub-task identification, narrative-grade quality.

It's deliberately independent of the validator. The two layers cross-check each other — when both flag the same finding, that's high signal.

## When to use

- After `/synthesize-spec` produced a tech spec, before sending it downstream
- After `/refine-spec` made edits, particularly substantive ones
- Whenever you want a "second opinion" on spec quality

Run alongside `/validate-spec` rather than as a replacement. They catch different kinds of issues.

## Invocation

```
/review-spec <path-to-tech-spec.md>
```

The argument is the technical spec path. The skill stops with a usage hint if no argument is given.

## What it does

Reads the spec content and produces a structured **Spec Review Report**. The skill works against the in-context spec content (no shell pipelines, no metadata extraction via grep/awk — this is intentional; the prose is the data source).

It catches issues the parser fundamentally cannot see:

- **Missing dependencies named in description text but not declared in `depends_on`.** Example: a task description mentions "uses the staging Metabase from OPS-01B" but the task's `depends_on` doesn't list `OPS-01B`. The graph is structurally valid, but the prose-declared dependency is missing.
- **Sibling-pattern inconsistencies.** Example: most DCT-* tasks are `effort: S | risk: low | ai: full`, but DCT-07A is `effort: M | risk: high | ai: pair` — flagged as different (might be intentional, might be a calibration miss).
- **Hub-task identification.** Which tasks block the most others (most-depended-upon)? Useful for sequencing work.
- **Code-grounding quality.** Are descriptions concrete enough that an engineer could pick the task up cold? Or are they hand-waving?
- **Narrative-grade quality.** Does the spec read like something a stakeholder could review? Or like raw model output?

## Output

A formatted Spec Review Report with these sections:

- **Summary** — file path, capability + task counts, error/warning/suggestion counts, verdict
- **Errors** — issues that will block downstream ingestion (rare, since structural errors are caught by `/validate-spec`)
- **Warnings** — won't fail ingestion but indicate real quality issues
- **Suggestions** — non-blocking improvements
- **Downstream notes** — informational signals about `ai: human` count, `risk: critical` count, dependency density
- **Dependency Graph** — root tasks, critical path, cross-capability deps, hub tasks, cycles status

Verdict possibilities:

- **PASS** — clean. No errors, warnings, or suggestions of substance.
- **PASS WITH WARNINGS** — non-blocking issues that you'd address before sending downstream.
- **FAIL** — errors that need fixing first. Rare with `/review-spec` (structural fails come from `/validate-spec`).

The skill closes with a question: *"Run /refine-spec to address these, or proceed with the caveats?"* — explicit human checkpoint.

## When to trust review-spec findings

Review-spec is LLM judgment, not deterministic. False positives happen, particularly on:

- AI-suitability calibration suggestions (model heuristic might not match your project's reality)
- Capability coherence warnings (the model may flag splits that make sense given local context it doesn't know)
- Stakeholder attribution suggestions (sometimes flags additions that aren't actually load-bearing)

Use findings as inputs to your decision, not directives. If a finding seems wrong, ignore it; if it seems right, address it via [`/refine-spec`](./refine-spec/).

The deterministic checks in `/validate-spec` are stricter and more reliable. When the two layers disagree, weight `/validate-spec`'s structural findings as authoritative.

## Common failures

- **Strategic spec passed instead of tech spec.** The skill checks for the format marker; stops with a redirect to `/ido4shape:review-spec` if the file is a strategic spec.
- **Spec file not found.** Check the path — the skill won't auto-search.
- **Review synthesis incomplete.** If the report is missing sections or doesn't reach a verdict, the skill reports it specifically. Re-run rather than acting on a partial report.

For deeper troubleshooting, see the [FAQ + troubleshooting](../faq/) page.

## Related

- [Phase 3 in the walkthrough](../how-it-works/#phase-3--review-and-validate) — narrative context
- [`/validate-spec`](./validate-spec/) — the deterministic half of Phase 3
- [`/refine-spec`](./refine-spec/) — fix findings via natural-language edits
