import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { hostname } from "node:os";
import { Tell } from "../src/index.js";
import { development, production } from "../src/config.js";

// Mock fetch
let fetchCalls: { url: string; body: string }[] = [];
const originalFetch = globalThis.fetch;

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  fetchCalls.push({ url: String(url), body: init?.body as string });
  return Promise.resolve({ status: 202, statusText: "Accepted" } as Response);
}

const API_KEY = "feed1e11feed1e11feed1e11feed1e11";

describe("Tell (Node SDK)", () => {
  let client: Tell | null = null;

  beforeEach(() => {
    fetchCalls = [];
    globalThis.fetch = mockFetch as typeof globalThis.fetch;
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    globalThis.fetch = originalFetch;
  });

  it("throws on invalid API key", () => {
    assert.throws(() => new Tell({ apiKey: "bad" }));
  });

  it("track sends event with userId", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.track("u_123", "Page Viewed", { url: "/home" });
    await client.flush();

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.endsWith("/v1/events"));

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.type, "track");
    assert.equal(event.event, "Page Viewed");
    assert.equal(event.user_id, "u_123");
    assert.equal(event.url, "/home");
    assert.ok(event.device_id);
    assert.ok(event.session_id);
    assert.ok(event.timestamp);
  });

  it("identify sends traits as flat fields", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.identify("u_456", { name: "Jane", plan: "pro" });
    await client.flush();

    assert.equal(fetchCalls.length, 1);
    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.type, "identify");
    assert.equal(event.user_id, "u_456");
    assert.equal(event.name, "Jane");
    assert.equal(event.plan, "pro");
  });

  it("group sends groupId", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.group("u_789", "g_100", { plan: "enterprise" });
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.type, "group");
    assert.equal(event.group_id, "g_100");
    assert.equal(event.user_id, "u_789");
  });

  it("revenue sends Order Completed event", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.revenue("u_1", 49.99, "USD", "ord_123");
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.type, "track");
    assert.equal(event.event, "Order Completed");
    assert.equal(event.amount, 49.99);
    assert.equal(event.currency, "USD");
    assert.equal(event.order_id, "ord_123");
  });

  it("alias sends previous_id in properties", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.alias("anon_1", "u_1");
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.type, "alias");
    assert.equal(event.user_id, "u_1");
    assert.equal(event.previous_id, "anon_1");
  });

  it("log sends to /v1/logs", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.logError("connection refused", "api", { code: 500 });
    await client.flush();

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.endsWith("/v1/logs"));

    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.level, "error");
    assert.equal(log.message, "connection refused");
    assert.equal(log.service, "api");
    assert.equal(log.data.code, 500);
  });

  it("drops invalid events via onError", async () => {
    const errors: Error[] = [];
    client = new Tell({
      apiKey: API_KEY,
      onError: (err) => errors.push(err),
    });

    client.track("", "Page Viewed"); // empty userId
    client.track("u_1", ""); // empty event name
    await client.flush();

    assert.equal(errors.length, 2);
    assert.equal(fetchCalls.length, 0); // nothing sent
  });

  it("register merges super properties into events", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.register({ app_version: "2.0", env: "prod" });
    client.track("u_1", "Click", { button: "save" });
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.app_version, "2.0");
    assert.equal(event.env, "prod");
    assert.equal(event.button, "save");
  });

  it("event properties override super properties", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.register({ env: "prod" });
    client.track("u_1", "Click", { env: "staging" });
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.env, "staging");
  });

  it("unregister removes a super property", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.register({ env: "prod", version: "1.0" });
    client.unregister("env");
    client.track("u_1", "Click");
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.env, undefined);
    assert.equal(event.version, "1.0");
  });

  it("close flushes and stops", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.track("u_1", "Test Event");
    await client.close();
    client = null; // already closed

    assert.equal(fetchCalls.length, 1);
    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.event, "Test Event");
  });

  it("resetSession changes session ID", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.track("u_1", "Event 1");
    await client.flush();
    const session1 = JSON.parse(fetchCalls[0].body).session_id;

    client.resetSession();
    client.track("u_1", "Event 2");
    await client.flush();
    const session2 = JSON.parse(fetchCalls[1].body).session_id;

    assert.notEqual(session1, session2);
  });

  // --- Source and service tests ---

  it("log entries include source field", async () => {
    client = new Tell({ apiKey: API_KEY, source: "web-01" });

    client.logInfo("startup", "api");
    await client.flush();

    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.source, "web-01");
  });

  it("source defaults to os.hostname()", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.logInfo("test");
    await client.flush();

    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.source, hostname());
  });

  it("log service defaults to 'app'", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.logInfo("test");
    await client.flush();

    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.service, "app");
  });

  it("rejects events after close", async () => {
    const errors: Error[] = [];
    client = new Tell({
      apiKey: API_KEY,
      onError: (err) => errors.push(err),
    });

    await client.close();
    client.track("u_1", "Should Not Send");
    client = null;

    assert.equal(errors.length, 1);
    assert.equal(errors[0].name, "ClosedError");
    assert.equal(fetchCalls.length, 0);
  });

  it("close respects closeTimeout", async () => {
    // Slow fetch that takes longer than closeTimeout
    globalThis.fetch = (async () => {
      await new Promise((r) => setTimeout(r, 10_000));
      return { status: 202, statusText: "Accepted" } as Response;
    }) as typeof globalThis.fetch;

    const errors: Error[] = [];
    client = new Tell({
      apiKey: API_KEY,
      closeTimeout: 50,
      onError: (err) => errors.push(err),
    });

    client.track("u_1", "Test");
    const start = Date.now();
    await client.close();
    client = null;
    const elapsed = Date.now() - start;

    // Should have timed out in ~50ms, not 10s
    assert.ok(elapsed < 500, `close took ${elapsed}ms, expected < 500ms`);
  });

  // --- New tests: disabled flag ---

  it("disabled flag silently drops all events and logs", async () => {
    client = new Tell({ apiKey: API_KEY, disabled: true });

    client.track("u_1", "Page Viewed");
    client.identify("u_2", { name: "Jane" });
    client.group("u_3", "g_1");
    client.revenue("u_4", 10, "USD", "ord_1");
    client.alias("anon_1", "u_5");
    client.logInfo("hello");
    await client.flush();

    assert.equal(fetchCalls.length, 0);
  });

  it("enable() and disable() toggle at runtime", async () => {
    client = new Tell({ apiKey: API_KEY });

    client.disable();
    client.track("u_1", "Should Not Send");
    await client.flush();
    assert.equal(fetchCalls.length, 0);

    client.enable();
    client.track("u_1", "Should Send");
    await client.flush();
    assert.equal(fetchCalls.length, 1);
    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.event, "Should Send");
  });

  // --- New tests: beforeSend ---

  it("beforeSend modifies events", async () => {
    client = new Tell({
      apiKey: API_KEY,
      beforeSend: (event) => ({ ...event, injected: true }),
    });

    client.track("u_1", "Click");
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.injected, true);
  });

  it("beforeSend drops events by returning null", async () => {
    client = new Tell({
      apiKey: API_KEY,
      beforeSend: (event) => (event.event === "Secret" ? null : event),
    });

    client.track("u_1", "Secret"); // dropped
    client.track("u_1", "Public"); // kept
    await client.flush();

    assert.equal(fetchCalls.length, 1);
    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.event, "Public");
  });

  it("beforeSend array pipeline runs in order", async () => {
    client = new Tell({
      apiKey: API_KEY,
      beforeSend: [
        (event) => ({ ...event, step1: true }),
        (event) => ({ ...event, step2: true }),
      ],
    });

    client.track("u_1", "Click");
    await client.flush();

    const event = JSON.parse(fetchCalls[0].body);
    assert.equal(event.step1, true);
    assert.equal(event.step2, true);
  });

  // --- New tests: beforeSendLog ---

  it("beforeSendLog modifies log entries", async () => {
    client = new Tell({
      apiKey: API_KEY,
      beforeSendLog: (log) => ({
        ...log,
        data: { ...log.data, enriched: true },
      }),
    });

    client.logInfo("test message", "api");
    await client.flush();

    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.data.enriched, true);
  });

  it("beforeSendLog drops logs by returning null", async () => {
    client = new Tell({
      apiKey: API_KEY,
      beforeSendLog: (log) => (log.level === "debug" ? null : log),
    });

    client.logDebug("debug noise"); // dropped
    client.logError("real error"); // kept
    await client.flush();

    assert.equal(fetchCalls.length, 1);
    const log = JSON.parse(fetchCalls[0].body);
    assert.equal(log.level, "error");
  });
});

describe("Config presets", () => {
  it("development returns correct config", () => {
    const config = development(API_KEY);
    assert.equal(config.endpoint, "http://localhost:8080");
    assert.equal(config.batchSize, 10);
    assert.equal(config.flushInterval, 2_000);
    assert.equal(config.logLevel, "debug");
    assert.equal(config.apiKey, API_KEY);
  });

  it("production returns correct config", () => {
    const config = production(API_KEY);
    assert.equal(config.logLevel, "error");
    assert.equal(config.apiKey, API_KEY);
    assert.equal(config.endpoint, undefined); // uses DEFAULTS
  });

  it("presets allow overrides", () => {
    const config = development(API_KEY, { batchSize: 50 });
    assert.equal(config.batchSize, 50);
    assert.equal(config.endpoint, "http://localhost:8080"); // kept
  });
});
