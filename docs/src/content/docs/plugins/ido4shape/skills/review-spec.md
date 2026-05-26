---
title: "/review-spec"
description: "Launch parallel independent reviewers across technical feasibility, scope, dependencies, and format. Useful before synthesis or as a final cross-check."
---

`/review-spec` launches up to four independent review sub-agents in parallel, each examining the canvas (or the synthesized spec) from a different lens. The goal is to catch issues a single reviewer would miss — a technical reviewer thinks about feasibility but might not notice a scope drift; a scope reviewer catches the drift but might miss a circular dependency.

The skill works on **either** the canvas (before synthesis, three reviewers) or a synthesized spec artifact (four reviewers, with format & quality joining).

## When to use

- **Before synthesis, on the canvas** — particularly for larger projects (4+ groups or 10+ capabilities). Catches structural issues that are expensive to fix after composition. The dependency auditor is especially valuable here.
- **After synthesis, on the spec artifact** — as a final cross-check before sharing with stakeholders or handing downstream. Format & Quality reviewer joins on this path.
- **Mid-project, when you suspect drift** — running review against the canvas can surface that a recent conversation shifted scope without anyone noticing.

If the canvas's Understanding Assessment is thin across multiple dimensions, the skill warns that review may be premature — you'll get reports flagging the same gaps the canvas already shows.

## Invocation

In Cowork:
```
/review-spec
```

In Claude Code:
```
/ido4shape:review-spec
```

No arguments. The skill detects whether a spec artifact (`*-spec.md`) exists in the project — if yes, runs all four reviewers; if no, runs three on the canvas.

## The reviewers

| Reviewer | Lens |
|---|---|
| **Technical Feasibility** | Architecture coherence, strategic risk honesty, cross-cutting concern completeness, hidden dependencies, constraint realism. Particularly useful when no architect has contributed to the canvas. |
| **Scope Alignment** | North-star alignment (does the spec serve the original problem?), constraint compliance, non-goal violations, coverage gaps, priority coherence. |
| **Dependency Audit** | Graph integrity (no cycles, valid references), critical path analysis, cross-group dependency health, parallelization opportunities, hidden dependencies named in descriptions but not declared. |
| **Format & Quality** *(only when reviewing an existing spec artifact)* | Format compliance against `@ido4/spec-format`, description quality, success condition specificity, stakeholder attribution preservation. Overlaps somewhat with `/validate-spec` but uses LLM judgment, not just deterministic parser checks. |

All reviewers run in parallel — they don't share context, so each gives an independent read.

## Output

The skill synthesizes findings into a structured report:

- **Verdict** — `READY` / `READY WITH NOTES` / `NOT READY`
- **Critical issues** — anything that must be addressed before proceeding
- **Recommendations** — specific suggestions (with capability/group references) for refinement
- **Observations** — non-blocking signals worth knowing (e.g., "Dependency graph has 5 parallel critical paths — good parallelization opportunity")
- **Per-reviewer detail** — what each lens surfaced individually, so you can see which finding came from which perspective

If READY, the skill suggests `/synthesize-spec` (or stakeholder review if already synthesized). If NOT READY, it names what needs to happen — usually return to `/create-spec` to fill specific gaps, or `/refine-spec` to fix specific issues.

## Two patterns for using review

**1. Canvas-side, pre-synthesis.** Run review when the conversation feels saturated but before you crystallize. The dependency auditor will catch structural issues — broken dependencies, missing capabilities — at the canvas stage, where they're cheap to fix. The technical reviewer might flag *"the storage layer architecture isn't coherent yet"*, telling you to bring an architect in before composing.

**2. Spec-side, post-synthesis.** Run review on the synthesized artifact as a cross-check. Format & Quality joins on this path. Useful particularly if the project is large enough that the synthesizer's single-shot composition might have produced inconsistencies across groups.

Both patterns are valid. Many users do both.

## Difference vs `/validate-spec`

`/validate-spec` is two-pass — Pass 1 deterministic parser, Pass 2 content assertions (A1–A12). It tells you whether the spec is *structurally valid and well-formed*.

`/review-spec` is multi-perspective — each reviewer applies independent judgment from a specific lens. It tells you whether the spec is *strategically coherent, technically feasible, and aligned with the original problem*.

A spec can PASS validate but get NOT READY from review (well-formed but strategically incoherent). It can also pass review but FAIL validate (good thinking but format drift). Run both for high-stakes specs.

## Common failures

- **Review premature.** If the canvas's Understanding Assessment is thin, the skill warns and you'll get reports that essentially say "the canvas isn't ready". Address the canvas gaps first.
- **All four reviewers agree on the same issue.** Strong signal — that's not redundancy, that's convergence on a real problem.
- **Reviewers disagree.** Also a useful signal. The technical reviewer might say "feasibility concerns" while the scope reviewer says "scope is coherent" — these aren't contradictions, they're different lenses. Read both reports.

## Related

- [`/create-spec`](../create-spec/) — when review surfaces gaps, return here to fill them
- [`/synthesize-spec`](../synthesize-spec/) — proceed here when review verdict is READY
- [`/validate-spec`](../validate-spec/) — complementary deterministic + content check
- [`/refine-spec`](../refine-spec/) — apply recommendations from review
