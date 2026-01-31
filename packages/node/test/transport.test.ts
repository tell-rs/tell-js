import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HttpTransport } from "../src/transport.js";
import type { JsonEvent, JsonLog } from "@tell-rs/core";

// Mock fetch for transport tests
let fetchCalls: { url: string; init: RequestInit }[] = [];
let fetchResponse: { status: number; statusText: string; body?: unknown } = {
  status: 202,
  statusText: "Accepted",
};

const originalFetch = globalThis.fetch;

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  fetchCalls.push({ url: String(url), init: init! });
  return Promise.resolve({
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    json: () => Promise.resolve(fetchResponse.body),
  } as Response);
}

describe("HttpTransport", () => {
  beforeEach(() => {
    fetchCalls = [];
    fetchResponse = { status: 202, statusText: "Accepted" };
    globalThis.fetch = mockFetch as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends events as JSONL to /v1/events", async () => {
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 30_000,
      gzip: false,
    });

    const events: JsonEvent[] = [
      {
        type: "track",
        event: "Page Viewed",
        device_id: "dev-1",
        session_id: "sess-1",
        timestamp: 1706000000000,
        properties: { url: "/home" },
      },
      {
        type: "identify",
        device_id: "dev-1",
        user_id: "u_123",
        timestamp: 1706000000001,
        traits: { name: "Jane" },
      },
    ];

    await transport.sendEvents(events);

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://collect.example.com/v1/events");
    assert.equal(fetchCalls[0].init.method, "POST");

    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/x-ndjson");
    assert.equal(headers["Authorization"], "Bearer a1b2c3d4e5f60718293a4b5c6d7e8f90");

    // Verify JSONL format
    const body = fetchCalls[0].init.body as string;
    const lines = body.split("\n");
    assert.equal(lines.length, 2);

    const parsed0 = JSON.parse(lines[0]);
    assert.equal(parsed0.type, "track");
    assert.equal(parsed0.event, "Page Viewed");
    assert.equal(parsed0.device_id, "dev-1");

    const parsed1 = JSON.parse(lines[1]);
    assert.equal(parsed1.type, "identify");
    assert.equal(parsed1.user_id, "u_123");
  });

  it("sends logs as JSONL to /v1/logs", async () => {
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 30_000,
      gzip: false,
    });

    const logs: JsonLog[] = [
      {
        level: "error",
        message: "connection refused",
        service: "api",
        timestamp: 1706000000000,
        data: { code: 500 },
      },
    ];

    await transport.sendLogs(logs);

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://collect.example.com/v1/logs");

    const body = fetchCalls[0].init.body as string;
    const parsed = JSON.parse(body);
    assert.equal(parsed.level, "error");
    assert.equal(parsed.message, "connection refused");
  });

  it("skips send for empty arrays", async () => {
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 30_000,
      gzip: false,
    });

    await transport.sendEvents([]);
    await transport.sendLogs([]);

    assert.equal(fetchCalls.length, 0);
  });

  it("reports 401 error to onError without retry", async () => {
    fetchResponse = { status: 401, statusText: "Unauthorized" };

    const errors: Error[] = [];
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 30_000,
      gzip: false,
      onError: (err) => errors.push(err),
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    // Should NOT retry 401
    assert.equal(fetchCalls.length, 1);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("Invalid API key"));
  });

  it("retries on 500 errors", async () => {
    let callIndex = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      callIndex++;
      if (callIndex <= 2) {
        return { status: 500, statusText: "Internal Server Error" } as Response;
      }
      return { status: 202, statusText: "Accepted" } as Response;
    }) as typeof globalThis.fetch;

    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 30_000,
      gzip: false,
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    // Initial + 2 retries = 3 calls, 3rd succeeds
    assert.equal(fetchCalls.length, 3);
  });

  it("passes AbortSignal to fetch", async () => {
    let capturedSignal: AbortSignal | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return { status: 202, statusText: "Accepted" } as Response;
    }) as typeof globalThis.fetch;

    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 15_000,
      gzip: false,
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    assert.ok(capturedSignal instanceof AbortSignal);
  });

  // --- New tests: GZIP compression ---

  it("compresses body with gzip when enabled", async () => {
    const { gunzipSync } = await import("node:zlib");

    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 30_000,
      gzip: true,
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    assert.equal(fetchCalls.length, 1);
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Encoding"], "gzip");

    // Verify body is valid gzip that decompresses to expected JSONL
    const body = fetchCalls[0].init.body;
    const decompressed = gunzipSync(Buffer.from(body as any)).toString("utf-8");
    const parsed = JSON.parse(decompressed);
    assert.equal(parsed.type, "track");
    assert.equal(parsed.event, "test");
  });

  it("does not set Content-Encoding when gzip is false", async () => {
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 30_000,
      gzip: false,
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Encoding"], undefined);
    assert.equal(typeof fetchCalls[0].init.body, "string");
  });

  // --- New tests: 413 handling ---

  it("calls onPayloadTooLarge on 413 and throws", async () => {
    fetchResponse = { status: 413, statusText: "Payload Too Large" };

    let payloadTooLargeCalled = false;
    const transport = new HttpTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 30_000,
      gzip: false,
      onPayloadTooLarge: () => {
        payloadTooLargeCalled = true;
      },
    });

    await assert.rejects(
      () =>
        transport.sendEvents([
          { type: "track", event: "test", device_id: "d", timestamp: 1 },
        ]),
      (err: any) => {
        assert.equal(err.statusCode, 413);
        return true;
      }
    );

    assert.equal(payloadTooLargeCalled, true);
    // Should NOT retry — only 1 fetch call
    assert.equal(fetchCalls.length, 1);
  });
});
