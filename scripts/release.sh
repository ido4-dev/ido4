#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh 0.3.0
#
# Bumps both @ido4/core and @ido4/mcp to the given version,
# commits, tags, and pushes. CI handles npm publish.

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.3.0"
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

CORE_PKG="packages/core/package.json"
MCP_PKG="packages/mcp/package.json"

CURRENT_CORE=$(node -p "require('./$CORE_PKG').version")
CURRENT_MCP=$(node -p "require('./$MCP_PKG').version")

echo "Releasing v$VERSION"
echo "  @ido4/core: $CURRENT_CORE → $VERSION"
echo "  @ido4/mcp:  $CURRENT_MCP → $VERSION"
echo ""

# Bump versions using node to preserve JSON formatting
node -e "
const fs = require('fs');
for (const pkg of ['$CORE_PKG', '$MCP_PKG']) {
  const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  json.version = '$VERSION';
  fs.writeFileSync(pkg, JSON.stringify(json, null, 2) + '\n');
}
"

# Commit, tag, push
git add "$CORE_PKG" "$MCP_PKG"
git commit -m "release v$VERSION"
git tag "v$VERSION"
git push origin main --tags

echo ""
echo "Done. CI will build, test, and publish to npm."
echo "Watch: gh run list --repo ido4-dev/ido4 --limit 2"
