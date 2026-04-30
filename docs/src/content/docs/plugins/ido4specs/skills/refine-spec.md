---
title: "/refine-spec"
description: "Edit an existing technical spec via natural-language instructions. Re-validates after every edit pass to catch regressions immediately."
---

`/refine-spec` edits an existing technical spec. You pass natural-language instructions ("apply W1 and W2", "split capability X into two", "change `ai: full` to `ai: assisted` on Y") and the skill applies surgical edits via the `Edit` tool. After every edit pass it re-runs the bundled parser to catch structural regressions immediately — if you accidentally introduce a dependency cycle, it tells you on this run, not at the next `/validate-spec`.

## When to use

- After `/review-spec` or `/validate-spec` surfaced findings — the most common use
- For small targeted edits (adding a task, changing metadata, fixing a typo)
- When the strategic spec changed slightly and you want to refine the existing tech spec rather than re-synthesize

Do NOT use this for large structural rewrites or when the strategic spec changed substantially. Re-running `/synthesize-spec` against a fresh canvas is cleaner for those.

This skill **only operates on technical specs.** Strategic-spec refinement lives in `/ido4shape:refine-spec`. The skill checks the format marker; if you pass a strategic spec by mistake, it redirects you.

## Invocation

```
/refine-spec <path-to-tech-spec.md>
```

After the skill loads, describe the edits you want in plain English:

> *"Apply W1 and W2 from the review report"*
> *"Split capability NCO into NCO and NCX, with NCO-03B becoming NCX-01A"*
> *"Add a new task NCO-04 that handles error recovery"*
> *"Change `ai: full` to `ai: assisted` on every DCT-* RPC handler"*

The skill **announces the plan before editing** — listing each edit it'll make so you can confirm scope. For complex refines (splitting capabilities, large dependency rewrites) it surfaces ripple effects upfront ("if we split this capability, these 3 tasks need new prefixes...").

## What it does

The skill follows this loop:

1. **Capture baseline.** Runs the bundled validator on the unchanged spec to record the starting state.
2. **Understand the change.** Parses your natural-language instruction. Identifies the affected sections.
3. **Surface ripple effects** (for non-trivial changes). If your instruction has implications you might not have anticipated, the skill names them and asks for confirmation.
4. **Apply edits.** Uses the `Edit` tool for surgical changes — typically one line of `depends_on`, a metadata value, a description tweak. Keeps the diff minimal.
5. **Re-validate.** Runs the bundled parser after every edit pass. If the change introduced a structural regression, the skill reports it immediately.
6. **Report.** Summarizes what changed, with metric deltas (dependency edges, max depth, success conditions) so you can see the impact.

## Common edit types

- **Adding a task.** The skill picks the next available ref (continues the letter sequence within a capability). Writes a description ≥ 200 chars, references file paths, picks reasonable metadata, adds at least 2 success conditions. Updates downstream tasks' `depends_on` if you've said the new task should block them.
- **Removing a task.** The skill greps for any `depends_on` referencing the doomed task. If references exist, it warns and offers to update them or point them at alternative targets. No silent orphan creation.
- **Splitting a capability.** Creates two capabilities with new names. Reassigns tasks by domain. Updates all `depends_on` that crossed the old boundary. Each new capability gets its own metadata.
- **Merging capabilities.** Chooses a surviving prefix. Reassigns tasks. Updates `depends_on` references that used the merged prefix.
- **Changing task metadata.** Effort, risk, type, ai adjustments. The skill explains downstream impact (e.g., moving `ai: full → ai: human` blocks automated start transitions in any governance tooling that consumes the spec).
- **Fixing validation errors.** When invoked after `/validate-spec` FAIL, the skill works through reported errors in order, making the minimal correct edit per error and re-validating after each.

## Output

The skill reports:

- **What changed** — the specific edits applied, with old → new diffs
- **Validation status** — PASS / structural errors caught
- **Metric deltas** — dependency edge count change, max depth change, no cycles introduced
- **Next step suggestion** — typically pointing you at `/review-spec` for a fresh qualitative pass on the updated spec, or at downstream tooling if changes were trivial

## Common failures

- **Edit introduces a regression.** The bundled parser catches it after the edit. The skill rolls back and reports what broke. Most common: `depends_on` reference pointing at a non-existent task (typo or missing target), circular dependency from a new edge, malformed task ref.
- **Ambiguous instruction.** If your natural-language instruction is unclear (e.g., "fix the dependency thing"), the skill asks a clarifying question rather than guessing. Edits are easier to apply once than to undo.
- **Missing baseline file.** Stops with the missing path. Check the spec is at the location you passed.
- **Validator bundle missing.** Same fix as in [`/validate-spec`](./validate-spec/) — start a fresh session to retrigger the SessionStart hook.

For deeper troubleshooting, see the [FAQ + troubleshooting](../faq/) page.

## Related

- [Refining the spec](../how-it-works/#refining-the-spec) — narrative context
- [`/validate-spec`](./validate-spec/) — surface structural findings to refine
- [`/review-spec`](./review-spec/) — surface qualitative findings to refine
- [`/synthesize-spec`](./synthesize-spec/) — for re-generating from scratch when refining gets too complex
