#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh 0.3.0
#
# Pre-release verification → version bump → commit → tag → push.
# CI handles npm publish. Documentation sync is verified before release.

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.5.0"
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: '$VERSION' is not a valid semver version"
  exit 1
fi

# Check clean working tree
if [ -n "$(git status --porcelain -- packages/)" ]; then
  echo "Error: working tree has uncommitted changes in packages/. Commit or stash first."
  exit 1
fi

# Check we're on main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Error: releases must be from main (currently on '$BRANCH')"
  exit 1
fi

# Check tag doesn't already exist
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "Error: tag v$VERSION already exists"
  exit 1
fi

# Check local is in sync with remote
echo "Checking local vs origin/main..."
git fetch --quiet origin main 2>/dev/null || {
  echo "Warning: could not fetch origin/main (offline?). Skipping sync check."
}

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  LOCAL_SHA=$(git rev-parse @)
  REMOTE_SHA=$(git rev-parse origin/main)
  BASE_SHA=$(git merge-base @ origin/main 2>/dev/null || echo "")

  if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
    echo "  ✓ Local in sync with remote"
  elif [ "$LOCAL_SHA" = "$BASE_SHA" ]; then
    BEHIND_COUNT=$(git rev-list --count @..origin/main)
    echo ""
    echo "Error: local main is behind origin/main by ${BEHIND_COUNT} commit(s)."
    echo ""
    echo "This usually means a cross-repo sync pipeline auto-merged a PR"
    echo "since you last pulled."
    echo ""
    echo "Commits on remote that you don't have locally:"
    git log --oneline @..origin/main | sed 's/^/  /'
    echo ""
    echo "To resolve:"
    echo "  git pull --ff-only origin main"
    echo "  ./scripts/release.sh $VERSION"
    exit 1
  elif [ -n "$BASE_SHA" ] && [ "$REMOTE_SHA" = "$BASE_SHA" ]; then
    AHEAD_COUNT=$(git rev-list --count origin/main..@)
    echo "  ℹ Local has ${AHEAD_COUNT} unpushed commit(s) ahead of remote — continuing"
  elif [ -n "$BASE_SHA" ]; then
    LOCAL_ONLY=$(git rev-list --count origin/main..@)
    REMOTE_ONLY=$(git rev-list --count @..origin/main)
    echo ""
    echo "Error: local and remote main have diverged."
    echo "  Local-only: ${LOCAL_ONLY} commit(s)"
    echo "  Remote-only: ${REMOTE_ONLY} commit(s)"
    echo ""
    echo "To resolve:"
    echo "  git pull --rebase origin main"
    echo "  ./scripts/release.sh $VERSION"
    exit 1
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# PRE-RELEASE VERIFICATION
# Ensures documentation, tests, and build are in sync with code.
# ═══════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════"
echo "  PRE-RELEASE VERIFICATION — v$VERSION"
echo "═══════════════════════════════════════════════"
echo ""

WARNINGS=0
ERRORS=0

# 1. Build check
echo "▸ Build..."
if npm run build --silent 2>/dev/null; then
  echo "  ✓ Build passed"
else
  echo "  ✗ Build FAILED"
  ERRORS=$((ERRORS + 1))
fi

# 2. Test check
echo "▸ Tests..."
TEST_OUTPUT=$(npm run test 2>&1 || true)
TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ tests' | head -1 | grep -oE '[0-9]+' || echo "0")
if echo "$TEST_OUTPUT" | grep -q "Tests.*passed\|test.*passed"; then
  echo "  ✓ $TEST_COUNT tests passed"
else
  echo "  ✗ Tests FAILED"
  ERRORS=$((ERRORS + 1))
fi

# 3. Validation step count
echo "▸ BRE step count..."
STEP_COUNT=$(grep -c 'registry.register(' packages/core/src/domains/tasks/validation-steps/index.ts 2>/dev/null || echo "0")
DOCS_STEP_COUNT=$(grep -oE '[0-9]+ steps|[0-9]+-step' CLAUDE.md | head -1 | grep -oE '[0-9]+' || echo "0")
if [ "$STEP_COUNT" != "$DOCS_STEP_COUNT" ]; then
  echo "  ⚠ BRE steps: code=$STEP_COUNT, CLAUDE.md=$DOCS_STEP_COUNT — UPDATE DOCS"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✓ BRE step count matches ($STEP_COUNT)"
fi

# 4. Tool count check (from server integration test output)
echo "▸ Tool counts..."
HYDRO_TOOLS=$(grep -oE 'Hydro.*[0-9]+ tools|[0-9]+ Tools \(Hydro\)' CLAUDE.md | head -1 | grep -oE '[0-9]+' || echo "?")
echo "  ℹ Documented: Hydro=$HYDRO_TOOLS (verify against server tests if architecture changed)"

# 5. CHANGELOG check
echo "▸ CHANGELOG..."
if grep -q "v$VERSION\|$VERSION" CHANGELOG.md 2>/dev/null; then
  echo "  ✓ v$VERSION found in CHANGELOG.md"
else
  echo "  ⚠ v$VERSION NOT in CHANGELOG.md — add release notes before continuing"
  WARNINGS=$((WARNINGS + 1))
fi

# 6. Documentation freshness — check if docs were updated since last code change
echo "▸ Documentation freshness..."
LAST_CODE_CHANGE=$(git log -1 --format=%H -- packages/spec-format/src packages/core/src packages/mcp/src packages/plugin 2>/dev/null || echo "")
LAST_DOC_CHANGE=$(git log -1 --format=%H -- architecture/ docs/ diagrams/ CLAUDE.md README.md 2>/dev/null || echo "")
if [ -n "$LAST_CODE_CHANGE" ] && [ -n "$LAST_DOC_CHANGE" ]; then
  # Check if code was changed after docs
  CODE_DATE=$(git log -1 --format=%ct -- packages/spec-format/src packages/core/src packages/mcp/src packages/plugin 2>/dev/null || echo "0")
  DOC_DATE=$(git log -1 --format=%ct -- architecture/ docs/ diagrams/ CLAUDE.md README.md 2>/dev/null || echo "0")
  if [ "$CODE_DATE" -gt "$DOC_DATE" ]; then
    echo "  ⚠ Code changed AFTER docs — verify docs are up to date"
    echo "    Last code change: $(git log -1 --format='%s (%cr)' -- packages/spec-format/src packages/core/src packages/mcp/src packages/plugin)"
    echo "    Last doc change:  $(git log -1 --format='%s (%cr)' -- architecture/ docs/ diagrams/ CLAUDE.md README.md)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✓ Docs updated after last code change"
  fi
fi

# 7. Website sync check
echo "▸ Website sync..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="${IDO4_WEBSITE_DIR:-$(dirname "$(dirname "$SCRIPT_DIR")")/ido4-website}"
if [ -d "$WEBSITE_DIR" ]; then
  WEBSITE_TESTS=$(grep -oE '[0-9,]+' "$WEBSITE_DIR/src/components/ProofSection.tsx" | head -1 || echo "?")
  echo "  ℹ Website shows: $WEBSITE_TESTS tests — verify matches actual count ($TEST_COUNT)"
  WEBSITE_BRE=$(grep -oE '[0-9]+' "$WEBSITE_DIR/src/components/ProofSection.tsx" | sed -n '2p' || echo "?")
  if [ "$WEBSITE_BRE" != "$STEP_COUNT" ]; then
    echo "  ⚠ Website BRE steps ($WEBSITE_BRE) ≠ actual ($STEP_COUNT) — update website"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "  ℹ Website repo not found at $WEBSITE_DIR — skip"
fi

# ═══════════════════════════════════════════════════════════════
# VERIFICATION SUMMARY
# ═══════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo "  ✗ RELEASE BLOCKED — $ERRORS error(s), $WARNINGS warning(s)"
  echo "  Fix errors before releasing."
  echo "═══════════════════════════════════════════════"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "  ⚠ $WARNINGS warning(s) — review before releasing"
  echo "═══════════════════════════════════════════════"
  echo ""
  read -p "Continue with release despite warnings? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    exit 1
  fi
else
  echo "  ✓ ALL CHECKS PASSED"
  echo "═══════════════════════════════════════════════"
fi

# ═══════════════════════════════════════════════════════════════
# RELEASE
# ═══════════════════════════════════════════════════════════════

SPEC_FORMAT_PKG="packages/spec-format/package.json"
CORE_PKG="packages/core/package.json"
MCP_PKG="packages/mcp/package.json"

CURRENT_SPEC_FORMAT=$(node -p "require('./$SPEC_FORMAT_PKG').version")
CURRENT_CORE=$(node -p "require('./$CORE_PKG').version")
CURRENT_MCP=$(node -p "require('./$MCP_PKG').version")

echo ""
echo "Releasing v$VERSION"
echo "  @ido4/spec-format: $CURRENT_SPEC_FORMAT → $VERSION"
echo "  @ido4/core:        $CURRENT_CORE → $VERSION"
echo "  @ido4/mcp:         $CURRENT_MCP → $VERSION"
echo ""

# Bump versions using node to preserve JSON formatting
node -e "
const fs = require('fs');
for (const pkg of ['$SPEC_FORMAT_PKG', '$CORE_PKG', '$MCP_PKG']) {
  const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  json.version = '$VERSION';
  fs.writeFileSync(pkg, JSON.stringify(json, null, 2) + '\n');
}
"

# Commit, tag, push
git add "$SPEC_FORMAT_PKG" "$CORE_PKG" "$MCP_PKG"
git commit -m "release v$VERSION"
git tag "v$VERSION"
git push origin main --tags

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ v$VERSION released"
echo "═══════════════════════════════════════════════"
echo ""
echo "CI will build, test, and publish to npm."
echo "Watch: gh run list --repo ido4-dev/ido4 --limit 2"
echo ""
echo "Post-release checklist:"
echo "  □ Verify npm publish: https://www.npmjs.com/org/ido4 (spec-format, core, mcp)"
echo "  □ Update ido4shape package.json @ido4/spec-format version"
echo "  □ Update ido4dev package.json @ido4/mcp version"
echo "  □ Update website if numbers changed (build + firebase deploy)"
echo "  □ Update MEMORY.md version references"
echo "  □ Announce if significant changes"
