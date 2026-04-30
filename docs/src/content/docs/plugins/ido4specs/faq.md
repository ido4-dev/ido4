---
title: "FAQ + troubleshooting"
description: "Common questions about ido4specs — workflow scenarios, edge cases, and what to do when something goes wrong."
---

Common questions, scenario recipes, and a troubleshooting reference. If you don't see your question here, the [How it works](./how-it-works/) page covers per-phase behavior in detail; the Reference section in the [Overview](./) lists the source repos.

## Getting started questions

### Do I need ido4shape to use ido4specs?

No. `ido4shape` is the natural upstream pair (it produces strategic specs through Socratic conversation), but any markdown file matching the `@ido4/spec-format` grammar works as input. You can hand-author a strategic spec from the example fixture the plugin ships, generate one from a different tool, or paste in something a teammate sent you.

That said, if you don't have a strategic spec yet *and* you don't want to write one by hand, `ido4shape` is the path of least resistance. See its [docs](https://github.com/ido4-dev/ido4shape).

### Does ido4specs work without a codebase?

Yes — `ido4specs` detects the project mode automatically:

- **`existing`** — your project has source code. Phase 1 explores the codebase to ground each capability in real file paths.
- **`greenfield-with-context`** — no code yet, but the strategic spec references integration targets (a sibling plugin repo, an external API spec, etc.). Phase 1 explores those targets instead of your own code.
- **`greenfield-standalone`** — truly green field, no targets to explore. Phase 1 still runs but produces a thinner canvas (mostly strategic context preservation, fewer code-grounded patterns).

You don't pick the mode; it's detected from your project state. Phase 0.5 of `/create-spec` reports which mode it picked and why.

### Does it work with monorepos?

Yes, but with a caveat. Phase 1's `Explore` subagents start at the workspace root. If your monorepo has many unrelated packages, the exploration is broader than useful. Two options:

1. **Run `ido4specs` from a subdirectory.** Open Claude Code rooted at the specific package directory you're speccing. The exploration scope tightens to that package.
2. **Use greenfield-with-context mode.** If the strategic spec references specific package paths as integration targets (e.g., *"the `packages/billing` directory is the source of truth for billing logic"*), Phase 1's subagents focus on those paths instead of the whole monorepo.

In practice, a focused workspace root is the cleanest fix for monorepo scale.

### Can I customize the task metadata format?

The metadata fields (`effort`, `risk`, `type`, `ai`, `depends_on`) and their allowed values are defined by `@ido4/tech-spec-format`. The plugin can't customize them — adding a custom field would break the parser contract that downstream tools rely on.

If you need custom fields for your team's workflow (e.g., team assignment, sprint label), add them in the downstream stage. `ido4dev` maps tech-spec metadata to GitHub Projects custom fields — that's where team-specific extensions belong, not in the spec itself.

## Workflow scenarios

### What if I want to update an existing technical spec?

The intended workflow when the strategic spec changes:

1. Update the strategic spec (in `ido4shape` or your editor)
2. Re-run `/create-spec` — produces a fresh canvas
3. Re-run `/synthesize-spec` — produces a fresh tech spec

If the changes are small and you want to preserve manual edits in the existing tech spec, use `/refine-spec` with natural-language instructions instead:

```
/refine-spec specs/your-tech-spec.md
```

Then tell the skill what to change. It applies surgical `Edit` operations and re-validates after every pass. Good for adding tasks, splitting capabilities, adjusting metadata. Not good for large structural rewrites — re-running `/synthesize-spec` is cleaner for those.

### Can I run multiple `ido4specs` pipelines in parallel?

Yes, in separate Claude Code sessions. Each session can work on a different strategic spec independently. The plugin doesn't have shared state between runs — every artifact is a self-contained file in your workspace.

Within a single session, no — the skills are sequential by design. Phase 2 depends on Phase 1's output, etc.

### How do I review the canvas effectively?

Spend 5–10 minutes scanning these sections in particular:

1. **Discoveries & Adjustments** — what the AI found in the codebase that wasn't obvious from the strategic spec. Surprises live here.
2. **Risk Assessment Summary** — the risk hot-spots flagged for synthesis. If a capability shows up here as `high` and you disagree, the canvas is a cheaper place to redirect than the technical spec.
3. **Per-capability Strategic Context sections** — confirm the original spec's stakeholder attributions and success conditions are preserved verbatim. If the canvas summarized away your spec author's exact words, that loss propagates downstream.

If anything feels off, re-run `/create-spec` rather than papering over in Phase 2. The canvas is the cheapest correction point.

### What does a "PASS WITH WARNINGS" verdict mean?

`/validate-spec` returns three possible verdicts:

- **PASS** — clean. Ready for downstream ingestion.
- **PASS WITH WARNINGS** — structurally valid (no errors blocking ingestion), but the content checks flagged things worth attention. Examples: a task description shorter than 200 chars, a capability with only 1 task at S effort (might be over-decomposed), an `ai: full` task that integrates with an external API (might warrant `ai: assisted` instead). You can ingest with caveats or address the warnings via `/refine-spec`.
- **FAIL** — structural errors. Common cases: a `depends_on` referencing a non-existent task ref, a circular dependency, malformed metadata. Fix via `/refine-spec` and re-validate.

## Troubleshooting

### `/doctor` reports a checksum mismatch

The bundled validator binary doesn't match the recorded checksum. Likely causes: a manual edit to `dist/spec-validator.js` (don't do this — they're auto-generated), a partial download, or a corrupted plugin install. Fix:

```
/plugin update ido4specs@ido4-plugins
```

Then `/doctor` again.

### Phase 1 stalls at "Exploring integration targets"

Token count not growing for >2 minutes means stuck rather than slow. Cancel (Ctrl-C in the terminal, or close the session) and retry. If it stalls again at the same stage, the integration targets the spec references might be unreachable (sibling repo not on disk, network endpoint down). Confirm those references resolve and retry.

### `/synthesize-spec` complains about a missing canvas

The skill expects the canvas at the path you pass it. Common causes:

- Typo in the path
- Canvas was written but to a different directory (Phase 0.5 of `/create-spec` reports the artifact directory it picked — check there)
- Canvas write failed mid-stream (partial file). Re-run `/create-spec` to regenerate

### `/refine-spec` says my edit introduced a regression

The skill re-runs the bundled parser after every edit pass. If the parser fails where it didn't before, the edit broke something. The skill rolls back automatically and tells you what broke. Common cases:

- You changed a task ref (e.g., `WHF-01A` → `WHF-1A`) — drop the leading zero or restore it
- You added a `depends_on` referencing a task that doesn't exist (typo or missing target)
- You removed a task that other tasks depended on — orphaned references

Fix the underlying issue and re-run the refinement.

### "I have findings from `/review-spec` but they look wrong"

Review-spec is LLM-driven judgment, not deterministic. False positives happen — particularly on suggestions about AI-suitability calibration or capability coherence, where the model's heuristic might not match your project's reality. Treat suggestions as inputs to your decision, not directives. If a finding seems wrong, ignore it; if it seems right, address it via `/refine-spec`.

The deterministic checks in `/validate-spec` are stricter and more reliable. If `/validate-spec` says PASS but `/review-spec` flags warnings, you can ship with caveats — the spec is structurally valid.

### The bundled validator versions don't match upstream npm

The plugin's `dist/` directory has snapshot copies of the validators bundled at release time. They're updated through the cross-repo sync pipeline, but there's lag — the npm version may be slightly newer. `/doctor` reports both the bundled version and the latest available; if the lag is significant (e.g., bundled v0.8 but npm has v0.9), update the plugin:

```
/plugin update ido4specs@ido4-plugins
```

If the lag persists after update, the plugin's release pipeline hasn't caught up yet. Open an issue at [github.com/ido4-dev/ido4specs/issues](https://github.com/ido4-dev/ido4specs/issues) and we'll trigger a sync.

## Where to go next

- **[Overview](./)** — what `ido4specs` does and how it fits in the suite
- **[Get started](./get-started/)** — install, prerequisites, first run
- **[How it works](./how-it-works/)** — detailed per-phase walkthrough
- *Skill reference — coming soon as separate per-skill pages*
