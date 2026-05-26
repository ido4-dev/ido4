---
title: "/stakeholder-brief"
description: "Generate a role-specific 3-minute briefing to onboard a new stakeholder mid-project — what's been decided, what's still open, where their expertise can help."
---

`/stakeholder-brief` produces a tailored briefing for a new (or returning) stakeholder. It's designed for the moment when a senior architect, a UX lead, a QA owner, or a business stakeholder needs to join a specification that's been in flight for sessions — and shouldn't have to read the full canvas to contribute usefully.

The briefing is readable in 3 minutes. The point is to land the joiner with enough context that their first contribution moves the spec forward, instead of being spent catching up.

## When to use

- **Mid-project, when bringing a new role in.** An architect joins after PM and UX have shaped the problem. A QA owner joins after the architect signed off on feasibility. A business stakeholder needs to review priorities before commitment.
- **When a previously-contributing role returns after a gap.** Decisions have moved since they last engaged.
- **Before an offline conversation.** You want to talk to the architect outside the plugin first — the briefing gives you (or them) a written substrate.

`/stakeholder-brief` is read-only. It doesn't modify the canvas, doesn't add the stakeholder to anything — it just produces the document. The stakeholder's actual contribution happens when they (or you, channeling them) invoke `/create-spec --as [role]`.

## Invocation

In Cowork:
```
/stakeholder-brief architect
```

In Claude Code:
```
/ido4shape:stakeholder-brief architect
```

The argument is the target role: `architect`, `ux`, `business`, `qa`, `pm`, `founder`. If you omit it, the skill asks who the briefing is for.

## What the briefing contains

A six-section document, each section short and concrete:

| Section | Content |
|---|---|
| **The Problem** | 2–3 sentences from this role's perspective (an architect cares about different framings than a business stakeholder) |
| **What's Been Decided** | Key decisions made so far — what NOT to relitigate. Pulled from `.ido4shape/decisions.md` and filtered for relevance to the role. |
| **Where We Need Your Perspective** | Specific questions only their expertise can answer. The architect gets feasibility and risk questions; UX gets user-flow and information-architecture questions; QA gets verifiability questions. |
| **Active Tensions** | Unresolved tensions from `.ido4shape/tensions.md` relevant to this role. Honest about what hasn't been settled. |
| **What to Look At** | Specific canvas sections or source materials worth their attention — not a "read everything" instruction. |
| **Next Steps** | Branches by intent: contribute via `/create-spec --as [role]`, or stay informed (get a new briefing when the spec evolves). |

## Role tailoring

The skill uses the stakeholder profiles reference to know what each role typically cares about:

- **Architect** — feasibility, risk, infrastructure, scalability targets, NFRs, cross-cutting concerns, dependency order
- **UX** — user flows, information architecture, accessibility, content strategy, error states, success states
- **Business** — priorities, scope, deadlines, commercial constraints, success metrics, market positioning
- **QA** — verifiability of success conditions, edge cases, regression surface, performance budgets, observability
- **PM** — user pain framing, capability tradeoffs, roadmap implications, dependency on partner teams
- **Founder** — north star alignment, scope discipline, risk vs. velocity tradeoffs

The briefing's tone, vocabulary, and emphasis shift by role. An architect's briefing leads with the system's risk landscape; a business stakeholder's briefing leads with priorities and scope.

## Pattern: briefing → conversation → contribution

The typical flow when bringing a new perspective in:

1. **Generate the briefing.** `/stakeholder-brief architect`
2. **Share it with the stakeholder.** Or, if you're channeling their voice, read it yourself to load their context.
3. **Have them contribute.** Either they invoke `/create-spec --as architect` themselves in Cowork (sharing the project folder), or you invoke it with their input. Their contributions get attributed in the canvas.
4. **Re-review.** Run `/review-spec` after the new perspective has been integrated — particularly useful when the new role's input shifted assumptions in other groups.

## What the briefing does NOT contain

- **The full canvas.** Briefings are 3-minute reads. If the stakeholder wants the full picture, they read `.ido4shape/canvas.md` directly.
- **Implementation detail.** Strategic specs don't have effort estimates or task breakdowns; briefings don't either.
- **Editorial commentary.** The briefing is factual — what's decided, what's open, what's contested. No "I think you should focus on X" — that's for the conversation.

## Common patterns

- **Architect first, late in PM-shaped spec.** Briefing leads with "feasibility hasn't been pressure-tested yet" — the architect's first input is often correcting an assumption nobody questioned.
- **Business stakeholder pre-commitment.** Briefing leads with priority and scope. The business stakeholder often pushes back on `must-have` distribution.
- **QA after structural decisions land.** Briefing leads with success conditions — QA often catches that several conditions aren't independently verifiable.

## Related

- [`/create-spec`](../create-spec/) — the next step after the briefing; supports `--as [role]` invocation
- [`/review-spec`](../review-spec/) — after new perspective is integrated, re-review
- [How it works](../../how-it-works/#the-stakeholder-model) — the stakeholder model in narrative form
