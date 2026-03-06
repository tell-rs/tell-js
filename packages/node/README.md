# @tell-rs/node

Tell SDK for Node.js — analytics events and structured logging.

## Install

```sh
# npm
npm install @tell-rs/node

# yarn
yarn add @tell-rs/node

# pnpm
pnpm add @tell-rs/node

# bun
bun add @tell-rs/node
```

## Quick Start

```ts
import { Tell } from "@tell-rs/node";

const tell = new Tell("feed1e11feed1e11feed1e11feed1e11");

// Track an event
tell.track("user_123", "Sign Up", { plan: "pro" });

// Identify a user
tell.identify("user_123", { name: "Alice", email: "alice@example.com" });

// Structured logging
tell.logInfo("User signed up", { userId: "user_123" });

// Flush and close before process exit
await tell.close();
```

## API

### `new Tell(apiKey, options?)`

Creates a new Tell instance. Each instance manages its own batching, transport, and lifecycle.

```ts
const tell = new Tell("feed1e11feed1e11feed1e11feed1e11", {
  // All options below are optional:
  service: "api-server",                  // stamped on every event and log
  endpoint: "https://collect.tell.app",  // default
  batchSize: 100,                         // events per batch
  flushInterval: 10_000,                  // ms between auto-flushes
  maxRetries: 3,                          // retry attempts on failure
  closeTimeout: 5_000,                    // ms to wait on close()
  networkTimeout: 30_000,                 // ms per HTTP request
  logLevel: "info",                       // "error" | "warn" | "info" | "debug"
  source: os.hostname(),                  // source identifier
  disabled: false,                        // disable all tracking
  maxQueueSize: 1000,                     // max queued items
  gzip: false,                            // gzip request bodies
  onError: (err) => console.error(err),   // error callback
  beforeSend: (event) => event,           // transform/filter events
  beforeSendLog: (log) => log,            // transform/filter logs
});
```

### Events

```ts
tell.track(userId, eventName, properties?)
tell.identify(userId, traits?)
tell.group(userId, groupId, properties?)
tell.revenue(userId, amount, currency, orderId, properties?)
tell.alias(previousId, userId)
```

### Logging

```ts
tell.log(level, message, data?)

// Convenience methods
tell.logEmergency(message, data?)
tell.logAlert(message, data?)
tell.logCritical(message, data?)
tell.logError(message, data?)
tell.logWarning(message, data?)
tell.logNotice(message, data?)
tell.logInfo(message, data?)
tell.logDebug(message, data?)
tell.logTrace(message, data?)
```

### Service Scoping

Use `withService()` to create a scoped view that stamps a different service name on all events and logs, without affecting the parent instance:

```ts
const tell = new Tell("feed1e11feed1e11feed1e11feed1e11", { service: "api" });

const payments = tell.withService("payments");
payments.logError("Charge failed", { code: 402 });
payments.track("u_1", "Payment Failed");

// Parent instance is unaffected
tell.logInfo("Still tagged as api");
```

Scoped instances share the parent's batching and transport — call `tell.flush()` or `tell.close()` as usual.

### Lifecycle

```ts
await tell.flush()    // flush all pending events and logs
await tell.close()    // flush + shut down (call before process exit)
```

### Config Presets

```ts
import { Tell, development, production } from "@tell-rs/node";

// Development: localhost:8080, small batches, debug logging
const dev = new Tell("feed1e11feed1e11feed1e11feed1e11", development());

// Production: default endpoint, error-only logging
const prod = new Tell("feed1e11feed1e11feed1e11feed1e11", production());
```

## Redaction

Use the built-in `redact()` factory to strip sensitive data before events leave your server:

```ts
import { Tell, redact, redactLog, SENSITIVE_PARAMS } from "@tell-rs/node";

const tell = new Tell("feed1e11feed1e11feed1e11feed1e11", {
  beforeSend: redact({
    dropRoutes: ["/health", "/readyz"],
    stripParams: SENSITIVE_PARAMS,
    redactKeys: ["email", "phone", "ssn"],
  }),
  beforeSendLog: redactLog({
    redactKeys: ["password", "credit_card"],
  }),
});
```

See the [docs site](https://docs.tell.rs/tracking/sdks/javascript/node#redaction--beforesend) for more `beforeSend` patterns.

## License

MIT
