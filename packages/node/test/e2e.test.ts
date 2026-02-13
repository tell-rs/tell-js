//! End-to-end smoke test — sends every API method to a real collector.
//!
//! Start your Tell server, then:
//!
//!   npm run test:e2e -w packages/node
//!

import { describe, it } from "node:test";
import { Tell } from "../src/index.js";

const API_KEY = "4cc3542f199d280d29eace8497ed062f";
const USER = "e2e_user_js_node";
const ENDPOINT = "http://localhost:8080";

function send(label: string): void {
  console.log(`  -> ${label}`);
}

describe("@tell-rs/node e2e", { skip: !process.env.TELL_E2E }, () => {
  it("smoke — sends every API method to the collector", async () => {
    console.log();
    console.log("  Tell Node SDK — E2E smoke test");
    console.log(`  Endpoint: ${ENDPOINT}`);
    console.log();

    const tell = new Tell({
      apiKey: API_KEY,
      endpoint: ENDPOINT,
      batchSize: 10,
      logLevel: "debug",
      onError: (err) => console.error(`  !! ${err.message}`),
    });

    // ── Super properties ──────────────────────────────────────────────
    send("register super properties");
    tell.register({ sdk: "node", sdk_version: "0.1.0", test: "e2e" });

    // ── Track ─────────────────────────────────────────────────────────
    send("track with properties");
    tell.track(USER, "Page Viewed", {
      url: "/home",
      referrer: "google",
      screen: "1920x1080",
    });

    send("track with different properties");
    tell.track(USER, "Feature Used", {
      feature: "export",
      format: "csv",
      rows: 1500,
    });

    send("track without properties");
    tell.track(USER, "App Opened");

    // ── Identify ──────────────────────────────────────────────────────
    send("identify");
    tell.identify(USER, {
      name: "E2E Test User",
      email: "e2e-node@tell.app",
      plan: "pro",
      created_at: "2025-01-01T00:00:00Z",
    });

    // ── Group ─────────────────────────────────────────────────────────
    send("group");
    tell.group(USER, "org_js_node", {
      name: "Tell Engineering",
      plan: "enterprise",
      seats: 50,
    });

    // ── Revenue ───────────────────────────────────────────────────────
    send("revenue with properties");
    tell.revenue(USER, 49.99, "USD", "order_e2e_node_001", {
      product: "pro_annual",
      coupon: "LAUNCH50",
    });

    send("revenue without properties");
    tell.revenue(USER, 9.99, "USD", "order_e2e_node_002");

    // ── Alias ─────────────────────────────────────────────────────────
    send("alias");
    tell.alias("anon_visitor_node", USER);

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
    tell.track(USER, "Post Unregister", { step: "verify_unregister" });

    // ── Session reset ─────────────────────────────────────────────────
    send("reset_session");
    tell.resetSession();

    send("track after reset (new session_id)");
    tell.track(USER, "Post Reset", { step: "verify_new_session" });

    // ── Flush & close ─────────────────────────────────────────────────
    send("flush");
    await tell.flush();
    console.log("  .. flush ok");

    send("close");
    await tell.close();
    console.log("  .. close ok");

    console.log();
    console.log("  Done — 23 calls sent. Verify on the collector.");
    console.log();
  });
});
