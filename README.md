# Tell JavaScript SDKs

Analytics events and structured logging for JavaScript and TypeScript.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`tell-node`](./packages/node) | `npm i tell-node` | Server SDK for Node.js |
| [`@tell-rs/browser`](./packages/browser) | `npm i @tell-rs/browser` | Browser SDK |
| [`@tell-rs/react`](./packages/react) | `npm i @tell-rs/react` | React provider and hooks |
| [`@tell-rs/nextjs`](./packages/nextjs) | `npm i @tell-rs/nextjs` | Next.js auto page tracking |
| [`@tell-rs/vue`](./packages/vue) | `npm i @tell-rs/vue` | Vue plugin and composable |

## Quick Links

- [tell.rs](https://tell.rs) — Documentation
- [Release Guide](./RELEASE.md) — How to publish new versions
- [Redaction & Privacy](https://docs.tell.rs/tracking/sdks/javascript/browser#redaction--beforesend) — Client-side PII redaction

## Development

```sh
npm install
npm run typecheck
npm run test
npm run build
```

Requires Node.js >= 18.

## License

MIT
