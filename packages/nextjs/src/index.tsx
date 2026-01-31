"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import tell from "@tell-rs/browser";
import type { TellBrowserConfig, Properties } from "@tell-rs/browser";

export { tell } from "@tell-rs/browser";
export type { TellBrowserConfig, Properties } from "@tell-rs/browser";

export interface TellProps {
  apiKey: string;
  options?: TellBrowserConfig;
  /** Track page views automatically on route change. Default: true */
  trackPageViews?: boolean;
  /** Extra properties to include with every page view event. */
  pageViewProperties?: Properties;
  children?: ReactNode;
}

/**
 * Drop-in Next.js analytics component.
 * Place in your root layout to auto-configure Tell and track page views.
 *
 * ```tsx
 * // app/layout.tsx
 * import { Tell } from "@tell-rs/nextjs";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <Tell apiKey="..." />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function Tell({
  apiKey,
  options,
  trackPageViews = true,
  pageViewProperties,
  children,
}: TellProps) {
  const initialized = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize once
  useEffect(() => {
    if (!initialized.current) {
      tell.configure(apiKey, options);
      initialized.current = true;
    }
    return () => {
      tell.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track page views on route changes
  useEffect(() => {
    if (!trackPageViews || !initialized.current) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    tell.track("Page Viewed", {
      url,
      path: pathname,
      ...pageViewProperties,
    });
  }, [pathname, searchParams, trackPageViews, pageViewProperties]);

  return children ?? null;
}
