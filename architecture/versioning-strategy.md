# Versioning Strategy

## Semver Rules

Both `@ido4/core` and `@ido4/mcp` are published at the **same version**. They move in lockstep.

| Change Type | Bump | Examples |
|---|---|---|
| **Patch** (0.x.**Y**) | Bug fixes, doc corrections, test additions | Fix BRE step that was incorrectly passing, fix GraphQL pagination edge case |
| **Minor** (0.**X**.0) | New features, new tools, new validation steps, new skills | Add new domain service, add new BRE steps, add new skill, new methodology profile support |
| **Major** (**X**.0.0) | Breaking changes to MCP tool interface, profile format, or core service interfaces | Rename tools, change ToolResponse shape, break profile backward compatibility |

## Pre-1.0 Rules

While in 0.x.y:
- Minor bumps may include small breaking changes (documented in CHANGELOG)
- The MCP tool interface is stabilizing but not frozen
- Profile format changes are additive (new fields OK, removing fields = minor bump with migration notes)

## 1.0 Criteria

1.0 requires:
- End-to-end validation with real ido4shape strategic spec (decomposition pipeline proven)
- At least one enterprise pilot engagement completed
- MCP tool interface stable for 2+ minor versions
- Profile format frozen (additive changes only)
- All documentation current and verified

## Release Process

```bash
./scripts/release.sh 0.5.0
```

The release script runs pre-release verification before bumping:

1. **Build** — must compile cleanly
2. **Tests** — all tests must pass
3. **BRE step count** — docs must match actual registered steps
4. **CHANGELOG** — version must have release notes
5. **Doc freshness** — warns if code changed after last doc update
6. **Website sync** — checks if website numbers match actual counts

Errors block the release. Warnings require explicit confirmation.

After the script: CI builds, tests, and publishes to npm on the version tag.

## Post-Release Checklist

- Verify npm publish succeeded
- Update website if public-facing numbers changed (build + `firebase deploy`)
- Update MEMORY.md version references
- Announce if significant changes

## Release Cadence

No fixed cadence. Release when:
- A meaningful set of features/fixes is ready
- The CHANGELOG tells a coherent story
- All pre-release checks pass
