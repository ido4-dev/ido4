---
title: "ido4specs"
description: "Turn a written spec into a structured technical spec your team — or any downstream tool — can act on. Overview of the three-phase pipeline."
---

You wrote (or were handed) a spec describing what to build. It's a thoughtful document — stakeholders weighed in, success conditions are agreed, the constraints are real. It's also a wall of prose. The question is now: what *exactly* are we building, in what order, and how do we hand that to engineering without losing what the spec authors meant?

`ido4specs` is a [Claude Code](https://www.anthropic.com/claude-code) plugin that runs the gap. It reads the strategic spec, looks at the actual codebase (or the integration targets if it's greenfield), and produces a **technical spec**: a structured markdown artifact where every capability has tasks with effort, risk, AI suitability, dependencies, and code-verifiable success conditions. Plain markdown. Any downstream tool can ingest it — `ido4dev` turns it into GitHub issues, your existing PM tooling can parse it, your team can read it.

In the ido4 suite, **`ido4shape` captures the WHY and the WHAT** (strategic intent + capabilities). **`ido4specs` takes the WHAT and adds the HOW** (concrete tasks grounded in your codebase). **`ido4dev` — or any downstream tool you bring — handles execution** (turning the spec into issues your team works against). This page is about the middle plugin: WHAT → HOW.

The point is **traceability without ceremony**. The strategic spec author sees their language preserved. Engineering sees concrete tasks with file paths. Reviewers see two independent quality layers (deterministic + qualitative). And nothing auto-progresses — there's a human checkpoint at every phase boundary.

## Pipeline at a glance

<details open>
<summary>ido4specs Pipeline — full flow with artifacts and checkpoints</summary>

<a href="/diagrams/11-ido4specs-pipeline.html" target="_blank" rel="noopener" title="Click to open interactive diagram">

![ido4specs Pipeline](/diagrams/previews/11-ido4specs-pipeline.png)

</a>

</details>

Three phases, three artifacts, three review checkpoints:

| Phase | Skill | Wall time | Output |
|---|---|---|---|
| 1 | `/create-spec` | ~15–30 min | Technical Canvas |
| 2 | `/synthesize-spec` | ~10–20 min | Technical Spec (`.md`) |
| 3 | `/review-spec` + `/validate-spec` | ~2–5 min each | Findings + verdict |
| 3+ | `/refine-spec` | ~1–2 min | Edited spec, re-validated |

Total wall time for a 30+ capability spec: typically 30–60 minutes, mostly Phase 1 (codebase analysis is the heavy stage). You can break between phases — a fresh session picks back up from the last artifact.

## What this doesn't do

`ido4specs` is deliberately scoped. It does not:

- **Write code.** It produces a *spec* describing tasks. Engineering (or your AI coding tools) writes the code from there.
- **Run tests or CI.** Success conditions in the spec are *verifiable*, but the verification happens elsewhere.
- **Manage issues or projects.** It outputs markdown. `ido4dev` (or your tool) does the GitHub-issue creation.
- **Enforce a methodology.** The technical spec is methodology-neutral — no Scrum, no Shape Up, no Hydro. Your team's process layers on top.
- **Replace strategic spec authoring.** It consumes a strategic spec; producing one is `ido4shape`'s job (or your existing authoring process).

What it *does* do is the translation layer between strategic intent and engineering execution — which is the gap most spec workflows leave open.

## Where to go from here

- **[Get started](./get-started/)** — install, prerequisites, and the first-run command flow
- **[How it works](./how-it-works/)** — detailed walkthrough of each phase, what each skill does, what artifacts are produced
- **Skill reference** — per-skill pages with stages, inputs, outputs, and failure modes:
  [`/create-spec`](./skills/create-spec/) ·
  [`/synthesize-spec`](./skills/synthesize-spec/) ·
  [`/validate-spec`](./skills/validate-spec/) ·
  [`/review-spec`](./skills/review-spec/) ·
  [`/refine-spec`](./skills/refine-spec/) ·
  [`/doctor`](./skills/doctor/)
- **[FAQ + troubleshooting](./faq/)** — common questions, scenario recipes, and what to do when something goes wrong

## Reference

- **Plugin source and changelog:** [github.com/ido4-dev/ido4specs](https://github.com/ido4-dev/ido4specs)
- **Marketplace install:** `/plugin install ido4specs@ido4-plugins` from inside Claude Code
- **Format reference:** `@ido4/tech-spec-format` on npm — the parser package the plugin ships
- **Upstream pair:** [ido4shape](https://github.com/ido4-dev/ido4shape) helps you author the strategic spec
- **Downstream pair:** [ido4dev](https://github.com/ido4-dev/ido4dev) ingests the technical spec into GitHub issues
