---
title: "Get started"
description: "Install ido4shape in Cowork or Claude Code, prepare your project folder, and run your first discovery session."
---

This page covers installation, prerequisites, and the typical first-session flow. For the conceptual story, see the [Overview](./). For the per-skill detail, see [How it works](./how-it-works/).

## Install

`ido4shape` runs in both [Claude Cowork](https://claude.com/product/cowork) (Anthropic's agentic desktop app) and [Claude Code](https://www.anthropic.com/claude-code) (the CLI). Cowork is the primary target — the conversational discovery flow benefits from Cowork's longer sessions and project-folder model — but the Claude Code path works identically.

### Cowork (Claude Desktop)

1. Click **Customize** in the left sidebar
2. Under **Personal plugins**, click the **+** button
3. Select **Create plugin** → **Add marketplace**
4. Enter `ido4-dev/ido4-plugins` and click **Sync**
5. Open the Directory, go to the **Personal** tab, and click **+** on `ido4shape` to install

> **Tip:** In the marketplace card menu (•••), enable **Sync automatically** to receive new releases without lifting a finger.

### Claude Code (CLI)

```bash
claude plugin marketplace add ido4-dev/ido4-plugins
claude plugin install ido4shape@ido4-plugins
```

After installation, restart your Claude Code session (or run `/reload-plugins`) so the plugin's skills become invocable.

## Prerequisites

| Prerequisite | Why it's needed | How to confirm |
|---|---|---|
| **A project folder** | `ido4shape` writes its workspace (`.ido4shape/`) inside the project folder. In Cowork, this is the folder you select via "Work in a project"; in Claude Code, it's the directory you launch from. | Any folder. Existing materials (PRDs, notes, sketches) help but aren't required. |
| **[Claude Cowork](https://claude.com/product/cowork) or [Claude Code](https://www.anthropic.com/claude-code)** | `ido4shape` is a plugin and runs entirely as skills inside one of these hosts | Cowork is downloadable from claude.com; for Claude Code, run `claude --version` |
| **Node.js 18+** *(optional but recommended)* | The bundled spec validator runs via Node. If absent, `/validate-spec` falls back to LLM-only checks, which are weaker. | Run `node --version` and confirm v18 or higher |

There's no required input file. You can start from nothing — `/create-spec` accepts an empty project folder and conducts discovery from a blank slate. Existing materials (a PRD, design docs, meeting notes, architecture sketches) make the first session go faster because the agent reads them before asking questions.

### Cowork: always select a working folder

In Cowork, you **must** select a project folder via the "Work in a project" button at the bottom of the chat input before invoking any `ido4shape` skill. Without a folder selected, Cowork's injection-defense layer blocks the plugin from writing the workspace files it needs.

In Claude Code this is automatic — the working directory is wherever you launched the CLI.

## First session — the typical flow

From inside Cowork or Claude Code, with your project folder selected:

```
/create-spec my-project
```

(Replace `my-project` with a short name for your project — used as the workspace marker and the eventual spec filename root. In Claude Code prefix the skill name with the plugin: `/ido4shape:create-spec my-project`.)

What happens:

1. **The agent scans your folder** for existing materials and reads everything it finds. Documents, sketches, meeting notes, code — anything that helps it understand the problem space.
2. **The conversation begins** with observations, not questions. *"I read your three documents. Sarah flagged that users miss critical alerts, and your architecture doc assumes synchronous delivery — has the team thought about whether that holds at 10K events/minute?"*
3. **The agent updates the canvas** (`.ido4shape/canvas.md`) after every significant insight. You can read the canvas at any point — it's plain markdown, human-readable, and represents the agent's current understanding.
4. **You can stop any time.** The canvas persists. A future session — days or weeks later — picks back up where you left off. The agent re-reads the canvas, the decisions file, and the tensions file before opening with what's been on its mind since the last session.

When the conversation feels saturated and the canvas's Understanding Assessment shows depth across the six dimensions (Problem, Solution, Boundaries, Risks, Dependencies, Quality), crystallize:

```
/synthesize-spec
```

Output: a strategic spec markdown file at `{project-name}-spec.md` in your project root. Then optionally verify:

```
/validate-spec my-project-spec.md
```

That's the minimum loop: **discover → crystallize → validate**. The other skills (`/review-spec`, `/refine-spec`, `/stakeholder-brief`) are for more deliberate workflows — independent reviews before crystallizing, post-crystallization edits, and onboarding new stakeholders mid-project.

## What to expect on the first session

- **No fixed structure to follow.** The conversation goes where the problem leads. You'll bounce between problem depth, solution shape, risks, and dependencies non-linearly — that's by design. The canvas keeps your place.
- **Observations, not generic questions.** If you brought materials in, the agent reads them first. You won't hear *"Tell me about your project"* when you've already given it the PRD.
- **The agent will push back.** It probes assumptions, surfaces tensions between stakeholder perspectives, and isn't afraid to say *"I notice we haven't talked about who validates this — should we?"* Treat it as a thinking partner, not a transcription tool.
- **You can switch perspectives.** If a senior architect joins the project mid-spec, run `/create-spec --as architect` (or invoke `/stakeholder-brief architect` first to onboard them). The agent adapts its conversation style to the role and tracks whose perspective is represented where.
- **No auto-synthesis.** The agent will *suggest* synthesis when the canvas feels mature, but it won't crystallize without you saying so. The cost of premature synthesis is a thin spec; the canvas is the cheaper place to correct.

## Where to go next

- **[How it works](./how-it-works/)** — the canvas, knowledge dimensions, stakeholder model, what synthesis actually produces
- **[Skill reference](./skills/create-spec/)** — per-skill pages with stages, inputs, outputs, and common failure modes
- **[FAQ + troubleshooting](./faq/)** — common questions and scenario recipes
