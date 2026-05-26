---
title: "ido4shape"
description: "Crystallize a vague idea into a structured strategic spec through Socratic conversation. Overview of the canvas-based discovery flow."
---

You have an idea, or a half-written PRD, or a stack of meeting notes. What you don't yet have is a clear picture of *what's actually being built* — the capabilities, the boundaries, the success conditions, the dependencies. Most spec tooling assumes you've already done that thinking. The blank page just waits for you to fill it.

`ido4shape` is a [Claude Code](https://www.anthropic.com/claude-code) and [Claude Cowork](https://claude.com/product/cowork) plugin that runs the discovery. It reads whatever you bring in — documents, sketches, raw notes, or nothing at all — and conducts a Socratic conversation that builds a **knowledge canvas** across sessions. Stop and resume any time. When the canvas is mature enough, one command crystallizes it into a structured **strategic spec** that downstream tooling (or your team) can act on.

In the ido4 suite, **`ido4shape` captures the WHY and the WHAT** (strategic intent + capabilities). **[`ido4specs`](../ido4specs/) takes the WHAT and adds the HOW** (concrete tasks grounded in your codebase). **[`ido4dev`](https://github.com/ido4-dev/ido4dev) — or any downstream tool you bring — handles execution** (turning the spec into issues your team works against). This page is about the upstream plugin: idea → strategic spec.

The point is **thinking that doesn't evaporate**. A founder's intuition, an architect's risk read, a PM's user-pain insight — each gets attributed and preserved through the rest of the pipeline. The synthesis step is reproducible: same canvas, same spec format, same parser contract. When engineering asks "why are we building this?" four months in, the answer is in the file.

## What it does, at a glance

| Stage | Skill | What you get |
|---|---|---|
| Discover | `/create-spec` | A growing knowledge canvas in `.ido4shape/` (Problem, Solution, Risks, Dependencies, Stakeholders, Tensions, Decisions) |
| Review | `/review-spec` | Independent multi-lens reviewers (technical feasibility, scope, dependencies, format) |
| Crystallize | `/synthesize-spec` | A strategic spec markdown file (`{project}-spec.md`) |
| Verify | `/validate-spec` | Two-pass deterministic + content validation against `@ido4/spec-format` |
| Refine | `/refine-spec` | Natural-language edits to the spec with re-validation |
| Onboard | `/stakeholder-brief` | Role-specific briefing (architect, UX, business, QA) for new joiners |

Discovery wall time isn't measured in minutes — it's measured in conversations. A small spec might crystallize in one sitting; a complex multi-stakeholder project might span weeks of sessions before the canvas is mature enough to synthesize. The plugin doesn't push you forward; the readiness signal comes from the canvas's Understanding Assessment, which you can read at any time.

## What this doesn't do

`ido4shape` is deliberately scoped. It does not:

- **Make implementation decisions.** The strategic spec doesn't have effort estimates, task breakdowns, or AI-suitability flags. That's `ido4specs`' job, downstream.
- **Write code.** It produces a *spec* describing intent and capabilities. No engineering happens here.
- **Track project execution.** No tickets, no boards, no progress reporting. Output is a markdown file; what you do with it is up to your tooling.
- **Replace stakeholders.** It probes assumptions and surfaces tensions, but the answers come from you (and your team). Single-perspective specs are weaker — bring the architect, the PM, the UX person.
- **Auto-progress.** Nothing fires on a timer. You invoke skills explicitly when the canvas is ready, and the plugin tells you honestly when it isn't.

What it *does* do is the upstream half of the spec problem — turning fuzzy intent into something concrete enough that downstream tools (or human engineers) have a real input to work from.

## Where to go from here

- **[Get started](./get-started/)** — install (Cowork + Claude Code), prerequisites, and the first-session flow
- **[How it works](./how-it-works/)** — the conversation-driven canvas, knowledge dimensions, stakeholder model, and what synthesis actually produces
- **Skill reference** — per-skill pages with purpose, invocation, and common failure modes:
  [`/create-spec`](./skills/create-spec/) ·
  [`/synthesize-spec`](./skills/synthesize-spec/) ·
  [`/validate-spec`](./skills/validate-spec/) ·
  [`/review-spec`](./skills/review-spec/) ·
  [`/refine-spec`](./skills/refine-spec/) ·
  [`/stakeholder-brief`](./skills/stakeholder-brief/)
- **[FAQ + troubleshooting](./faq/)** — common questions, scenario recipes, and what to do when something goes wrong

## Reference

- **Plugin source and changelog:** [github.com/ido4-dev/ido4shape](https://github.com/ido4-dev/ido4shape)
- **Marketplace install:** `/plugin install ido4shape@ido4-plugins` from inside Claude Code, or marketplace `ido4-dev/ido4-plugins` in Cowork
- **Format reference:** `@ido4/spec-format` on npm — the parser package the plugin ships
- **Downstream pair:** [ido4specs](../ido4specs/) turns the strategic spec into a technical spec grounded in your codebase
