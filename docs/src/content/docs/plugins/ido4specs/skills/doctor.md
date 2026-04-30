---
title: "/doctor"
description: "Plugin diagnostic — confirms ido4specs is installed correctly, validators are present, and reports the next pipeline action given your workspace state."
---

`/doctor` is the diagnostic skill. It runs a battery of health checks and reports a PASS/FAIL summary with specific remediation for each failure. Use it any time something seems off, and especially right after installing the plugin.

The skill is implemented as a single shell script invocation that produces a fully-formatted report — no multi-step interrogation. One bash call, ~12 lines of output, done.

## When to use

- Right after installing the plugin — confirms everything's in place
- When a pipeline skill fails with a validator-related error
- When the bundled validators seem out of sync (e.g., features missing)
- Periodically as a sanity check, especially after Claude Code updates

## Invocation

```
/doctor
```

No arguments. The skill runs all checks regardless of project state.

## What it checks

The doctor runs eight checks:

| # | Check | What it verifies |
|---|---|---|
| 1 | **Node.js** | `node --version` reports v18 or higher |
| 2 | **Bundled validators** | Both `tech-spec-validator.js` and `spec-validator.js` exist in `${CLAUDE_PLUGIN_DATA}` (the SessionStart hook should have copied them) |
| 3 | **Validator execution** | Both validator binaries run without crashing (exit cleanly on `--help`) |
| 4 | **Version markers** | `dist/.tech-spec-format-version` and `dist/.spec-format-version` are present and contain valid semver strings |
| 5 | **Checksums** | The bundled validators' SHA-256 checksums match the recorded checksums (no local tampering) |
| 6 | **Round-trip test** | The technical-spec validator parses the example fixture (`references/example-technical-spec.md`) and reports `valid: true` |
| 7 | **Workspace state** | Scans `specs/` and `docs/specs/` for existing artifacts. Reports the next sensible action given what's found (e.g., "strategic spec found at X — next: `/create-spec X`") |
| 8 | **Status line** | Checks whether the optional ido4specs status line is configured in user or project settings. Emits the config block if not configured |

## Output

A formatted report. Example PASS output:

```
ido4specs doctor — diagnostic report

Plugin version:  0.4.3

1. Node.js:             PASS (v20.18.1)
2. Bundled validators:  PASS (both in plugin data)
3. Validator execution: PASS (both run without crash)
4. Version markers:     PASS (tech-spec-format@0.9.1, spec-format@0.9.1)
5. Checksums:           PASS (both match)
6. Round-trip test:     PASS (example-technical-spec.md validates clean)
7. Workspace state:     strategic spec at data-connector-spec.md
                        → next: /create-spec data-connector-spec.md
8. Status line:         not configured (opt-in available)

Result: ALL CHECKS PASSED
```

The plugin version line answers *"am I on the version I expect?"* — useful after `/plugin update` or when debugging a behavioral surprise. The workspace-state line includes a **next-action suggestion** that adapts to what artifacts exist:

- Strategic spec only → suggest `/create-spec X`
- Canvas exists → suggest `/synthesize-spec X`
- Technical spec exists → suggest `/review-spec X` or `/validate-spec X`
- No artifacts → suggest authoring a strategic spec or installing `ido4shape`

## What FAIL output looks like

If a check fails, the FAIL line names the issue specifically and the next line gives the remediation. Example:

```
2. Bundled validators:  FAIL (missing: tech-spec-validator.js — start a fresh
                              Claude Code session to re-trigger the SessionStart hook)
```

The report's footer says `Result: 1 CHECK(S) FAILED — see remediation in the relevant line(s) above`. Exit code is 1 (vs 0 for ALL PASS), useful for scripting.

## Optional: status line opt-in

Check 8 reports whether the status line is configured. The status line is an optional UI tweak — when configured, Claude Code's bottom UI bar shows your current ido4specs state (`ido4specs · spec ✓ {project-name}` etc.). The skill doesn't enable it by default — it requires you to add the config block to `~/.claude/settings.json` or `.claude/settings.json`. Doctor emits the exact config block (with absolute path resolved) for you to paste in.

## Common failures

- **Validator missing from plugin data.** The SessionStart hook didn't run (or ran into an error). Start a fresh Claude Code session to retrigger it.
- **Checksum mismatch.** The bundled validator binary doesn't match the recorded checksum. Likely cause: a manual edit to `dist/spec-validator.js`. Run `/plugin update ido4specs@ido4-plugins` to restore the canonical bundle.
- **Round-trip test fails.** The bundled validator can't parse the example fixture — indicates a validator/fixture version mismatch. Update the plugin via the marketplace.

## Related

- [Get started](../get-started/) — install + prerequisites + first run
- [FAQ + troubleshooting](../faq/) — broader troubleshooting reference
