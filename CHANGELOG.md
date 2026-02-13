# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Tree-shakeable `./events` subpath export for `@tell-rs/browser` and `@tell-rs/node`
- Bundle size tracking script (`npm run size`)
- `CHANGELOG.md`

### Changed
- Renamed `tell-node` package to `@tell-rs/node` for consistent scoping
- Build script now uses explicit ordering (core/node/browser first, then framework packages)

### Fixed
- Documented Vue plugin fire-and-forget `close()` behavior with explanatory comment

## [0.1.2] - 2025-06-13

### Added
- `redact()` and `redactLog()` helpers for client-side PII stripping
- `beforeSend` / `beforeSendLog` hooks on both browser and node SDKs
- `SENSITIVE_PARAMS` constant with common sensitive parameter names
- Release script (`scripts/release.sh`)

## [0.1.1] - 2025-06-12

### Fixed
- Initial patch release with bug fixes

## [0.1.0] - 2025-06-12

### Added
- Initial release of all packages
- `@tell-rs/browser` — browser SDK with auto page tracking, session management, UTM capture
- `tell-node` — Node.js SDK with batching, retry, gzip support
- `@tell-rs/react` — React provider and hooks (`TellProvider`, `useTell`)
- `@tell-rs/nextjs` — Next.js auto page tracking
- `@tell-rs/vue` — Vue plugin and composable (`TellPlugin`, `useTell`)
- `@tell-rs/core` — shared internals (validation, batching, types, constants)
- Structured logging with 9 syslog levels
- Event types: track, identify, group, revenue, alias
- Standard event constants (`Events.PageViewed`, etc.)
- Super properties and session management
- Bot detection and Do Not Track support
- Config presets (`development()`, `production()`)
