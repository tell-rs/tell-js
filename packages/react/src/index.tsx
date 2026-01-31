"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import tell from "@tell-rs/browser";
import type { TellBrowserConfig, TellInstance, Properties } from "@tell-rs/browser";

// Re-export everything from @tell-rs/browser for convenience
export { tell } from "@tell-rs/browser";
export type { TellBrowserConfig, TellInstance, Properties } from "@tell-rs/browser";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TellContext = createContext<TellInstance>(tell);

export interface TellProviderProps {
  apiKey: string;
  options?: TellBrowserConfig;
  children: ReactNode;
}

/**
 * Initializes the Tell SDK and provides it to the React tree.
 * Call once at the root of your app.
 */
export function TellProvider({ apiKey, options, children }: TellProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      tell.configure(apiKey, options);
      initialized.current = true;
    }
    return () => {
      tell.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <TellContext value={tell}>{children}</TellContext>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the Tell singleton instance. */
export function useTell(): TellInstance {
  return useContext(TellContext);
}

/** Returns a stable `track` function. */
export function useTrack() {
  const t = useTell();
  return useCallback(
    (eventName: string, properties?: Properties) => {
      t.track(eventName, properties);
    },
    [t]
  );
}

/** Returns a stable `identify` function. */
export function useIdentify() {
  const t = useTell();
  return useCallback(
    (userId: string, traits?: Properties) => {
      t.identify(userId, traits);
    },
    [t]
  );
}
