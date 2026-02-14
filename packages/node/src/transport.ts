import type { JsonEvent, JsonLog } from "@tell-rs/core";
import { NetworkError } from "@tell-rs/core";
import { gzipSync } from "node:zlib";

export interface TransportConfig {
  endpoint: string;
  apiKey: string;
  maxRetries: number;
  networkTimeout: number;
  gzip: boolean;
  onError?: (error: Error) => void;
  onPayloadTooLarge?: () => void;
}

export class HttpTransport {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly networkTimeout: number;
  private readonly gzip: boolean;
  private readonly onError?: (error: Error) => void;
  private readonly onPayloadTooLarge?: () => void;

  constructor(config: TransportConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries;
    this.networkTimeout = config.networkTimeout;
    this.gzip = config.gzip;
    this.onError = config.onError;
    this.onPayloadTooLarge = config.onPayloadTooLarge;
  }

  async sendEvents(events: JsonEvent[]): Promise<void> {
    if (events.length === 0) return;
    const body = events.map((e) => JSON.stringify(e)).join("\n");
    await this.send("/v1/events", body);
  }

  async sendLogs(logs: JsonLog[]): Promise<void> {
    if (logs.length === 0) return;
    const body = logs.map((l) => JSON.stringify(l)).join("\n");
    await this.send("/v1/logs", body);
  }

  private async send(path: string, body: string): Promise<void> {
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/x-ndjson",
      Authorization: `Bearer ${this.apiKey}`,
    };

    let payload: string | Buffer = body;
    if (this.gzip) {
      payload = gzipSync(body);
      headers["Content-Encoding"] = "gzip";
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.backoff(attempt);
      }

      try {
        const response = await globalThis.fetch(url, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(this.networkTimeout),
        });

        if (response.status === 202) {
          return;
        }

        if (response.status === 207) {
          if (this.onError) {
            const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
            this.onError(
              new NetworkError(
                `Partial success: ${data?.rejected ?? "unknown"} items rejected`,
                207
              )
            );
          }
          return;
        }

        if (response.status === 413) {
          if (this.onPayloadTooLarge) {
            this.onPayloadTooLarge();
          }
          throw new NetworkError("Payload too large", 413);
        }

        if (response.status === 401) {
          throw new NetworkError("Invalid API key", 401);
        }

        if (response.status >= 400 && response.status < 500) {
          throw new NetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }

        lastError = new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      } catch (err) {
        if (err instanceof NetworkError && err.statusCode === 413) {
          throw err;
        }

        if (err instanceof NetworkError && err.statusCode && err.statusCode < 500) {
          if (this.onError) this.onError(err);
          return;
        }

        // DNS failures surface as TypeError from fetch.
        // These won't resolve by retrying — bail immediately.
        if (err instanceof TypeError) {
          if (this.onError) this.onError(new NetworkError(err.message));
          return;
        }

        lastError =
          err instanceof Error ? err : new NetworkError(String(err));
      }
    }

    if (lastError && this.onError) {
      this.onError(lastError);
    }
  }

  private backoff(attempt: number): Promise<void> {
    const base = 1000 * Math.pow(1.5, attempt - 1);
    const jitter = base * 0.2 * Math.random();
    const delay = Math.min(base + jitter, 30_000);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
