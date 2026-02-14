import type { JsonEvent, JsonLog } from "@tell-rs/core";
import { NetworkError } from "@tell-rs/core";

export interface BrowserTransportConfig {
  endpoint: string;
  apiKey: string;
  maxRetries: number;
  networkTimeout: number;
  onError?: (error: Error) => void;
  onPayloadTooLarge?: () => void;
}

export class BrowserTransport {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly networkTimeout: number;
  private readonly onError?: (error: Error) => void;
  private readonly onPayloadTooLarge?: () => void;

  constructor(config: BrowserTransportConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries;
    this.networkTimeout = config.networkTimeout;
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

  /** Best-effort flush via sendBeacon for page unload. */
  beacon(events: JsonEvent[], logs: JsonLog[]): void {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return;

    if (events.length > 0) {
      const body = events.map((e) => JSON.stringify(e)).join("\n");
      const blob = new Blob([body], { type: "application/x-ndjson" });
      const url = `${this.endpoint}/v1/events?token=${encodeURIComponent(this.apiKey)}`;
      navigator.sendBeacon(url, blob);
    }

    if (logs.length > 0) {
      const body = logs.map((l) => JSON.stringify(l)).join("\n");
      const blob = new Blob([body], { type: "application/x-ndjson" });
      const url = `${this.endpoint}/v1/logs?token=${encodeURIComponent(this.apiKey)}`;
      navigator.sendBeacon(url, blob);
    }
  }

  private async send(path: string, body: string): Promise<void> {
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/x-ndjson",
      Authorization: `Bearer ${this.apiKey}`,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.backoff(attempt);
      }

      // Skip attempt if browser reports offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        lastError = new NetworkError("Browser is offline");
        continue;
      }

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.networkTimeout
      );

      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
          keepalive: true,
        });

        if (response.status === 202) {
          return;
        }

        if (response.status === 207) {
          if (this.onError) {
            this.onError(
              new NetworkError(
                `Partial success: some items rejected`,
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

        // 5xx — retryable
        lastError = new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      } catch (err) {
        if (err instanceof NetworkError && err.statusCode === 413) {
          throw err;
        }

        if (
          err instanceof NetworkError &&
          err.statusCode &&
          err.statusCode < 500
        ) {
          if (this.onError) this.onError(err);
          return;
        }

        // DNS failures and CORS errors surface as TypeError from fetch.
        // These won't resolve by retrying — bail immediately.
        if (err instanceof TypeError) {
          if (this.onError) this.onError(new NetworkError(err.message));
          return;
        }

        lastError =
          err instanceof Error ? err : new NetworkError(String(err));
      } finally {
        clearTimeout(timer);
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
