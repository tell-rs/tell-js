# @tell-rs/nextjs

Tell SDK Next.js integration — automatic page tracking for the App Router.

## Install

```sh
# npm
npm install @tell-rs/nextjs @tell-rs/browser

# yarn
yarn add @tell-rs/nextjs @tell-rs/browser

# pnpm
pnpm add @tell-rs/nextjs @tell-rs/browser

# bun
bun add @tell-rs/nextjs @tell-rs/browser
```

`@tell-rs/browser` is a peer dependency and must be installed alongside `@tell-rs/nextjs`.

## Quick Start

Add `Tell` to your root layout:

```tsx
// app/layout.tsx
import { Tell } from "@tell-rs/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Tell apiKey="your-api-key" />
        {children}
      </body>
    </html>
  );
}
```

That's it. Page views are tracked automatically on every route change.

## API

### `<Tell>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | `string` | | **Required.** Your Tell API key. |
| `options` | `TellBrowserConfig` | | Optional config passed to `tell.configure()`. |
| `trackPageViews` | `boolean` | `true` | Track `Page Viewed` events on route changes. |
| `pageViewProperties` | `Properties` | | Extra properties included with every page view. |
| `children` | `ReactNode` | | Optional children to render. |

Each `Page Viewed` event includes `url` and `path` properties automatically.

### Manual Tracking

For events beyond page views, import `tell` directly:

```tsx
"use client";

import { tell } from "@tell-rs/nextjs";

function CheckoutButton() {
  return (
    <button onClick={() => tell.track("Checkout Started", { items: 3 })}>
      Checkout
    </button>
  );
}
```

Or combine with `@tell-rs/react` hooks in the same project:

```tsx
import { useTrack } from "@tell-rs/react";
```

## How It Works

`Tell` is a `"use client"` component that:

1. Calls `tell.configure()` once on mount
2. Watches `usePathname()` and `useSearchParams()` from `next/navigation`
3. Fires `tell.track("Page Viewed", { url, path })` on every route change
4. Calls `tell.close()` on unmount

## License

MIT
