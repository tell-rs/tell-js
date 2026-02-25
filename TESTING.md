# Testing

## E2E tests

Requires a Tell server running on localhost:8080.

    npm run test:e2e

Set the TELL_E2E=1 env var if running individual package tests directly.


## Unit tests

    npm test

Runs tests across all workspaces. Currently node and browser have test suites;
react, nextjs, and vue are stubs.


## Type checking

    npm run typecheck

Runs `tsc --noEmit` in every package.

## Full preflight (what the release script runs)

    npm run clean
    npm install
    npm run typecheck
    npm test
    npm run build
