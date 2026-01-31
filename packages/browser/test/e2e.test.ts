//! End-to-end smoke test — sends every API method to a real collector.
//!
//! Start your Tell server, then:
//!
//!   npm run test:e2e -w packages/browser
//!

import { describe, it, afterEach } from "node:test";
import { setGlobal, restoreGlobal } from "./helpers.js";
import tell from "../src/index.js";

const API_KEY = "4cc3542f199d280d29eace8497ed062f";
const USER = "e2e_user_js_browser";
const ENDPOINT = "http://localhost:8080";

function send(label: string): void {
  console.log(`  -> ${label}`);
}

describe("tell-js browser e2e", { skip: !process.env.TELL_E2E }, () => {
  afterEach(() => {
    tell._resetForTesting();
    restoreGlobal("navigator");
    restoreGlobal("document");
    restoreGlobal("window");
  });

  it("smoke — sends every API method to the collector", async () => {
    // Minimal browser globals — real fetch is used for actual HTTP calls
    setGlobal("navigator", {
      onLine: true,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36",
      sendBeacon: () => true,
    });

    const listeners: Record<string, Function[]> = {};
    setGlobal("document", {
      visibilityState: "visible",
      addEventListener: (event: string, fn: Function) => {
        (listeners[event] ??= []).push(fn);
      },
      removeEventListener: () => {},
    });

    setGlobal("window", {
      addEventListener: () => {},
      removeEventListener: () => {},
      screen: { width: 1920, height: 1080 },
      innerWidth: 1920,
      innerHeight: 1080,
    });

    console.log();
    console.log("  Tell Browser SDK — E2E smoke test");
    console.log(`  Endpoint: ${ENDPOINT}`);
    console.log();

    // ── Configure ─────────────────────────────────────────────────────
    send("configure");
    tell.configure(API_KEY, {
      endpoint: ENDPOINT,
      batchSize: 10,
      flushInterval: 60_000, // long interval — we flush manually
      logLevel: "debug",
      persistence: "memory",
      botDetection: false,
      onError: (err) => console.error(`  !! ${err.message}`),
    });

    // ── Super properties ──────────────────────────────────────────────
    send("register super properties");
    tell.register({ sdk: "browser", sdk_version: "0.1.0", test: "e2e" });

    // ── Track ─────────────────────────────────────────────────────────
    send("track with properties");
    tell.track("Page Viewed", {
      url: "/home",
      referrer: "google",
      screen: "1920x1080",
    });

    send("track with different properties");
    tell.track("Feature Used", {
      feature: "export",
      format: "csv",
      rows: 1500,
    });

    send("track without properties");
    tell.track("App Opened");

    // ── Identify ──────────────────────────────────────────────────────
    send("identify");
    tell.identify(USER, {
      name: "E2E Test User",
      email: "e2e-browser@tell.app",
      plan: "pro",
      created_at: "2025-01-01T00:00:00Z",
    });

    send("track after identify (should include user_id)");
    tell.track("Search Performed", { query: "analytics sdk", results: 42 });

    // ── Group ─────────────────────────────────────────────────────────
    send("group");
    tell.group("org_js_browser", {
      name: "Tell Engineering",
      plan: "enterprise",
      seats: 50,
    });

    // ── Revenue ───────────────────────────────────────────────────────
    send("revenue with properties");
    tell.revenue(49.99, "USD", "order_e2e_browser_001", {
      product: "pro_annual",
      coupon: "LAUNCH50",
    });

    send("revenue without properties");
    tell.revenue(9.99, "USD", "order_e2e_browser_002");

    // ── Alias ─────────────────────────────────────────────────────────
    send("alias");
    tell.alias("anon_visitor_browser", USER);

    // ── Logging — all 9 levels ────────────────────────────────────────
    send("log_emergency");
    tell.logEmergency("System failure — disk full", "storage", {
      disk: "/dev/sda1",
      usage_pct: 100,
    });

    send("log_alert");
    tell.logAlert("Database replication lag > 30s", "db", {
      lag_seconds: 34,
    });

    send("log_critical");
    tell.logCritical("Payment gateway unreachable", "billing", {
      gateway: "stripe",
      timeout_ms: 5000,
    });

    send("log_error");
    tell.logError("Failed to send email", "notifications", {
      recipient: "user@example.com",
      error: "SMTP timeout",
    });

    send("log_warning");
    tell.logWarning("Rate limit approaching", "api", {
      current_rps: 950,
      limit_rps: 1000,
    });

    send("log_notice");
    tell.logNotice("New deployment started", "deploy", {
      version: "2.1.0",
      region: "us-east-1",
    });

    send("log_info");
    tell.logInfo("User signed in", "auth", {
      method: "oauth",
      provider: "github",
    });

    send("log_debug");
    tell.logDebug("Cache miss for key", "cache", {
      key: "user:e2e:profile",
      ttl_remaining: 0,
    });

    send("log_trace");
    tell.logTrace("Entering request handler", "http", {
      method: "GET",
      path: "/api/v1/events",
    });

    send("log with no service/data");
    tell.logInfo("Heartbeat");

    // ── Unregister ────────────────────────────────────────────────────
    send("unregister 'test' super property");
    tell.unregister("test");

    send("track after unregister (should lack 'test' key)");
    tell.track("Post Unregister", { step: "verify_unregister" });

    // ── Reset ─────────────────────────────────────────────────────────
    send("reset (new device + session, clear user)");
    tell.reset();

    send("track after reset (anonymous, new ids)");
    tell.track("Post Reset", { step: "verify_new_ids" });

    // ── Opt out / opt in ──────────────────────────────────────────────
    send("opt out");
    tell.optOut();

    send("track while opted out (should be dropped)");
    tell.track("Should Not Arrive");

    send("opt in");
    tell.optIn();

    send("track after opt in");
    tell.track("Post Opt In", { step: "verify_opt_in" });

    // ── Flush & close ─────────────────────────────────────────────────
    send("flush");
    await tell.flush();
    console.log("  .. flush ok");

    send("close");
    await tell.close();
    console.log("  .. close ok");

    console.log();
    console.log("  Done — 29 calls sent. Verify on the collector.");
    console.log();
  });
});
