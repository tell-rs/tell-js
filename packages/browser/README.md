# tell-js

Tell SDK for browsers — analytics events, structured logging, automatic sessions, and privacy controls.

## Install

```sh
# npm
npm install tell-js

# yarn
yarn add tell-js

# pnpm
pnpm add tell-js

# bun
bun add tell-js
```

## Quick Start

```ts
import tell from "tell-js";

tell.configure("your-api-key");

// Track an event
tell.track("Button Clicked", { button: "signup" });

// Identify a user (persisted to localStorage)
tell.identify("user_123", { name: "Alice" });

// Structured logging
tell.logInfo("Checkout started", "commerce");
```

Events called before `configure()` are automatically queued and replayed.

## API

### `tell.configure(apiKey, options?)`

Initialize the SDK. Call once on page load.

```ts
tell.configure("your-api-key", {
  // All options below are optional:
  endpoint: "https://collect.tell.app",  // default
  batchSize: 20,                          // events per batch
  flushInterval: 5_000,                   // ms between auto-flushes
  maxRetries: 5,                          // retry attempts on failure
  closeTimeout: 5_000,                    // ms to wait on close()
  networkTimeout: 10_000,                 // ms per HTTP request
  logLevel: "error",                      // "error" | "warn" | "info" | "debug"
  disabled: false,                        // disable all tracking
  maxQueueSize: 1000,                     // max queued items
  sessionTimeout: 1_800_000,              // 30 min session timeout
  persistence: "localStorage",            // "localStorage" | "memory"
  respectDoNotTrack: false,               // honor browser DNT setting
  botDetection: true,                     // auto-disable for bots
  onError: (err) => console.error(err),
  beforeSend: (event) => event,           // transform/filter events
  beforeSendLog: (log) => log,            // transform/filter logs
});
```

### Events

```ts
tell.track(eventName, properties?)
tell.identify(userId, traits?)
tell.group(groupId, properties?)
tell.revenue(amount, currency, orderId, properties?)
tell.alias(previousId, userId)
```

No `userId` parameter on `track`, `group`, or `revenue` — the browser SDK uses an implicit user ID set by `identify()` and falls back to an anonymous device ID.

### Logging

```ts
tell.log(level, message, service?, data?)

// Convenience methods
tell.logError(message, service?, data?)
tell.logWarning(message, service?, data?)
tell.logInfo(message, service?, data?)
tell.logDebug(message, service?, data?)
// ... and logEmergency, logAlert, logCritical, logNotice, logTrace
```

### Privacy

```ts
tell.optOut()       // stop tracking, persisted
tell.optIn()        // resume tracking
tell.isOptedOut()   // check status
```

### Super Properties

Properties automatically attached to every event:

```ts
tell.register({ app_version: "1.2.0" })
tell.unregister("app_version")
```

### Lifecycle

```ts
tell.enable()          // re-enable after disable()
tell.disable()         // pause tracking
tell.reset()           // clear user, device, session (e.g. on logout)
await tell.flush()     // flush pending events
await tell.close()     // flush + shut down
```

### Config Presets

```ts
import tell, { development, production } from "tell-js";

tell.configure("your-api-key", development());  // localhost, debug logging
tell.configure("your-api-key", production());   // defaults, error-only logging
```

## Features

- **Automatic sessions** — rotated on 30-min inactivity or tab hidden/visible
- **Pre-init queue** — events called before `configure()` are buffered and replayed
- **sendBeacon flush** — events are flushed via `navigator.sendBeacon` on page unload
- **Bot detection** — auto-disables for headless browsers and bots
- **localStorage persistence** — device ID, user ID, session, and super properties survive page reloads
- **Do Not Track** — optional respect for `navigator.doNotTrack`

## Framework Integrations

For React, Next.js, and Vue, use the dedicated packages:

- [`@tell/react`](https://www.npmjs.com/package/@tell/react) — React provider and hooks
- [`@tell/nextjs`](https://www.npmjs.com/package/@tell/nextjs) — Next.js auto page tracking
- [`@tell/vue`](https://www.npmjs.com/package/@tell/vue) — Vue plugin and composable

## License

MIT
