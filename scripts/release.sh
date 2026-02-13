#!/usr/bin/env bash
set -euo pipefail

# ── Usage ──────────────────────────────────────────────────────
# ./scripts/release.sh patch    (0.1.1 -> 0.1.2)
# ./scripts/release.sh minor    (0.1.1 -> 0.2.0)
# ./scripts/release.sh major    (0.1.1 -> 1.0.0)
# ───────────────────────────────────────────────────────────────

BUMP="${1:-}"
if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: ./scripts/release.sh <patch|minor|major>"
  exit 1
fi

# ── Preflight ──────────────────────────────────────────────────

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash your changes first."
  exit 1
fi

echo "Running preflight checks..."
npm run clean
npm install --silent
npm run typecheck
npm run test
npm run build
echo ""
echo "Preflight passed."

# ── Bump versions ─────────────────────────────────────────────

PACKAGES=(core node browser react nextjs vue)
for pkg in "${PACKAGES[@]}"; do
  npm version "$BUMP" --no-git-tag-version -w "packages/$pkg"
done

VERSION=$(node -p "require('./packages/core/package.json').version")
echo ""
echo "Bumped all packages to $VERSION"

# ── Dry run ────────────────────────────────────────────────────

PUBLISH_PACKAGES=(node browser react nextjs vue)
echo ""
echo "Running publish dry-run..."
for pkg in "${PUBLISH_PACKAGES[@]}"; do
  npm publish -w "packages/$pkg" --access public --dry-run 2>&1
done

echo ""
read -rp "Publish v$VERSION to npm? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted. Version bumps are still in your working tree — reset with: git checkout -- packages/*/package.json"
  exit 1
fi

# ── Publish (order matters: node + browser before adapters) ───

echo "Publishing..."
npm publish -w packages/node    --access public
npm publish -w packages/browser --access public
npm publish -w packages/react   --access public
npm publish -w packages/nextjs  --access public
npm publish -w packages/vue     --access public

# ── Tag + push ─────────────────────────────────────────────────

git add -A
git commit -m "release v$VERSION"
git tag "v$VERSION"
git push && git push --tags

echo ""
echo "Released v$VERSION"
