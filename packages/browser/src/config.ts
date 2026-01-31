import type { TellError, BeforeSendFn, JsonEvent, JsonLog } from "@tell/core";

export interface TellBrowserConfig {
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  closeTimeout?: number;
  networkTimeout?: number;
  logLevel?: "error" | "warn" | "info" | "debug";
  source?: string;
  onError?: (error: TellError) => void;
  disabled?: boolean;
  maxQueueSize?: number;
  sessionTimeout?: number;
  persistence?: "localStorage" | "memory";
  respectDoNotTrack?: boolean;
  botDetection?: boolean;
  captureErrors?: boolean;
  beforeSend?: BeforeSendFn<JsonEvent> | BeforeSendFn<JsonEvent>[];
  beforeSendLog?: BeforeSendFn<JsonLog> | BeforeSendFn<JsonLog>[];
}

export const DEFAULTS = {
  endpoint: "https://collect.tell.app",
  batchSize: 20,
  flushInterval: 5_000,
  maxRetries: 5,
  closeTimeout: 5_000,
  networkTimeout: 10_000,
  logLevel: "error" as const,
  source: "browser",
  disabled: false,
  maxQueueSize: 1000,
  sessionTimeout: 1_800_000, // 30 min
  persistence: "localStorage" as const,
  respectDoNotTrack: false,
  botDetection: true,
  captureErrors: false,
} as const;

export type ResolvedBrowserConfig = Required<
  Omit<TellBrowserConfig, "onError" | "beforeSend" | "beforeSendLog">
> &
  Pick<TellBrowserConfig, "onError" | "beforeSend" | "beforeSendLog">;

export function resolveConfig(
  options: TellBrowserConfig | undefined
): ResolvedBrowserConfig {
  return { ...DEFAULTS, ...options } as ResolvedBrowserConfig;
}

/** Development preset: localhost, small batches, fast flush, debug logging. */
export function development(
  overrides?: Partial<TellBrowserConfig>
): TellBrowserConfig {
  return {
    endpoint: "http://localhost:8080",
    batchSize: 5,
    flushInterval: 2_000,
    logLevel: "debug",
    ...overrides,
  };
}

/** Production preset: default endpoint, error-only logging. */
export function production(
  overrides?: Partial<TellBrowserConfig>
): TellBrowserConfig {
  return {
    logLevel: "error",
    ...overrides,
  };
}
