import type { TellError } from "@tell-rs/core";
import type { BeforeSendFn } from "@tell-rs/core";
import type { JsonEvent, JsonLog } from "@tell-rs/core";
import { hostname } from "node:os";

export interface TellConfig {
  apiKey: string;
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
  Omit<TellConfig, "onError" | "beforeSend" | "beforeSendLog">
> &
  Pick<TellConfig, "onError" | "beforeSend" | "beforeSendLog">;

export function resolveConfig(config: TellConfig): ResolvedConfig {
  return { ...DEFAULTS, ...config } as ResolvedConfig;
}

/** Development preset: localhost, small batches, fast flush, debug logging. */
export function development(
  apiKey: string,
  overrides?: Partial<TellConfig>
): TellConfig {
  return {
    endpoint: "http://localhost:8080",
    batchSize: 10,
    flushInterval: 2_000,
    logLevel: "debug",
    ...overrides,
    apiKey,
  };
}

/** Production preset: default endpoint, default batching, error-only logging. */
export function production(
  apiKey: string,
  overrides?: Partial<TellConfig>
): TellConfig {
  return {
    logLevel: "error",
    ...overrides,
    apiKey,
  };
}
