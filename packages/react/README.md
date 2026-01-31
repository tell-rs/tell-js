# @tell/react

Tell SDK React bindings — provider, hooks, and components.

## Install

```sh
# npm
npm install @tell/react tell-js

# yarn
yarn add @tell/react tell-js

# pnpm
pnpm add @tell/react tell-js

# bun
bun add @tell/react tell-js
```

`tell-js` is a peer dependency and must be installed alongside `@tell/react`.

## Quick Start

### 1. Add the provider

Wrap your app with `TellProvider` at the root:

```tsx
// src/App.tsx
import { TellProvider } from "@tell/react";

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
import { useTrack } from "@tell/react";

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
import { useIdentify } from "@tell/react";

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
import { tell } from "@tell/react";

tell.track("Background Task Done");
```

## License

MIT
