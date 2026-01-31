import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { BrowserTransport } from "../src/transport.js";
import type { JsonEvent, JsonLog } from "@tell-rs/core";
import { fetchCalls, resetFetchMock, mockFetch, setGlobal, restoreGlobal } from "./helpers.js";

describe("BrowserTransport", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetFetchMock();
    globalThis.fetch = mockFetch as typeof globalThis.fetch;
    setGlobal("navigator", { onLine: true, sendBeacon: () => true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreGlobal("navigator");
  });

  it("sends events as NDJSON with auth and keepalive", async () => {
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 10_000,
    });

    const events: JsonEvent[] = [
      { type: "track", event: "Click", device_id: "d", timestamp: 1 },
    ];

    await transport.sendEvents(events);

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://collect.example.com/v1/events");
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.equal(fetchCalls[0].init.keepalive, true);

    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/x-ndjson");
    assert.equal(headers["Authorization"], "Bearer a1b2c3d4e5f60718293a4b5c6d7e8f90");

    const body = fetchCalls[0].init.body as string;
    const parsed = JSON.parse(body);
    assert.equal(parsed.type, "track");
    assert.equal(parsed.event, "Click");
  });

  it("sends logs to /v1/logs", async () => {
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 10_000,
    });

    const logs: JsonLog[] = [
      { level: "error", message: "fail", timestamp: 1 },
    ];

    await transport.sendLogs(logs);
    assert.equal(fetchCalls[0].url, "https://collect.example.com/v1/logs");
  });

  it("skips empty arrays", async () => {
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 10_000,
    });

    await transport.sendEvents([]);
    await transport.sendLogs([]);
    assert.equal(fetchCalls.length, 0);
  });

  it("401 does not retry", async () => {
    globalThis.fetch = (async () =>
      ({ status: 401, statusText: "Unauthorized" }) as Response) as typeof globalThis.fetch;

    const errors: Error[] = [];
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 10_000,
      onError: (err) => errors.push(err),
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("Invalid API key"));
  });

  it("413 calls onPayloadTooLarge and throws", async () => {
    globalThis.fetch = (async () =>
      ({ status: 413, statusText: "Payload Too Large" }) as Response) as typeof globalThis.fetch;

    let called = false;
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 10_000,
      onPayloadTooLarge: () => {
        called = true;
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

    assert.equal(called, true);
  });

  it("retries on 500", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount <= 2) {
        return { status: 500, statusText: "Internal Server Error" } as Response;
      }
      return { status: 202, statusText: "Accepted" } as Response;
    }) as typeof globalThis.fetch;

    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 3,
      networkTimeout: 10_000,
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    assert.equal(callCount, 3);
  });

  it("beacon uses navigator.sendBeacon", () => {
    const beaconCalls: { url: string }[] = [];
    setGlobal("navigator", {
      onLine: true,
      sendBeacon: (url: string) => {
        beaconCalls.push({ url });
        return true;
      },
    });

    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 10_000,
    });

    transport.beacon(
      [{ type: "track", event: "Click", device_id: "d", timestamp: 1 }],
      [{ level: "info", message: "test", timestamp: 1 }]
    );

    assert.equal(beaconCalls.length, 2);
    assert.ok(beaconCalls[0].url.includes("/v1/events"));
    assert.ok(beaconCalls[0].url.includes("token="));
    assert.ok(beaconCalls[1].url.includes("/v1/logs"));
  });

  it("skips fetch when offline", async () => {
    setGlobal("navigator", { onLine: false });
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return { status: 202, statusText: "Accepted" } as Response;
    }) as typeof globalThis.fetch;

    const errors: Error[] = [];
    const transport = new BrowserTransport({
      endpoint: "https://collect.example.com",
      apiKey: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
      maxRetries: 0,
      networkTimeout: 10_000,
      onError: (err) => errors.push(err),
    });

    await transport.sendEvents([
      { type: "track", event: "test", device_id: "d", timestamp: 1 },
    ]);

    assert.equal(fetchCalled, false);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("offline"));
  });
});
