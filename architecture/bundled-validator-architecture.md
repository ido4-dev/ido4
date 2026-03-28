# Bundled Validator Architecture

> Deterministic spec validation in ido4shape without runtime dependencies.

**Status:** Spec — ready for implementation review
**Date:** 2026-03-28
**Repos affected:** ido4-MCP, ido4shape, ido4-plugins

---

## 1. Problem Statement

ido4shape needs to validate strategic specs before handoff to ido4 MCP. Without validation at the shape stage, structural errors (broken dependencies, circular refs, invalid metadata) are only caught downstream — after the user has left the conversation that produced the spec.

A previous agent session introduced `@ido4/spec-format` as an npm dependency installed at runtime via a SessionStart hook (`npm install --production`). This approach:

- Requires network access at session start (120s timeout)
- Is untested in Cowork's VM sandbox
- Violates ido4shape's "zero external dependencies, ships as-is" principle
- Adds a fragile runtime dependency to what should be a self-contained plugin

The parser itself (`@ido4/spec-format`) is sound — zero npm dependencies, pure TypeScript, 510 lines, 41 tests. The problem is the delivery mechanism.

## 2. Solution: Bundled Validator

Bundle the parser CLI into a single self-contained `.js` file (~15KB) and ship it inside the plugin. No npm install, no network, no runtime dependencies beyond Node.js (which is pre-installed in Cowork's VM).

### Core Principle

**Build-time complexity, runtime simplicity.** The bundle is produced once (in ido4-MCP's CI), propagated automatically (via cross-repo CI), and used instantly (via file copy at session start).

## 3. Architecture Overview

```
ido4-MCP                    ido4shape                     ido4-plugins
─────────                   ─────────                     ────────────
packages/spec-format/       dist/spec-validator.js        plugins/ido4shape/
  src/cli.ts                  (bundled, committed)          (full directory mirror)
  ↓ esbuild                   ↓
  dist/spec-validator.js    hooks/hooks.json
  (build artifact)            SessionStart: cp → PLUGIN_DATA
  ↓                            ↓
  publish.yml               skills/validate-spec/SKILL.md
  → npm publish               node ${PLUGIN_DATA}/spec-validator.js
  → dispatch to ido4shape      ↓
                             Structured JSON → LLM interprets
                               ↓
                             Validation report
```

## 4. Component Details

### 4.1 ido4-MCP: Bundle Build

**New files:**
- `packages/spec-format/esbuild.bundle.mjs` — build config

**Modified files:**
- `packages/spec-format/package.json` — add `build:bundle` script
- `.github/workflows/ci.yml` — add bundle build + smoke test step
- `.github/workflows/publish.yml` — add `repository_dispatch` to ido4shape after npm publish
- `CLAUDE.md` — document the dispatch and downstream flow

**Bundle build config:**
```javascript
// packages/spec-format/esbuild.bundle.mjs
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/spec-validator.bundle.js',
  minify: true,
  banner: {
    js: `// @ido4/spec-format v${pkg.version} | bundled ${new Date().toISOString().split('T')[0]}\n// Source: https://github.com/ido4-dev/ido4 | DO NOT EDIT`
  },
});
```

**CI smoke test (in ci.yml):**
```yaml
- name: Smoke test spec-format bundle
  run: |
    node packages/spec-format/dist/spec-validator.bundle.js \
      packages/spec-format/tests/fixtures/valid-strategic-spec.md \
      | jq '.valid' | grep -q 'true'
```

**Cross-repo dispatch (in publish.yml, after npm publish steps):**
```yaml
- name: Dispatch bundle update to ido4shape
  uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ secrets.IDO4SHAPE_DISPATCH_TOKEN }}
    repository: ido4-dev/ido4shape
    event-type: spec-format-published
    client-payload: '{"version": "${{ env.SPEC_FORMAT_VERSION }}"}'
```

**esbuild as devDependency:**
```json
"devDependencies": {
  "esbuild": "^0.25.0",
  ...
}
```

### 4.2 ido4shape: Bundle Consumption

**New files:**
- `dist/spec-validator.js` — the bundled parser CLI (committed to git, ~15KB)
- `dist/.spec-format-version` — plain text version marker (e.g., "0.6.0")
- `scripts/update-validator.sh` — fetch and update bundle from npm or local build
- `.github/workflows/update-validator.yml` — automated bundle update workflow

**Modified files:**
- `hooks/hooks.json` — replace npm install with `cp`
- `skills/validate-spec/SKILL.md` — update CLI path
- `scripts/release.sh` — add bundle freshness checks
- `tests/validate-plugin.sh` — add bundle validation tests
- `.gitignore` — ensure `dist/` is NOT ignored
- `CLAUDE.md` — document bundle architecture, release process, agent instructions

**Removed files:**
- `package.json` — no more npm dependencies

#### 4.2.1 SessionStart Hook (hooks.json)

**Before (npm install, fragile):**
```json
{
  "type": "command",
  "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install --production 2>&1) || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\"",
  "timeout": 120
}
```

**After (file copy, instant):**
```json
{
  "type": "command",
  "command": "cp \"${CLAUDE_PLUGIN_ROOT}/dist/spec-validator.js\" \"${CLAUDE_PLUGIN_DATA}/spec-validator.js\" 2>/dev/null || true",
  "timeout": 5
}
```

The `|| true` ensures a failed copy doesn't block session start. The validate-spec skill handles the missing file gracefully.

#### 4.2.2 validate-spec Skill Path Update

**Before:**
```
node "${CLAUDE_PLUGIN_DATA}/node_modules/@ido4/spec-format/dist/cli.js" <path>
```

**After:**
```
node "${CLAUDE_PLUGIN_DATA}/spec-validator.js" <path>
```

#### 4.2.3 update-validator.sh

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PLUGIN_DIR/dist"
BUNDLE_FILE="$DIST_DIR/spec-validator.js"
VERSION_FILE="$DIST_DIR/.spec-format-version"

usage() {
  echo "Usage: $0 <version|path-to-ido4-MCP>"
  echo ""
  echo "Examples:"
  echo "  $0 0.7.0              # Fetch from npm, build bundle"
  echo "  $0 ~/dev/ido4-MCP     # Copy from local build"
  exit 1
}

[ $# -eq 1 ] || usage

SOURCE="$1"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$DIST_DIR"

if [ -d "$SOURCE" ]; then
  # Local path: copy pre-built bundle
  LOCAL_BUNDLE="$SOURCE/packages/spec-format/dist/spec-validator.bundle.js"
  if [ ! -f "$LOCAL_BUNDLE" ]; then
    echo "ERROR: Bundle not found at $LOCAL_BUNDLE"
    echo "Run 'npm run build:bundle' in $SOURCE/packages/spec-format/ first"
    exit 1
  fi
  cp "$LOCAL_BUNDLE" "$BUNDLE_FILE"
  VERSION=$(head -1 "$LOCAL_BUNDLE" | grep -oP 'v\K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
else
  # npm version: fetch package, extract bundle
  VERSION="$SOURCE"
  echo "Fetching @ido4/spec-format@$VERSION from npm..."
  cd "$TMPDIR"
  npm pack "@ido4/spec-format@$VERSION" --silent
  tar xzf ido4-spec-format-*.tgz

  if [ -f "package/dist/spec-validator.bundle.js" ]; then
    cp "package/dist/spec-validator.bundle.js" "$BUNDLE_FILE"
  else
    # Bundle not in npm package — build it
    echo "Bundle not in npm package. Building from source..."
    cp -r package/* .
    npx esbuild src/cli.ts --bundle --platform=node --target=node18 \
      --format=cjs --outfile="$BUNDLE_FILE" --minify \
      --banner:js="// @ido4/spec-format v$VERSION | bundled $(date -I)"
  fi
fi

# Smoke test: run against a known fixture
TEST_SPEC="$PLUGIN_DIR/references/example-strategic-notification-system.md"
if [ -f "$TEST_SPEC" ]; then
  echo "Smoke testing bundle..."
  RESULT=$(node "$BUNDLE_FILE" "$TEST_SPEC" 2>&1) || {
    echo "ERROR: Bundle smoke test failed"
    echo "$RESULT"
    rm -f "$BUNDLE_FILE"
    exit 1
  }
  echo "$RESULT" | head -1 | grep -q '{' || {
    echo "ERROR: Bundle output is not JSON"
    rm -f "$BUNDLE_FILE"
    exit 1
  }
  echo "Smoke test passed."
else
  echo "WARNING: No test fixture found at $TEST_SPEC — skipping smoke test"
fi

# Write version marker
echo "$VERSION" > "$VERSION_FILE"

echo ""
echo "Updated spec-validator.js to v$VERSION"
echo "  Bundle: $BUNDLE_FILE ($(wc -c < "$BUNDLE_FILE" | tr -d ' ') bytes)"
echo "  Version: $VERSION_FILE"
```

#### 4.2.4 update-validator.yml (GitHub Actions)

```yaml
name: Update spec-format bundle

on:
  repository_dispatch:
    types: [spec-format-published]
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 9am UTC (safety net)
  workflow_dispatch:
    inputs:
      version:
        description: 'spec-format version (leave empty for latest)'
        required: false

jobs:
  update-bundle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Determine version
        id: version
        run: |
          if [ -n "${{ github.event.client_payload.version }}" ]; then
            echo "target=${{ github.event.client_payload.version }}" >> $GITHUB_OUTPUT
          elif [ -n "${{ inputs.version }}" ]; then
            echo "target=${{ inputs.version }}" >> $GITHUB_OUTPUT
          else
            LATEST=$(npm view @ido4/spec-format version)
            echo "target=$LATEST" >> $GITHUB_OUTPUT
          fi

      - name: Check if update needed
        id: check
        run: |
          CURRENT=$(cat dist/.spec-format-version 2>/dev/null || echo "none")
          TARGET="${{ steps.version.outputs.target }}"
          echo "current=$CURRENT" >> $GITHUB_OUTPUT
          echo "target=$TARGET" >> $GITHUB_OUTPUT
          if [ "$CURRENT" = "$TARGET" ]; then
            echo "needed=false" >> $GITHUB_OUTPUT
          else
            echo "needed=true" >> $GITHUB_OUTPUT
          fi

      - name: Update bundle
        if: steps.check.outputs.needed == 'true'
        run: bash scripts/update-validator.sh "${{ steps.version.outputs.target }}"

      - name: Determine merge strategy
        if: steps.check.outputs.needed == 'true'
        id: merge
        run: |
          CURRENT="${{ steps.check.outputs.current }}"
          TARGET="${{ steps.check.outputs.target }}"
          # Extract major versions
          CURRENT_MAJOR=$(echo "$CURRENT" | cut -d. -f1)
          TARGET_MAJOR=$(echo "$TARGET" | cut -d. -f1)
          if [ "$CURRENT_MAJOR" != "$TARGET_MAJOR" ] && [ "$CURRENT" != "none" ]; then
            echo "auto=false" >> $GITHUB_OUTPUT
            echo "label=needs-review" >> $GITHUB_OUTPUT
          else
            echo "auto=true" >> $GITHUB_OUTPUT
            echo "label=auto-merge" >> $GITHUB_OUTPUT
          fi

      - name: Create Pull Request
        if: steps.check.outputs.needed == 'true'
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "chore: update spec-validator bundle to v${{ steps.version.outputs.target }}"
          title: "Update spec-validator to v${{ steps.version.outputs.target }}"
          body: |
            Automated bundle update from @ido4/spec-format.

            **Previous version:** ${{ steps.check.outputs.current }}
            **New version:** ${{ steps.version.outputs.target }}

            Bundle has been smoke-tested against the example strategic spec.

            ${{ steps.merge.outputs.auto == 'true' && 'This is a patch/minor update — auto-merge enabled.' || '⚠️ **Major version change** — review validate-spec skill for output format compatibility before merging.' }}
          branch: automated/update-spec-validator
          labels: ${{ steps.merge.outputs.label }}
          delete-branch: true

      - name: Enable auto-merge
        if: steps.check.outputs.needed == 'true' && steps.merge.outputs.auto == 'true'
        run: gh pr merge automated/update-spec-validator --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 4.2.5 release.sh Additions

Add before the version bump:

```bash
# --- Bundle validation ---
BUNDLE="dist/spec-validator.js"
VERSION_FILE="dist/.spec-format-version"

if [ ! -f "$BUNDLE" ]; then
  echo "ERROR: $BUNDLE not found."
  echo "Run: scripts/update-validator.sh <version>"
  exit 1
fi

if ! head -1 "$BUNDLE" | grep -q "@ido4/spec-format v"; then
  echo "ERROR: $BUNDLE missing version header — not a valid bundle"
  exit 1
fi

BUNDLED_VERSION=$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")
LATEST_NPM=$(npm view @ido4/spec-format version 2>/dev/null || echo "unknown")

if [ "$BUNDLED_VERSION" != "$LATEST_NPM" ] && [ "$LATEST_NPM" != "unknown" ]; then
  echo "WARNING: Bundled spec-validator is v$BUNDLED_VERSION, latest on npm is v$LATEST_NPM"
  echo "Consider running: scripts/update-validator.sh $LATEST_NPM"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

echo "Bundle: spec-validator v$BUNDLED_VERSION ✓"
```

#### 4.2.6 CI Test Additions (validate-plugin.sh)

```bash
# --- Bundled validator checks ---
section "Bundled Validator"

assert_file_exists "dist/spec-validator.js" "Validator bundle exists"
assert_file_exists "dist/.spec-format-version" "Version marker exists"

# Version header check
if head -1 dist/spec-validator.js | grep -q "@ido4/spec-format v"; then
  pass "Bundle has version header"
else
  fail "Bundle missing version header"
fi

# Smoke test (if node available)
if command -v node &>/dev/null; then
  TEST_SPEC="references/example-strategic-notification-system.md"
  if [ -f "$TEST_SPEC" ]; then
    if node dist/spec-validator.js "$TEST_SPEC" >/dev/null 2>&1; then
      pass "Bundle executes successfully"
    else
      fail "Bundle execution failed"
    fi
  fi
fi
```

### 4.3 ido4shape: Marketplace Sync Fix (sync-marketplace.yml)

**Current behavior:** Updates version in `marketplace.json` only.
**Required behavior:** Full directory sync of plugin files.

```yaml
name: Sync to marketplace

on:
  push:
    branches: [main]
    paths:
      - '.claude-plugin/plugin.json'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout ido4shape
        uses: actions/checkout@v4
        with:
          path: source

      - name: Read version
        id: version
        run: |
          VERSION=$(jq -r '.version' source/.claude-plugin/plugin.json)
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Checkout marketplace
        uses: actions/checkout@v4
        with:
          repository: ido4-dev/ido4-plugins
          token: ${{ secrets.MARKETPLACE_TOKEN }}
          path: marketplace

      - name: Sync plugin directory
        run: |
          # Clean target directory
          rm -rf marketplace/plugins/ido4shape

          # Copy plugin files (exclude dev-only files)
          mkdir -p marketplace/plugins/ido4shape
          rsync -av --exclude='.git' \
                    --exclude='.github' \
                    --exclude='.claude' \
                    --exclude='drafts' \
                    --exclude='reports' \
                    --exclude='*.plan.md' \
                    --exclude='VISION.md' \
                    --exclude='.ido4shape' \
                    source/ marketplace/plugins/ido4shape/

      - name: Update marketplace manifest
        run: |
          cd marketplace
          jq --arg v "${{ steps.version.outputs.version }}" \
            '(.plugins[] | select(.name == "ido4shape")).version = $v' \
            .claude-plugin/marketplace.json > tmp.json && mv tmp.json .claude-plugin/marketplace.json

      - name: Commit and push
        run: |
          cd marketplace
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          if git diff --cached --quiet; then
            echo "No changes to sync"
            exit 0
          fi
          git commit -m "sync ido4shape v${{ steps.version.outputs.version }}"
          git push

      - name: Create release
        if: success()
        uses: softprops/action-gh-release@v2
        with:
          tag_name: "ido4shape-v${{ steps.version.outputs.version }}"
          name: "ido4shape v${{ steps.version.outputs.version }}"
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4.4 ido4-plugins

**No changes needed.** This repo receives updates via the improved sync workflow. It has no independent CI or automation.

## 5. CI/CD Flow Diagram

```
                    ido4-MCP
                    ════════

  push/PR ──→ ci.yml
              ├── npm run build          (includes spec-format bundle)
              ├── npm run test           (1,731 tests)
              └── smoke test bundle      (run against fixture)

  tag v* ───→ publish.yml
              ├── npm publish @ido4/spec-format
              ├── npm publish @ido4/core
              ├── npm publish @ido4/mcp
              └── repository_dispatch → ido4shape
                                        │
                    ido4shape            │
                    ════════            │
                                        ▼
  dispatch ─────────────────→ update-validator.yml
  schedule (weekly) ────────→   ├── check if update needed
  workflow_dispatch ────────→   ├── fetch from npm + smoke test
                                ├── create PR (with bundle)
                                └── auto-merge if patch/minor
                                        │
                                        ▼ (merge)
  push/PR ──→ ci.yml
              └── validate-plugin.sh     (125+ tests, includes bundle checks)

  plugin.json version change ──→ sync-marketplace.yml
                                 ├── full directory rsync to ido4-plugins
                                 ├── update marketplace.json version
                                 ├── commit + push
                                 └── create GitHub release
                                        │
                    ido4-plugins         │
                    ═══════════         │
                                        ▼
                    Receives full plugin directory
                    No independent CI needed
                    Users install via Cowork/CLI
```

## 6. Runtime Flow

```
User starts session (Cowork or CLI)
  │
  ▼
SessionStart hook fires
  ├── session-start.sh: create/detect .ido4shape/ workspace
  └── cp ${PLUGIN_ROOT}/dist/spec-validator.js → ${PLUGIN_DATA}/spec-validator.js
      (instant, offline, no network)
  │
  ... user works on spec via /ido4shape:create-spec ...
  │
  ▼
User runs /ido4shape:validate-spec
  │
  ▼
Pass 1: Structural Validation (deterministic)
  ├── node ${PLUGIN_DATA}/spec-validator.js <spec-file.md>
  ├── Parser returns structured JSON:
  │   ├── errors (with line numbers, severity)
  │   ├── warnings
  │   ├── metrics (group count, capability count, dep depth)
  │   └── dependency graph
  └── If CLI unavailable → skip pass, note in report
  │
  ▼
Pass 2: Content Quality (LLM)
  ├── Read spec + canvas
  ├── Check description depth (≥200 chars, multi-stakeholder)
  ├── Check success conditions (specific, verifiable)
  ├── Check for synthesis loss (canvas → spec)
  └── Frame findings for downstream ido4 MCP consumer
  │
  ▼
Validation Report
  ├── Structural issues (from parser, authoritative)
  ├── Content quality issues (from LLM, advisory)
  └── Recommended fixes with priority
```

## 7. Failure Modes

| # | Failure | Detection | Impact | Recovery |
|---|---------|-----------|--------|----------|
| 1 | esbuild fails to bundle | ido4-MCP CI fails | No broken artifact ships | Fix build, re-run CI |
| 2 | Bundle produces wrong output | ido4-MCP CI smoke test fails | No broken artifact ships | Fix parser, re-run CI |
| 3 | Dispatch to ido4shape fails | Weekly schedule catches it | Delayed update (max 7 days) | Manual workflow_dispatch or wait for schedule |
| 4 | npm fetch fails in update workflow | Workflow fails, no PR created | Same as #3 | Retry or use local build |
| 5 | Bundle missing in ido4shape | CI fails (validate-plugin.sh) | Cannot merge/release | Run update-validator.sh |
| 6 | Bundle stale vs npm | release.sh warns | Human/agent decides to update or proceed | Run update-validator.sh |
| 7 | Marketplace sync fails | sync-marketplace.yml fails | Users don't get update | Fix workflow, re-push |
| 8 | `cp` fails at session start | validate-spec skill detects missing file | LLM-only validation (graceful) | Reinstall plugin |
| 9 | Node.js unavailable at runtime | validate-spec skill detects exec error | LLM-only validation (graceful) | Environment issue, not our bug |
| 10 | Major parser version breaks skill | Major bump skips auto-merge, needs review | PR waits for review | Update validate-spec skill, then merge |
| 11 | Bad bundle reaches users | Unlikely (4 validation layers) | Wrong validation results | Revert bundle PR, release patch |

## 8. Secrets & Permissions

| Secret | Repo | Used by | Purpose | Exists? |
|--------|------|---------|---------|---------|
| `NPM_TOKEN` | ido4-MCP | publish.yml | Publish to npm | Yes |
| `FIREBASE_SERVICE_ACCOUNT_IDO4_2F468` | ido4-MCP | docs.yml | Deploy docs | Yes |
| `IDO4SHAPE_DISPATCH_TOKEN` | ido4-MCP | publish.yml | repository_dispatch to ido4shape | **NEW** — needs `repo` scope on ido4-dev/ido4shape |
| `MARKETPLACE_TOKEN` | ido4shape | sync-marketplace.yml | Push to ido4-plugins | Yes |
| `GITHUB_TOKEN` | ido4shape | update-validator.yml | Create PR, enable auto-merge | Built-in (needs auto-merge permission) |

**GitHub repo settings needed:**
- ido4shape: enable "Allow auto-merge" in repo settings
- ido4shape: branch protection on `main` with required status checks (CI must pass)

## 9. CLAUDE.md Updates

### 9.1 ido4-MCP CLAUDE.md Addition

```markdown
## Downstream: ido4shape Validator Bundle

When @ido4/spec-format is released (via `scripts/release.sh`), the publish workflow:
1. Publishes all three packages to npm
2. Dispatches a `spec-format-published` event to ido4shape

ido4shape's CI automatically creates a PR to update its bundled validator copy.
No manual downstream steps needed after tagging a release.

The bundle is built by `npm run build:bundle` in `packages/spec-format/`.
It produces `dist/spec-validator.bundle.js` — a single-file esbuild bundle of the CLI.
```

### 9.2 ido4shape CLAUDE.md Changes

Replace the current npm-related content with:

```markdown
## Bundled Validator

ido4shape ships a bundled copy of the @ido4/spec-format parser CLI at `dist/spec-validator.js`.
This is a single self-contained JS file (~15KB) with zero npm dependencies.

**How it works:**
- SessionStart hook copies the bundle to `${CLAUDE_PLUGIN_DATA}/spec-validator.js`
- The validate-spec skill runs it via `node` to get deterministic structural validation
- If the bundle is unavailable, validation falls back to LLM-only (graceful degradation)

**How it's updated:**
- ido4-MCP publishes @ido4/spec-format → CI dispatches to ido4shape
- update-validator.yml creates a PR with the new bundle
- Patch/minor updates auto-merge after CI passes
- Major version updates require review (output format may have changed)

**Manual update (if needed):**
  scripts/update-validator.sh 0.7.0         # from npm
  scripts/update-validator.sh ~/dev/ido4-MCP # from local build

**Release checks:**
- `release.sh` hard-fails if bundle is missing
- `release.sh` warns if bundle version differs from latest npm version
- CI validates bundle presence, version header, and execution
```

## 10. Implementation Order

Work must happen in dependency order. Each step must be verified before the next.

### Phase 1: Build the bundle (ido4-MCP)

| # | Task | Files |
|---|------|-------|
| 1.1 | Add esbuild as devDependency to spec-format | `packages/spec-format/package.json` |
| 1.2 | Create bundle build config | `packages/spec-format/esbuild.bundle.mjs` |
| 1.3 | Add `build:bundle` script | `packages/spec-format/package.json` |
| 1.4 | Add bundle step to root build | Root `package.json` |
| 1.5 | Add test fixture for smoke test | `packages/spec-format/tests/fixtures/valid-strategic-spec.md` (if not exists) |
| 1.6 | Add bundle build + smoke test to CI | `.github/workflows/ci.yml` |
| 1.7 | Add repository_dispatch to publish workflow | `.github/workflows/publish.yml` |
| 1.8 | Update CLAUDE.md | `CLAUDE.md` |
| 1.9 | Verify: `npm run build:bundle` produces working single-file bundle | Manual |

### Phase 2: Consume the bundle (ido4shape)

| # | Task | Files |
|---|------|-------|
| 2.1 | Run update-validator.sh from local ido4-MCP build to get initial bundle | `dist/spec-validator.js`, `dist/.spec-format-version` |
| 2.2 | Remove package.json | Delete `package.json` |
| 2.3 | Update hooks.json: replace npm install with cp | `hooks/hooks.json` |
| 2.4 | Update validate-spec skill: new CLI path | `skills/validate-spec/SKILL.md` |
| 2.5 | Add update-validator.sh script | `scripts/update-validator.sh` |
| 2.6 | Add update-validator.yml workflow | `.github/workflows/update-validator.yml` |
| 2.7 | Add bundle checks to validate-plugin.sh | `tests/validate-plugin.sh` |
| 2.8 | Update release.sh with bundle checks | `scripts/release.sh` |
| 2.9 | Update .gitignore (ensure dist/ is tracked) | `.gitignore` |
| 2.10 | Fix sync-marketplace.yml for full directory sync | `.github/workflows/sync-marketplace.yml` |
| 2.11 | Update CLAUDE.md | `CLAUDE.md` |

### Phase 3: Verify end-to-end

| # | Task | Method |
|---|------|--------|
| 3.1 | Run ido4shape CI locally | `bash tests/validate-plugin.sh` |
| 3.2 | Test SessionStart hook locally | `claude --plugin-dir ./` |
| 3.3 | Test validate-spec skill locally | Run `/ido4shape:validate-spec` against a spec |
| 3.4 | Test graceful degradation | Delete bundle, run validate-spec, confirm LLM-only works |

### Phase 4: GitHub configuration (human required)

| # | Task | Where |
|---|------|-------|
| 4.1 | Create `IDO4SHAPE_DISPATCH_TOKEN` PAT | GitHub → Settings → Personal Access Tokens |
| 4.2 | Add token as secret in ido4-MCP repo | ido4-MCP → Settings → Secrets |
| 4.3 | Enable auto-merge on ido4shape repo | ido4shape → Settings → General |
| 4.4 | Configure branch protection with required checks | ido4shape → Settings → Branches |

### Phase 5: Release

| # | Task |
|---|------|
| 5.1 | Release ido4shape with bundle (patch or minor version) |
| 5.2 | Verify marketplace sync completes |
| 5.3 | Verify plugin works in Cowork |

## 11. What This Spec Does NOT Cover

- **ido4dev plugin**: Not affected. Separate plugin, separate architecture.
- **Strategic spec format changes**: If the format itself evolves, both the parser and the skills need updating. That's a separate, deliberate effort.
- **ido4 MCP decomposition**: The downstream consumer of specs is not changed by this work.
- **Cowork UI sync**: Still requires manual button click in Cowork UI after marketplace updates. This is a Cowork platform limitation, not something we can automate.

## 12. Success Criteria

1. ido4shape has zero npm runtime dependencies
2. `validate-spec` produces deterministic structural validation results
3. Bundle updates propagate automatically from ido4-MCP to ido4shape to ido4-plugins
4. Patch/minor updates require zero human intervention
5. Major version updates are flagged for review
6. Every failure mode either self-heals or produces a clear, actionable error
7. Any AI agent working in any of the three repos can understand and operate the release process from CLAUDE.md alone
