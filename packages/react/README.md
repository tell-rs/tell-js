# @tell-rs/react

Tell SDK React bindings — provider, hooks, and components.

## Install

```sh
# npm
npm install @tell-rs/react @tell-rs/browser

# yarn
yarn add @tell-rs/react @tell-rs/browser

# pnpm
pnpm add @tell-rs/react @tell-rs/browser

# bun
bun add @tell-rs/react @tell-rs/browser
```

`@tell-rs/browser` is a peer dependency and must be installed alongside `@tell-rs/react`.

## Quick Start

### 1. Add the provider

Wrap your app with `TellProvider` at the root:

```tsx
// src/App.tsx
import { TellProvider } from "@tell-rs/react";

export default function App() {
  return (
    <TellProvider apiKey="your-api-key">
      <YourApp />
    </TellProvider>
  );
}
```

### 2. Track events

```tsx
import { useTrack } from "@tell-rs/react";

function SignUpButton() {
  const track = useTrack();

  return (
    <button onClick={() => track("Sign Up Clicked", { plan: "pro" })}>
      Sign Up
    </button>
  );
}
```

### 3. Identify users

```tsx
import { useIdentify } from "@tell-rs/react";

function LoginForm() {
  const identify = useIdentify();

  function onLogin(user: { id: string; email: string }) {
    identify(user.id, { email: user.email });
  }

  // ...
}
```

## API

### `<TellProvider>`

| Prop | Type | Description |
|------|------|-------------|
| `apiKey` | `string` | **Required.** Your Tell API key. |
| `options` | `TellBrowserConfig` | Optional config passed to `tell.configure()`. |
| `children` | `ReactNode` | Your app tree. |

Calls `tell.configure()` once on mount and `tell.close()` on unmount.

### Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useTell()` | `TellInstance` | The Tell singleton for direct access. |
| `useTrack()` | `(name, props?) => void` | Stable callback for tracking events. |
| `useIdentify()` | `(userId, traits?) => void` | Stable callback for identifying users. |

### Direct access

For cases where hooks aren't suitable:

```ts
import { tell } from "@tell-rs/react";

tell.track("Background Task Done");
```

## Page view tracking (TanStack Router, React Router, etc.)

`@tell-rs/react` is router-agnostic. For automatic page view tracking, add a small component that watches your router's location. Here's an example for TanStack Router:

```tsx
import { useLocation } from "@tanstack/react-router";
import { useTell } from "@tell-rs/react";
import { useEffect } from "react";

function TellPageTracker() {
  const tell = useTell();
  const location = useLocation();

  useEffect(() => {
    tell.track("Page Viewed", {
      url: window.location.href,
      path: location.pathname,
      referrer: document.referrer,
      title: document.title,
    });
  }, [location.pathname, tell]);

  return null;
}
```

Place `<TellPageTracker />` inside `<TellProvider>` in your root layout. The same pattern works with React Router — just swap `useLocation` for the equivalent hook from your router.

For Next.js, use [`@tell-rs/nextjs`](../nextjs) which handles this automatically.

## License

MIT
