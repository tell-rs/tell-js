# Release

## Quick version

Commit everything, then run:

    ./scripts/release.sh patch

Replace `patch` with `minor` or `major` as needed. The script handles
preflight checks, version bumps, publishing, tagging, and pushing.


## First-time setup

Log in to npm and configure the scope (one time only):

    npm login
    npm config set @tell-rs:registry https://registry.npmjs.org/

The @tell-rs scope uses the tell-rs npm org.


## What the script does

1. Checks that your working tree is clean
2. Runs clean, install, typecheck, test, build across all packages
3. Bumps the version in all 6 package.json files
4. Dry-run publishes everything and asks for confirmation
5. Publishes to npm (node + browser first, then react/nextjs/vue)
6. Commits, tags, and pushes


## Manual release

If the script breaks or you need fine-grained control, the steps are:

1. Bump versions -- run `npm version {patch|minor|major} --no-git-tag-version`
   for each workspace: core, node, browser, react, nextjs, vue
2. Publish in order -- node and browser must go before react, nextjs, vue
   (they depend on @tell-rs/browser)
3. Commit, tag (`git tag vX.Y.Z`), push with `--tags`


## Emergency unpublish

npm allows unpublish within 72 hours:

    npm unpublish @tell-rs/node@VERSION
