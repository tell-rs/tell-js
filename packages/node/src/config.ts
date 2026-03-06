import type { TellError } from "@tell-rs/core";
import type { BeforeSendFn } from "@tell-rs/core";
import type { JsonEvent, JsonLog } from "@tell-rs/core";
import { hostname } from "node:os";

export interface TellOptions {
  /** Service name stamped on every event and log. No auto-detect for server SDKs. */
  service?: string;
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
  gzip?: boolean;
  beforeSend?: BeforeSendFn<JsonEvent> | BeforeSendFn<JsonEvent>[];
  beforeSendLog?: BeforeSendFn<JsonLog> | BeforeSendFn<JsonLog>[];
}

export const DEFAULTS = {
  endpoint: "https://collect.tell.app",
  batchSize: 100,
  flushInterval: 10_000,
  maxRetries: 3,
  closeTimeout: 5_000,
  networkTimeout: 30_000,
  logLevel: "info" as const,
  source: hostname(),
  disabled: false,
  maxQueueSize: 1000,
  gzip: false,
} as const;

export type ResolvedConfig = Required<
  Omit<TellOptions, "onError" | "beforeSend" | "beforeSendLog">
> &
  Pick<TellOptions, "onError" | "beforeSend" | "beforeSendLog"> &
  { apiKey: string };

export function resolveConfig(apiKey: string, options?: TellOptions): ResolvedConfig {
  return { ...DEFAULTS, ...options, apiKey } as ResolvedConfig;
}

/** Development preset: localhost, small batches, fast flush, debug logging. */
export function development(
  overrides?: Partial<TellOptions>
): TellOptions {
  return {
    endpoint: "http://localhost:8080",
    batchSize: 10,
    flushInterval: 2_000,
    logLevel: "debug",
    ...overrides,
  };
}

/** Production preset: default endpoint, default batching, error-only logging. */
export function production(
  overrides?: Partial<TellOptions>
): TellOptions {
  return {
    logLevel: "error",
    ...overrides,
  };
}
