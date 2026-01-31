import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import tell from "../src/index.js";
import { fetchCalls, setupBrowserGlobals, setGlobal } from "./helpers.js";

const API_KEY = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("tell (browser singleton)", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupBrowserGlobals();
    cleanup = env.cleanup;
  });

  afterEach(() => {
    tell._resetForTesting();
    cleanup();
  });

  // --- Configure ---

  it("throws on invalid API key", () => {
    assert.throws(() => tell.configure("bad"));
  });

  it("rejects double configure", () => {
    const errors: Error[] = [];
    tell.configure(API_KEY, { onError: (err) => errors.push(err), botDetection: false });
    tell.configure(API_KEY, { onError: (err) => errors.push(err), botDetection: false });
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("already configured"));
  });

  // --- Pre-init queue ---

  it("buffers events before configure and replays", async () => {
    tell.track("Page Viewed", { url: "/home" });
    tell.identify("u_1", { name: "Jane" });

    assert.equal(fetchCalls.length, 0);

    tell.configure(API_KEY, { botDetection: false });
    await tell.flush();

    // Should have sent the buffered events (+ context event from session start)
    assert.ok(fetchCalls.length >= 1);

    // Find the track event
    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const trackEvent = bodies.find(
      (b: any) => b.type === "track" && b.event === "Page Viewed"
    );
    assert.ok(trackEvent);
    assert.equal(trackEvent.properties.url, "/home");

    const identifyEvent = bodies.find((b: any) => b.type === "identify");
    assert.ok(identifyEvent);
    assert.equal(identifyEvent.user_id, "u_1");
  });

  // --- Track ---

  it("track sends event with correct shape", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.track("Button Clicked", { button: "save" });
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find(
      (b: any) => b.type === "track" && b.event === "Button Clicked"
    );
    assert.ok(event);
    assert.equal(event.properties.button, "save");
    assert.ok(event.device_id);
    assert.ok(event.session_id);
    assert.ok(event.timestamp);
  });

  // --- Identify sets userId ---

  it("identify sets userId on subsequent events", async () => {
    tell.configure(API_KEY, { botDetection: false });

    tell.track("Before Identify");
    await tell.flush();

    const bodies1 = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const beforeEvent = bodies1.find(
      (b: any) => b.event === "Before Identify"
    );
    assert.equal(beforeEvent?.user_id, undefined);

    tell.identify("u_42", { name: "Test" });
    tell.track("After Identify");
    await tell.flush();

    const bodies2 = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const afterEvent = bodies2.find(
      (b: any) => b.event === "After Identify"
    );
    assert.equal(afterEvent?.user_id, "u_42");
  });

  // --- Group ---

  it("group sends groupId", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.group("g_100", { plan: "enterprise" });
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.type === "group");
    assert.ok(event);
    assert.equal(event.group_id, "g_100");
  });

  // --- Revenue ---

  it("revenue sends Order Completed", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.revenue(49.99, "USD", "ord_1");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Order Completed");
    assert.ok(event);
    assert.equal(event.properties.amount, 49.99);
    assert.equal(event.properties.currency, "USD");
    assert.equal(event.properties.order_id, "ord_1");
  });

  // --- Alias ---

  it("alias sends previous_id", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.alias("anon_1", "u_1");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.type === "alias");
    assert.ok(event);
    assert.equal(event.user_id, "u_1");
    assert.equal(event.properties.previous_id, "anon_1");
  });

  // --- Logging ---

  it("log sends to /v1/logs", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.logError("connection refused", "api", { code: 500 });
    await tell.flush();

    const logCall = fetchCalls.find((c) => c.url.includes("/v1/logs"));
    assert.ok(logCall);
    const log = JSON.parse(logCall.init.body as string);
    assert.equal(log.level, "error");
    assert.equal(log.message, "connection refused");
    assert.equal(log.service, "api");
  });

  // --- optOut / optIn ---

  it("optOut stops sending, optIn resumes", async () => {
    tell.configure(API_KEY, { botDetection: false });

    tell.optOut();
    assert.equal(tell.isOptedOut(), true);
    tell.track("Should Not Send");
    await tell.flush();

    const eventCallCount = fetchCalls.filter((c) =>
      c.url.includes("/v1/events")
    ).length;

    tell.optIn();
    assert.equal(tell.isOptedOut(), false);
    tell.track("Should Send");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const sent = bodies.find((b: any) => b.event === "Should Send");
    const notSent = bodies.find((b: any) => b.event === "Should Not Send");
    assert.ok(sent);
    assert.equal(notSent, undefined);
  });

  // --- disable / enable ---

  it("disable stops sending, enable resumes", async () => {
    tell.configure(API_KEY, { botDetection: false });

    tell.disable();
    tell.track("Disabled Event");
    await tell.flush();

    tell.enable();
    tell.track("Enabled Event");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const disabled = bodies.find((b: any) => b.event === "Disabled Event");
    const enabled = bodies.find((b: any) => b.event === "Enabled Event");
    assert.equal(disabled, undefined);
    assert.ok(enabled);
  });

  // --- disabled config flag ---

  it("disabled config flag silently drops all", async () => {
    tell.configure(API_KEY, { disabled: true, botDetection: false });
    tell.track("Nope");
    tell.logInfo("Nope");
    await tell.flush();

    const eventCalls = fetchCalls.filter((c) =>
      c.url.includes("/v1/events")
    );
    const logCalls = fetchCalls.filter((c) => c.url.includes("/v1/logs"));
    // Only the context event from session_start (which fires during configure)
    // may have been sent if disabled was set after session init; but disabled
    // is set before batchers, so nothing should be sent.
    // Actually the sessionManager onNewSession checks _disabled, so nothing.
    assert.equal(eventCalls.length, 0);
    assert.equal(logCalls.length, 0);
  });

  // --- Bot detection ---

  it("bot detection auto-disables", async () => {
    setGlobal("navigator", {
      userAgent: "Chrome/120",
      language: "en",
      onLine: true,
      sendBeacon: () => true,
      webdriver: true,
      doNotTrack: null,
    });

    tell.configure(API_KEY);
    tell.track("Bot Event");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Bot Event");
    assert.equal(event, undefined);
  });

  // --- reset ---

  it("reset clears userId and generates new deviceId", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.identify("u_1");
    tell.track("Before Reset");
    await tell.flush();

    const bodies1 = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const before = bodies1.find((b: any) => b.event === "Before Reset");
    const oldDeviceId = before?.device_id;

    tell.reset();
    tell.track("After Reset");
    await tell.flush();

    const bodies2 = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const after = bodies2.find((b: any) => b.event === "After Reset");
    assert.equal(after?.user_id, undefined);
    assert.notEqual(after?.device_id, oldDeviceId);
  });

  // --- close ---

  it("close flushes and rejects subsequent events", async () => {
    const errors: Error[] = [];
    tell.configure(API_KEY, {
      botDetection: false,
      onError: (err) => errors.push(err),
    });

    tell.track("Last Event");
    await tell.close();

    tell.track("Too Late");

    assert.equal(errors.length, 1);
    assert.equal(errors[0].name, "ClosedError");
  });

  // --- beforeSend ---

  it("beforeSend modifies events", async () => {
    tell.configure(API_KEY, {
      botDetection: false,
      beforeSend: (event) => ({
        ...event,
        properties: { ...event.properties, injected: true },
      }),
    });

    tell.track("Click");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Click");
    assert.equal(event?.properties.injected, true);
  });

  it("beforeSend drops events by returning null", async () => {
    tell.configure(API_KEY, {
      botDetection: false,
      beforeSend: (event) => (event.event === "Secret" ? null : event),
    });

    tell.track("Secret");
    tell.track("Public");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const secret = bodies.find((b: any) => b.event === "Secret");
    const pub = bodies.find((b: any) => b.event === "Public");
    assert.equal(secret, undefined);
    assert.ok(pub);
  });

  // --- beforeSendLog ---

  it("beforeSendLog modifies logs", async () => {
    tell.configure(API_KEY, {
      botDetection: false,
      beforeSendLog: (log) => ({
        ...log,
        data: { ...log.data, enriched: true },
      }),
    });

    tell.logInfo("test");
    await tell.flush();

    const logCall = fetchCalls.find((c) => c.url.includes("/v1/logs"));
    assert.ok(logCall);
    const log = JSON.parse(logCall.init.body as string);
    assert.equal(log.data.enriched, true);
  });

  it("beforeSendLog drops logs by returning null", async () => {
    tell.configure(API_KEY, {
      botDetection: false,
      beforeSendLog: (log) => (log.level === "debug" ? null : log),
    });

    tell.logDebug("noise");
    tell.logError("real");
    await tell.flush();

    const logCall = fetchCalls.find((c) => c.url.includes("/v1/logs"));
    assert.ok(logCall);
    const log = JSON.parse(logCall.init.body as string);
    assert.equal(log.level, "error");
  });

  // --- Super properties ---

  it("register merges super properties", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.register({ env: "prod", version: "2.0" });
    tell.track("Click", { button: "save" });
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Click");
    assert.equal(event?.properties.env, "prod");
    assert.equal(event?.properties.version, "2.0");
    assert.equal(event?.properties.button, "save");
  });

  it("event properties override super properties", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.register({ env: "prod" });
    tell.track("Click", { env: "staging" });
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Click");
    assert.equal(event?.properties.env, "staging");
  });

  it("unregister removes a super property", async () => {
    tell.configure(API_KEY, { botDetection: false });
    tell.register({ env: "prod", version: "1.0" });
    tell.unregister("env");
    tell.track("Click");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Click");
    assert.equal(event?.properties.env, undefined);
    assert.equal(event?.properties.version, "1.0");
  });

  // --- flush before configure ---

  it("flush before configure is a no-op", async () => {
    await tell.flush(); // should not throw
    assert.equal(fetchCalls.length, 0);
  });

  // --- UTM capture ---

  it("UTM parameters are registered as super properties", async () => {
    setGlobal("location", {
      href: "https://example.com?utm_source=google&utm_medium=cpc",
      search: "?utm_source=google&utm_medium=cpc",
    });
    // window needs location too for captureUtm
    setGlobal("window", Object.assign(
      { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1280, innerHeight: 720 },
      { location: { search: "?utm_source=google&utm_medium=cpc" } }
    ));

    tell.configure(API_KEY, { botDetection: false });
    tell.track("Click");
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const event = bodies.find((b: any) => b.event === "Click");
    assert.equal(event?.properties.utm_source, "google");
    assert.equal(event?.properties.utm_medium, "cpc");
  });

  // --- Error auto-capture ---

  it("captureErrors sends window.onerror to logError", async () => {
    tell.configure(API_KEY, { botDetection: false, captureErrors: true });

    // Simulate a window error event
    const errorEvent = {
      message: "Uncaught TypeError: x is not a function",
      filename: "app.js",
      lineno: 42,
      colno: 10,
      error: { stack: "TypeError: x is not a function\n    at app.js:42:10" },
    };
    (window as any).dispatchEvent("error", errorEvent);

    await tell.flush();

    const logCall = fetchCalls.find((c) => c.url.includes("/v1/logs"));
    assert.ok(logCall, "expected a log call");
    const log = JSON.parse(logCall.init.body as string);
    assert.equal(log.level, "error");
    assert.equal(log.service, "browser");
    assert.ok(log.message.includes("TypeError"));
    assert.equal(log.data.filename, "app.js");
    assert.equal(log.data.lineno, 42);
  });

  it("captureErrors sends unhandledrejection to logError", async () => {
    tell.configure(API_KEY, { botDetection: false, captureErrors: true });

    // Simulate an unhandled rejection
    const rejectionEvent = {
      reason: new Error("promise failed"),
    };
    (window as any).dispatchEvent("unhandledrejection", rejectionEvent);

    await tell.flush();

    const logCall = fetchCalls.find((c) => c.url.includes("/v1/logs"));
    assert.ok(logCall, "expected a log call");
    const log = JSON.parse(logCall.init.body as string);
    assert.equal(log.level, "error");
    assert.ok(log.message.includes("promise failed"));
  });

  // --- context event structure ---

  it("context event has reason inside context object", async () => {
    tell.configure(API_KEY, { botDetection: false });
    await tell.flush();

    const bodies = fetchCalls.flatMap((c) =>
      (c.init.body as string).split("\n").map((l) => JSON.parse(l))
    );
    const ctx = bodies.find((b: any) => b.type === "context");
    assert.ok(ctx, "expected a context event");
    assert.equal(ctx.context.reason, "session_start");
    assert.equal(ctx.properties, undefined);
  });
});
