---
title: "/create-spec"
description: "The discovery skill — guides Socratic conversation that builds the knowledge canvas. Run this any time you want to think through what to build."
---

`/create-spec` is the discovery skill. It starts (or resumes) a Socratic conversation that builds a **knowledge canvas** in `.ido4shape/canvas.md`. The agent reads anything you've put in the project folder, opens with observations rather than generic questions, and probes the six knowledge dimensions non-linearly as the conversation unfolds.

The skill is conversation-driven, not stage-driven. There's no fixed sequence of questions. The agent follows the problem where it leads and updates the canvas continuously as understanding develops.

## When to use

- **Starting from scratch** — you have an idea but no documents. The agent guides discovery from a blank slate.
- **Starting from materials** — you have PRDs, notes, sketches, or code. The agent reads them first, then targets the gaps.
- **Resuming a project** — picking up days or weeks later. The agent reads the canvas, decisions, and tensions, and opens with what's been on its mind since.
- **Bringing a new perspective in** — `/create-spec --as architect` (or `--as ux`, `--as business`, etc.) shifts the conversation style to the role's concerns and tags their contributions.

## Invocation

In Cowork:
```
/create-spec my-project
```

In Claude Code:
```
/ido4shape:create-spec my-project
```

The argument is the project name — used as the workspace marker and the eventual spec filename root. For an existing project, the agent matches against an existing `.ido4shape/` directory and resumes.

To enter as a specific role:
```
/create-spec my-project --as architect
```

If the role hasn't contributed before, the agent runs a brief onboarding (problem in 2 sentences from their perspective, key decisions already made, specific questions their expertise can answer) before opening the conversation.

## What it does

**On first invocation:**
1. The SessionStart hook seeds `.ido4shape/` (canvas, stakeholders, decisions, tensions, sessions, sources)
2. The agent scans the project folder for existing materials and reads everything
3. The agent opens with observations grounded in what it found

**On returning sessions:**
1. The agent reads the canvas, latest session summary, tensions, decisions
2. Checks for new files in `.ido4shape/sources/`
3. Opens with observations about what shifted or what's been on its mind — not "where were we?"

**Throughout the session:**
- Updates the canvas after every significant insight (not just at session end)
- Logs tensions when stakeholder perspectives or requirements contradict — doesn't try to resolve them immediately
- Tracks decisions in the decisions file so they don't get relitigated
- Maintains the Understanding Assessment with honest confidence signals

**At natural saturation:**
- The agent will suggest synthesis when the canvas's Understanding Assessment shows depth across dimensions
- It won't auto-invoke `/synthesize-spec` — you confirm when to crystallize

## The six knowledge dimensions

The agent attends to (non-linearly): Problem Depth, Solution Shape, Boundary Clarity, Risk Landscape, Dependency Logic, Quality Bar. See [How it works](../../how-it-works/#six-knowledge-dimensions) for the detail.

## Output

The canvas at `.ido4shape/canvas.md` — the agent's current understanding of the project, structured by knowledge dimension. Plus side files:

- `.ido4shape/stakeholders.md` — who contributed, with what perspective
- `.ido4shape/decisions.md` — decisions made so far (don't relitigate)
- `.ido4shape/tensions.md` — contradictions held open until enough context exists
- `.ido4shape/sessions/` — per-session summaries (the agent reads the latest on resume)
- `.ido4shape/sources/` — materials you add mid-project

All plain markdown. Read or edit them by hand any time.

## Common failures

- **Cowork blocks the skill ("no working folder").** Cowork's injection defense requires a project folder selected via "Work in a project". Select one and re-invoke.
- **Agent opens with "tell me about your project" despite source materials.** Suggests the source materials didn't get read. Check that the materials are in the project folder (not nested in a sub-directory the agent didn't scan) and re-invoke.
- **Canvas isn't updating.** The canvas should evolve during the conversation, not just at session end. If you notice it stagnating, prompt: *"have you updated the canvas with what we just discussed?"* — the agent will check and write.
- **Single-perspective canvas.** The Understanding Assessment will name dimensions tagged with only one stakeholder. That's not a bug — it's an honest signal that the spec will be weaker on those axes unless you bring more perspectives in.

## Related

- [How it works](../../how-it-works/) — the knowledge canvas, six dimensions, stakeholder model in narrative form
- [`/synthesize-spec`](../synthesize-spec/) — when the canvas is mature, crystallize it into a spec
- [`/review-spec`](../review-spec/) — independent multi-lens reviewers, useful before synthesis
- [`/stakeholder-brief`](../stakeholder-brief/) — onboard a new perspective mid-project
