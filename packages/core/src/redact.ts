import type { BeforeSendFn } from "./before-send.js";
import type { JsonEvent, JsonLog, Properties } from "./types.js";

/**
 * Common query-parameter names that often carry secrets or tokens.
 * Pass these (or a subset) to `stripParams` for quick sanitization.
 */
export const SENSITIVE_PARAMS: readonly string[] = [
  "token",
  "api_key",
  "key",
  "secret",
  "password",
  "access_token",
  "refresh_token",
  "authorization",
] as const;

export interface RedactOptions {
  /** Query-parameter names to strip from URLs (context.url and URL-shaped property values). */
  stripParams?: string[];
  /** Property/trait keys whose values should be replaced with "[REDACTED]". */
  redactKeys?: string[];
  /** URL pathname prefixes — events whose context.url matches are dropped entirely. */
  dropRoutes?: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripUrlParams(url: string, params: string[]): string {
  try {
    const u = new URL(url);
    for (const p of params) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return url; // not a valid URL — leave as-is
  }
}

function stripParamsInProperties(
  props: Properties | undefined,
  params: string[],
): Properties | undefined {
  if (!props) return props;
  const out: Properties = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string" && v.startsWith("http")) {
      out[k] = stripUrlParams(v, params);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function redactKeysInProperties(
  props: Properties | undefined,
  keys: string[],
): Properties | undefined {
  if (!props) return props;
  const out: Properties = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = keys.includes(k) ? "[REDACTED]" : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Factory that returns a `beforeSend` hook for events.
 *
 * - `dropRoutes` — drops events whose `context.url` pathname starts with a prefix.
 * - `stripParams` — removes query params from `context.url` and URL-shaped values
 *   in `properties` and `traits`.
 * - `redactKeys` — replaces matching keys in `properties` and `traits` with `"[REDACTED]"`.
 *
 * The returned function never mutates the input event.
 */
export function redact(options: RedactOptions): BeforeSendFn<JsonEvent> {
  const { stripParams, redactKeys, dropRoutes } = options;

  return (event: JsonEvent): JsonEvent | null => {
    // --- dropRoutes ---
    if (dropRoutes && dropRoutes.length > 0 && event.context?.url) {
      try {
        const pathname = new URL(String(event.context.url)).pathname;
        for (const prefix of dropRoutes) {
          if (pathname.startsWith(prefix)) return null;
        }
      } catch {
        // not a valid URL — skip drop check
      }
    }

    let ctx = event.context;
    let props = event.properties;
    let traits = event.traits;

    // --- stripParams ---
    if (stripParams && stripParams.length > 0) {
      if (ctx?.url && typeof ctx.url === "string") {
        ctx = { ...ctx, url: stripUrlParams(ctx.url, stripParams) };
      }
      props = stripParamsInProperties(props, stripParams);
      traits = stripParamsInProperties(traits, stripParams);
    }

    // --- redactKeys ---
    if (redactKeys && redactKeys.length > 0) {
      props = redactKeysInProperties(props, redactKeys);
      traits = redactKeysInProperties(traits, redactKeys);
    }

    // Return a shallow copy if anything changed
    if (ctx !== event.context || props !== event.properties || traits !== event.traits) {
      return { ...event, context: ctx, properties: props, traits: traits };
    }

    return event;
  };
}

/**
 * Factory that returns a `beforeSend` hook for log entries.
 *
 * - `redactKeys` — replaces matching keys in `log.data` with `"[REDACTED]"`.
 *
 * The returned function never mutates the input log.
 */
export function redactLog(
  options: Pick<RedactOptions, "redactKeys">,
): BeforeSendFn<JsonLog> {
  const { redactKeys } = options;

  return (log: JsonLog): JsonLog | null => {
    if (redactKeys && redactKeys.length > 0 && log.data) {
      const data = redactKeysInProperties(log.data, redactKeys);
      if (data !== log.data) {
        return { ...log, data };
      }
    }
    return log;
  };
}
