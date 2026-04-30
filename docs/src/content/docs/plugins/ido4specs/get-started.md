---
title: "Get started"
description: "Install ido4specs, confirm prerequisites, run the pipeline end-to-end for the first time."
---

This page covers installation, prerequisites, and the typical first-run flow. For the conceptual story, see the [Overview](./). For the per-phase walkthrough, see [How it works](./how-it-works/).

## Install

`ido4specs` is a Claude Code plugin distributed through the `ido4-plugins` marketplace. From inside Claude Code:

```
/plugin install ido4specs@ido4-plugins
```

After installation, restart your Claude Code session (or run `/reload-plugins`) so the plugin's skills become invocable.

## Prerequisites

| Prerequisite | Why it's needed | How to confirm |
|---|---|---|
| **[Claude Code](https://www.anthropic.com/claude-code)** | `ido4specs` is a Claude Code plugin and runs entirely as skills inside it | Run `claude --version` or open the Claude Code app |
| **Node.js 18+** | The bundled spec validators are JavaScript binaries that run via Node | Run `node --version` and confirm v18 or higher |
| **A strategic spec** | The input the pipeline consumes — a markdown file describing capabilities, success conditions, dependencies, and cross-cutting concerns | See "The strategic spec" below |
| **A workspace directory** | Somewhere for `ido4specs` to write the canvas and the technical spec | Any folder. The plugin creates a `specs/` subdirectory if one doesn't exist |

### The strategic spec

The strategic spec is the input. It's a markdown file in the format the bundled `@ido4/spec-format` parser accepts. You have two paths to one:

**1. Author it with [`ido4shape`](https://github.com/ido4-dev/ido4shape).** The natural pair — `ido4shape` walks you through Socratic conversation to produce the strategic spec, capturing the WHY (motivation) and the WHAT (capabilities, success conditions, cross-cutting concerns) without committing to the HOW.

**2. Hand-author it from the template.** `ido4specs` ships an example fixture you can copy. The format requires:

- A project header with format marker: `> format: strategic-spec | version: 1.0`
- One or more groups (`## Group: ...`)
- Capabilities under each group (`### Capability: NAME-NN: ...`)
- Per-capability success conditions and dependencies
- Optional cross-cutting concerns section

The `@ido4/spec-format` package on npm has the full grammar. Or run any strategic spec through `node "${CLAUDE_PLUGIN_DATA}/spec-validator.js" your-spec.md` and the parser will tell you what's missing.

## Health check

Before your first run, confirm the plugin is properly installed:

```
/doctor
```

The doctor reports:
- Plugin version
- Bundled validator versions and checksums
- A round-trip parse test against the example fixture
- Workspace state (any artifacts already present?)
- Suggested next action given that state

If you see `ALL CHECKS PASSED`, you're good. If something fails, the doctor's output names the specific issue and the remediation step.

Run `/doctor` any time something feels off — it's the cheapest debugging tool the plugin provides.

## First run — the typical flow

Place your strategic spec at the project root or under `specs/`. From inside Claude Code, run the pipeline as five commands with reviews between each phase:

```bash
# 1. Phase 1 — read the spec, explore code, produce canvas
/create-spec specs/your-strategic-spec.md
# Output: specs/your-tech-canvas.md
# Wall time: 15–30 min for a 30+ capability spec

# 2. Review the canvas in your editor before continuing.
#    Spend 5 minutes on the "Discoveries & Adjustments" section
#    and the risk hot-spots — those drive the next phase's quality.

# 3. Phase 2 — decompose canvas into tasks
/synthesize-spec specs/your-tech-canvas.md
# Output: specs/your-tech-spec.md
# Wall time: 10–20 min

# 4. Review the technical spec.

# 5. Phase 3 — cross-check with both review layers
/review-spec   specs/your-tech-spec.md
/validate-spec specs/your-tech-spec.md

# 6. If either review surfaced findings, apply edits + re-validate
/refine-spec specs/your-tech-spec.md
```

Total wall time: typically 30–60 minutes end-to-end for a 30+ capability strategic spec. Phase 1 dominates because codebase exploration is the heavy stage. You can break between any two skills — a fresh Claude Code session picks back up from the last artifact.

For the detail of what each phase does internally, see [How it works](./how-it-works/).

## What to expect on the first run

- **Permission prompts.** The first time the plugin invokes `node` (to run the validator), Claude Code asks for permission. Pick *"Yes, don't ask again for: `node *`"* if you want a smooth flow on subsequent runs. The validator binaries are read-only — they parse markdown and emit JSON, no other side effects.
- **Long Phase 1 wall time.** Codebase exploration takes minutes, not seconds. Token count flowing in the indicator means progress is real; if it stalls completely (no token growth for >2 minutes), cancel and retry.
- **Multiple files written.** Canvas + technical spec, both in the workspace's `specs/` directory by default. The canvas file is large (2,000–3,000 lines for a 30+ capability spec) — that's expected. The technical spec is smaller (typically under 1,000 lines).
- **Auto-validation after each Write.** Phase 2 auto-runs the bundled parser before returning, so structural errors surface immediately, not later. Same for Phase 4 (refine-spec re-validates after every edit pass).

## Where to go next

- **[How it works](./how-it-works/)** — detailed walkthrough of the three phases, what each skill does, and what artifacts are produced
- *Skill reference, FAQ + Troubleshooting — coming soon as separate pages*
