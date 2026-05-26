---
title: "How it works"
description: "Detailed walkthrough of the ido4shape discovery flow — knowledge canvas, conversation dimensions, stakeholder model, and synthesis."
---

`ido4shape` is conversation-driven, not stage-driven. Where [`ido4specs`](../../ido4specs/) runs a linear three-phase pipeline against a finished input, `ido4shape` builds understanding through dialogue over one or many sessions and crystallizes it only when the canvas is ready.

This page walks through the model. For the high-level picture, see the [Overview](./). For installation and the first-session command sequence, see [Get started](./get-started/).

## The workspace

Everything `ido4shape` knows about your project lives in a `.ido4shape/` directory inside your project folder. It's a SessionStart hook that creates the directory and seeds the files on first invocation, so you don't need to set anything up.

```
your-project/
├── (your existing materials — PRDs, notes, code, sketches)
├── .ido4shape/
│   ├── canvas.md          ← current understanding (the working memory)
│   ├── stakeholders.md    ← who's contributing, what perspective they bring
│   ├── decisions.md       ← decisions already made (don't relitigate)
│   ├── tensions.md        ← contradictions between perspectives, held open
│   ├── sessions/          ← session-by-session summaries
│   └── sources/           ← added materials (drag-drop in Cowork)
└── (after synthesis: my-project-spec.md)
```

All these files are plain markdown. You can read them, edit them by hand, share them, version-control them. The canvas in particular is meant to be inspected — it's the closest thing to a "state of understanding" that the plugin has.

## Six knowledge dimensions

The agent attends to six textures of a problem, non-linearly, following the conversation where it leads:

| Dimension | What it captures |
|---|---|
| **Problem Depth** | Who suffers, how acutely, what workarounds exist, what triggers urgency, cost of inaction |
| **Solution Shape** | Major capabilities and how they relate; groups emerge from natural clusters, not imposed taxonomy |
| **Boundary Clarity** | What's in, what's out, what constrains; non-goals to prevent scope creep; open questions to flag honest uncertainty |
| **Risk Landscape** | Where unknowns live; what's never been done before; external dependencies; untested assumptions |
| **Dependency Logic** | What must exist before what; falls out of solution shape; circular dependencies flagged immediately |
| **Quality Bar** | What "done" means per piece; success conditions two people would independently agree on; specific and testable |

The canvas keeps an **Understanding Assessment** section that tracks how deep each dimension goes, honestly:

```
## Understanding Assessment
- Problem Depth: deep (PM) — can articulate from user perspective
- Solution Shape: forming (PM) — 3 capability clusters emerging
- Boundary Clarity: solid (PM) — constraints locked
- Risk Landscape: thin — no architect input yet
- Dependency Logic: not started
- Quality Bar: not started
```

This is the **readiness signal** for synthesis. Thin dimensions are not blockers — they're invitations to either bring another stakeholder in or accept that the spec will be weaker on that axis.

## The stakeholder model

A spec shaped by a single perspective is weaker than one shaped by multiple. `ido4shape` tracks who's contributed which perspective and explicitly notes when a critical perspective is missing.

When someone new joins a session, the agent asks naturally about their role and adapts the conversation. Roles `ido4shape` knows about out of the box: PM, founder, architect, UX, business, QA. The skill body's stakeholder profiles reference defines what each role cares about and how to probe them.

Three useful patterns:

**1. The role-tagged invocation.** `/create-spec --as architect` tells the agent that the next contributor is an architect — it shifts the questioning style toward technical feasibility, risk, and infrastructure concerns. Their contributions get attributed in the Understanding Assessment.

**2. The cross-perspective probe.** When the agent has heard from PM and UX but not the architect, it flags: *"We've designed the storage layer without architect input on feasibility. Should we get their take before group boundaries crystallize?"* That's the signal to bring someone in (or accept the gap).

**3. The new-joiner brief.** Mid-project, when someone new needs to contribute, `/stakeholder-brief architect` produces a 3-minute briefing: the problem in 2 sentences, the key decisions already made (so they don't relitigate them), the specific questions their expertise can answer, and the active tensions relevant to their role. Then they invoke `/create-spec --as architect` to actually join.

## Tension management

Tensions are contradictions between stakeholder perspectives, requirements, or assumptions. They're the most valuable signal in specification work — and the most common place where naïve tooling collapses real complexity into a forced consensus.

`ido4shape` doesn't try to resolve tensions immediately. It logs them to `.ido4shape/tensions.md` and holds them open until enough context exists for a good resolution. Examples of what gets logged:

- *"PM wants real-time delivery; architect flagged that at the stated event volume real-time is infeasible without a new pipeline."*
- *"Business wants this in Q1; QA estimated 6 weeks of regression testing alone — implies Q2 unless we descope."*
- *"Sarah and Marcus disagree on whether notifications should be in-app or email-first."*

When the canvas is mature enough to synthesize, tensions that remain unresolved either become explicit open questions in the spec (honest about uncertainty) or — if they affect group boundaries or capability definitions — block synthesis until resolved. The pre-flight check in `/synthesize-spec` is explicit about this.

## Crystallization — what synthesis produces

When you invoke `/synthesize-spec`, the agent verifies readiness against the canvas, runs a pre-composition check on source materials (to make sure nothing substantive in your original documents got lost), and delegates composition to the `canvas-synthesizer` sub-agent — running on Opus, in a clean context window so the entire project structure fits in mind simultaneously.

The output is a markdown file at `{project-name}-spec.md` in your project root. The file conforms to the **`@ido4/spec-format` grammar**:

```
# Project Name

> format: strategic-spec | version: 1.0

(project-level WHY, constraints, non-goals, stakeholders, cross-cutting concerns)

## Group: Notification Channels
> priority: must-have

### NCO-01: Multi-Channel Delivery
> priority: must-have | risk: medium

(description — multi-stakeholder context, ≥200 chars)

**Success conditions:**
- (independently verifiable)
- (independently verifiable)

> depends_on: NCO-02
```

Key properties of the strategic spec:

- **WHAT, not HOW.** Capabilities, success conditions, and priorities — no effort estimates, no task breakdowns, no AI-suitability fields. Those belong in the technical spec downstream.
- **Multi-stakeholder context preserved.** *"Per the architect: ..."* attributions stay in the file. The PM's user-pain framing isn't summarized away.
- **Dependency graph explicit.** `depends_on` references between capabilities, validated by the parser. Circular dependencies, broken references, and orphan capabilities are caught structurally.
- **Cross-cutting concerns at project level.** Performance targets, security requirements, accessibility standards live in their own section — they inform every downstream task without being repeated on every capability.

## Validating the spec

Once synthesized, `/validate-spec my-project-spec.md` runs two passes:

**Pass 1 — Structural validation (deterministic).** Invokes the bundled `@ido4/spec-format` parser via Node. If parser output reports broken dependencies, circular references, duplicate capability refs, or invalid metadata, the skill interprets the error and suggests the specific fix — broken dep → name the correct target, cycle → identify the edge to reverse, duplicate → derive the next available number. It doesn't just relay raw parser output.

**Pass 2 — Content quality (LLM judgment).** A battery of content assertions (A1–A12): are descriptions substantive (≥200 chars with multi-stakeholder context), are success conditions independently verifiable, are stakeholder attributions present, are priorities coherent across groups, etc.

Verdict: **PASS** / **PASS WITH NOTES** / **FAIL**. Pass 1 failures are mechanical and the skill fixes them directly. Pass 2 findings are content judgment — they go to you to decide whether to refine.

## Reviewing the spec

For larger projects (4+ groups or 10+ capabilities), `/review-spec` launches parallel independent reviewers — each with a different lens:

- **Technical Feasibility** — architecture coherence, strategic risk honesty, cross-cutting concern completeness, hidden dependencies, constraint realism
- **Scope Alignment** — north-star alignment, constraint compliance, non-goal violations, coverage gaps, priority coherence
- **Dependency Audit** — graph integrity, critical path analysis, cross-group dependency health, parallelization opportunities
- **Format & Quality** (only when a spec artifact exists) — format compliance, description quality, success condition specificity, stakeholder attribution preservation

The reviewers run in parallel and report back; the skill synthesizes their findings into READY / READY WITH NOTES / NOT READY with specific recommendations.

You can run `/review-spec` on the canvas (before synthesis) to catch structural issues that are expensive to fix after composition — the dependency auditor is particularly good at this. Or run it after synthesis as a final cross-check.

## Refining the spec

`/refine-spec my-project-spec.md` takes natural-language instructions and applies surgical edits:

- *"Add a capability under Notifications for delivery retry logic."*
- *"Split the Auth group — auth and authorization should be separate."*
- *"Change NCO-03's dependency from NCO-01 to NCO-02 — the architect flagged the wrong order."*
- *"Per the security review, add an NFR for PII handling in the cross-cutting concerns section."*

Refinements surface ripple effects before applying: *"If we split this group, three capabilities sharing prefix NCO- need new prefixes, and NCO-03's dependency becomes cross-group. Is that what you want?"* After each refinement the skill validates the result, catches format drift, and explains what changed.

## Practical tips

- **The canvas is the cheap place to be wrong.** Course-correcting in conversation is free; course-correcting after synthesis is more work. When something feels off about the canvas, say so — the agent will dig into it.
- **Bring stakeholders in deliberately.** A single-perspective spec is a known weakness. The Understanding Assessment will tell you honestly when you're working with a thin perspective set.
- **Source materials matter.** Drop documents into the project folder before starting (or into `.ido4shape/sources/` mid-project). The agent reads them first and the synthesis step reconciles them against the canvas — anything substantive in your materials but missing from the canvas gets flagged before crystallization.
- **You don't have to synthesize linearly.** Some teams iterate: synthesize a partial spec to share with stakeholders, gather feedback, run `/refine-spec` or `/create-spec` again with new perspectives, re-synthesize. The canvas accumulates.
- **No timer pressure.** A spec for a 3-week project might crystallize in one session. A spec for a 6-month platform might span weeks of conversations before the canvas is mature. Both are valid.
