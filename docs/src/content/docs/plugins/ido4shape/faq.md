---
title: "FAQ + troubleshooting"
description: "Common questions about ido4shape — workflow scenarios, edge cases, and what to do when something goes wrong."
---

Common questions, scenario recipes, and a troubleshooting reference. If you don't see your question here, the [How it works](./how-it-works/) page covers the discovery model in detail; the Reference section in the [Overview](./) lists the source repos.

## Getting started questions

### Do I need to bring documents to start?

No. `/create-spec` works with an empty project folder — the agent will conduct discovery from a blank slate, opening with discovery questions rather than observations. Existing materials (PRDs, design docs, notes, sketches, code) make the first session go faster because the agent reads them first and targets the gaps, but they're not required.

If you have materials, place them in the project folder before invoking `/create-spec`. In Cowork, drag-drop into the project; in Claude Code, copy files into the working directory.

### Does ido4shape work without a strategic spec authoring background?

Yes — that's actually the primary use case. The Socratic conversation is designed to extract the strategic thinking you have but haven't articulated. You don't need to know what "Solution Shape" or "Boundary Clarity" means in advance; the agent will probe each dimension as the conversation naturally surfaces them.

If you're a PM or founder who's never written a formal spec before, `/create-spec` is the path of least resistance. If you've written specs before in other formats, it's still useful — the multi-stakeholder model and the tension management discipline often catch things ad-hoc spec authoring misses.

### Cowork vs Claude Code — which should I use?

Both work identically. Choose based on context:

- **Cowork** — preferred for longer conversations, multi-session projects, and stakeholder collaboration. The desktop app, project-folder model, and longer session durability fit the discovery loop well.
- **Claude Code** — preferred when you're already in the terminal, when you want to commit the spec to the project's git repo, or when you want to integrate with [`ido4specs`](../ido4specs/) (which is Claude Code-only).

Many users start in Cowork for discovery and switch to Claude Code when handing the spec downstream to `ido4specs`.

### Do I need ido4specs to use ido4shape?

No. ido4shape produces a strategic spec markdown file. What you do with it is open — `ido4specs` is the natural downstream pair (turns it into a technical spec grounded in your codebase), but you can also hand it to a human engineering lead, paste it into your team's wiki, or use any tooling that reads `@ido4/spec-format`.

That said, if you want the WHY → WHAT → HOW progression intact through to GitHub issues, the suite is designed to work together: `ido4shape` → `ido4specs` → `ido4dev` (or your own downstream tool).

## Workflow scenarios

### How do I know when the canvas is ready to synthesize?

Read `.ido4shape/canvas.md` directly. The Understanding Assessment section is the readiness signal:

```
## Understanding Assessment
- Problem Depth: deep (PM, architect) — multi-perspective, locked
- Solution Shape: solid (PM, architect) — 4 capability clusters, all named
- Boundary Clarity: solid — constraints + non-goals defined
- Risk Landscape: solid (architect) — top 3 risks named with mitigations
- Dependency Logic: forming — cross-group dependencies traced
- Quality Bar: forming — success conditions drafted, need QA review
```

Rough heuristic: at least three dimensions at `solid`, no dimension at `not started`, multiple stakeholders represented across them. The `/synthesize-spec` pre-flight check enforces a similar threshold — it'll refuse a clearly-thin canvas.

Don't wait for everything to hit `deep`. Some projects naturally have thin dimensions (greenfield projects without an architect available, for example). Synthesizing with explicit open questions is better than dragging discovery indefinitely.

### Can I bring multiple stakeholders into the same canvas?

Yes — that's the intended pattern. Three flows:

**1. Sequential.** PM contributes first. Then `/stakeholder-brief architect` produces a briefing, the architect joins via `/create-spec --as architect`, contributes their feasibility and risk perspective, leaves. Then QA, business, UX as needed.

**2. Side-by-side.** In Cowork with shared project folders, multiple people can contribute over the same canvas across days. The agent tracks attributions per role.

**3. Synthesized.** You channel multiple perspectives yourself. Say *"the architect would push back on this because..."* — the agent treats it as an architect contribution and updates attributions accordingly.

The canvas tracks whose perspective is represented in each dimension. Don't let it stay single-perspective — single-perspective specs are a known weakness.

### What's the difference between /review-spec and /validate-spec?

`/validate-spec` is two-pass — deterministic parser check (Pass 1) plus a battery of content assertions (Pass 2). It tells you whether the spec is *structurally valid and well-formed*. Verdict: PASS / PASS WITH NOTES / FAIL.

`/review-spec` is multi-perspective — up to four independent reviewers (technical feasibility, scope, dependency, format & quality) each apply judgment from a specific lens. It tells you whether the spec is *strategically coherent and feasible*. Verdict: READY / READY WITH NOTES / NOT READY.

A spec can PASS validate but get NOT READY from review (well-formed but strategically incoherent). It can also pass review but FAIL validate (good thinking but format drift). For high-stakes specs, run both.

### Can I edit the spec by hand instead of using /refine-spec?

Yes, but re-validate after. The `@ido4/spec-format` grammar is strict — capability IDs must be zero-padded, metadata uses blockquote syntax, only certain H2 sections are allowed, dependency references must resolve. Hand-edits that break the format will be caught by `/validate-spec` (and by any downstream consumer like `ido4specs`).

`/refine-spec` is preferred for non-trivial edits because it surfaces ripple effects before applying and re-validates after every pass. For trivial typo fixes, hand-editing is fine.

## Troubleshooting

### Cowork blocks the skill — "no working folder selected"

Cowork's injection defense requires a project folder selected via "Work in a project" at the bottom of the chat input. Without it, plugins can't write workspace files. Select a folder and re-invoke.

### "Tell me about your project" — even though I added documents

The agent didn't scan the materials. Likely causes:

- Documents are in a nested sub-directory the agent didn't look at — move them to the project root or `.ido4shape/sources/`
- Documents are in a binary format the agent can't read — convert to markdown, plain text, or PDF
- You invoked `/create-spec` right at the start of the session before Claude finished indexing the folder — wait a few seconds and re-invoke

### The canvas hasn't updated mid-session

The skill is designed to update the canvas after every significant insight, not just at session end. If you notice the file isn't changing during conversation, prompt: *"have you updated the canvas with what we just discussed?"* — the agent will check and write.

If the canvas consistently stagnates, that's a bug worth reporting. Open an issue at [github.com/ido4-dev/ido4shape/issues](https://github.com/ido4-dev/ido4shape/issues).

### `/validate-spec` reports parser errors I don't understand

The skill should interpret each error intelligently — broken deps → suggest correct target, cycles → identify edge to reverse, etc. If the output is raw JSON or generic, the interpretation step likely failed.

Workaround: run the parser directly: `node "${CLAUDE_PLUGIN_DATA}/spec-validator.js" your-spec.md`. The JSON is human-readable. Common gotchas:

- `Missing format marker` — the first blockquote after the project heading must be `> format: strategic-spec | version: 1.0`
- `Duplicate capability ref` — two `### PREFIX-NN: ...` headings with the same `PREFIX-NN`
- `Circular dependency` — A depends_on B depends_on A; reverse one edge
- `Invalid metadata value` — check allowed values for `priority` (must-have/should-have/nice-to-have) and `risk` (low/medium/high)

### `/refine-spec` says my edit introduced a regression

The skill re-runs the parser after every edit. If the edit broke the format, it tells you immediately and typically rolls back. Common cases:

- You changed a capability ref but a `depends_on` reference still points at the old ID
- You added a `depends_on` referencing a capability that doesn't exist
- The edit created a circular dependency

Fix the underlying issue (or accept the rollback and try a different approach) and re-invoke.

### Stale canvas after a long break

If you're resuming a project after weeks and the world has changed (team rotated, scope shifted, new constraints emerged), don't try to refine the spec on top of a stale canvas. Re-run `/create-spec` with the project name and have the conversation that updates the canvas to current reality. Then re-synthesize.

The canvas is meant to evolve; treating it as immutable is a recipe for downstream drift.

## Where to go next

- **[Overview](./)** — what `ido4shape` does and how it fits in the suite
- **[Get started](./get-started/)** — install, prerequisites, first session
- **[How it works](./how-it-works/)** — knowledge canvas, six dimensions, stakeholder model
- **Skill reference** — per-skill detail pages:
  [`/create-spec`](./skills/create-spec/) ·
  [`/synthesize-spec`](./skills/synthesize-spec/) ·
  [`/validate-spec`](./skills/validate-spec/) ·
  [`/review-spec`](./skills/review-spec/) ·
  [`/refine-spec`](./skills/refine-spec/) ·
  [`/stakeholder-brief`](./skills/stakeholder-brief/)
