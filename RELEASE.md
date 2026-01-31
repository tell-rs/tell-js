# Release

## First-time setup

```sh
# Login to npm
npm login

# The @tell scope requires an npm org — create at https://www.npmjs.com/org/create
# Then link it:
npm config set @tell:registry https://registry.npmjs.org/
```

## 1. Pre-flight

```sh
npm run clean --workspaces
npm install
npm run typecheck --workspaces
npm run test --workspaces
npm run build --workspaces
```

### E2E (optional, requires Tell server on localhost:8080)

```sh
npm run test:e2e
```

## 2. Commit

Make sure your working tree is clean before bumping versions.

```sh
git add -A && git commit -m "your message"
```

## 3. Bump versions

```sh
# pick one: patch | minor | major
VER=patch

npm version $VER --no-git-tag-version -w packages/core
npm version $VER --no-git-tag-version -w packages/node
npm version $VER --no-git-tag-version -w packages/browser
npm version $VER --no-git-tag-version -w packages/react
npm version $VER --no-git-tag-version -w packages/nextjs
npm version $VER --no-git-tag-version -w packages/vue
```

## 4. Dry run

```sh
npm publish -w packages/node    --access public --dry-run
npm publish -w packages/browser --access public --dry-run
npm publish -w packages/react   --access public --dry-run
npm publish -w packages/nextjs  --access public --dry-run
npm publish -w packages/vue     --access public --dry-run
```

## 5. Publish

Order matters — `tell-node` and `tell-js` before adapters.

```sh
npm publish -w packages/node    --access public
npm publish -w packages/browser --access public
npm publish -w packages/react   --access public
npm publish -w packages/nextjs  --access public
npm publish -w packages/vue     --access public
```

If a publish fails partway, re-run only the failed commands — npm skips already-published versions.

## 6. Tag + push

```sh
VERSION=$(node -p "require('./packages/browser/package.json').version")
git add -A && git commit -m "release v${VERSION}"
git tag "v${VERSION}"
git push && git push --tags
```

## Unpublish (emergency only)

```sh
# npm allows unpublish within 72 hours
npm unpublish tell-node@VERSION
```
