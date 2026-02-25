# @tell-rs/vue

Tell SDK Vue integration — plugin and composable for Vue 3.

## Install

```sh
# npm
npm install @tell-rs/vue @tell-rs/browser

# yarn
yarn add @tell-rs/vue @tell-rs/browser

# pnpm
pnpm add @tell-rs/vue @tell-rs/browser

# bun
bun add @tell-rs/vue @tell-rs/browser
```

`@tell-rs/browser` is a peer dependency and must be installed alongside `@tell-rs/vue`.

## Quick Start

### 1. Install the plugin

```ts
// main.ts
import { createApp } from "vue";
import { TellPlugin } from "@tell-rs/vue";
import App from "./App.vue";

const app = createApp(App);
app.use(TellPlugin, { apiKey: "feed1e11feed1e11feed1e11feed1e11" });
app.mount("#app");
```

### 2. Track events

```vue
<script setup>
import { useTell } from "@tell-rs/vue";

const tell = useTell();

function onSignUp() {
  tell.track("Sign Up Clicked", { plan: "pro" });
}
</script>

<template>
  <button @click="onSignUp">Sign Up</button>
</template>
```

## API

### `TellPlugin`

Vue plugin. Pass options to `app.use()`:

```ts
app.use(TellPlugin, {
  apiKey: "feed1e11feed1e11feed1e11feed1e11",
  // Plus any TellBrowserConfig options:
  // endpoint, batchSize, flushInterval, sessionTimeout, etc.
});
```

The plugin:

1. Calls `tell.configure(apiKey, config)` on install
2. Provides the Tell instance via Vue's `provide`/`inject`
3. Calls `tell.close()` when the app unmounts

### `useTell()`

Composable that returns the Tell instance inside a `setup` function.

```ts
const tell = useTell();

tell.track("Page Viewed", { path: "/dashboard" });
tell.identify("user_123", { name: "Alice" });
tell.logInfo("Component mounted", "ui");
```

Throws if `TellPlugin` was not installed.

### Direct access

For use outside of components:

```ts
import { tell } from "@tell-rs/vue";

tell.track("Background Task Done");
```

## With Vue Router

Track page views on route changes:

```ts
// router.ts
import { tell } from "@tell-rs/vue";
import router from "./router";

router.afterEach((to) => {
  tell.track("Page Viewed", { path: to.path, url: to.fullPath });
});
```

## License

MIT
