import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redact, redactLog, SENSITIVE_PARAMS } from "@tell-rs/core";
import type { JsonEvent, JsonLog } from "@tell-rs/core";

function makeEvent(overrides: Partial<JsonEvent> = {}): JsonEvent {
  return {
    type: "track",
    event: "Page Viewed",
    device_id: "d1",
    session_id: "s1",
    user_id: "u1",
    timestamp: 1000,
    ...overrides,
  };
}

describe("redact", () => {
  it("stripParams strips token from url", () => {
    const fn = redact({ stripParams: ["token"] });
    const event = makeEvent({ url: "https://example.com/page?token=abc&tab=1" });
    const result = fn(event)!;
    assert.equal(result.url, "https://example.com/page?tab=1");
  });

  it("stripParams strips from URL-shaped values", () => {
    const fn = redact({ stripParams: ["api_key"] });
    const event = makeEvent({
      link: "https://example.com/callback?api_key=secret123&page=2",
      name: "test",
    });
    const result = fn(event)!;
    assert.equal(result.link, "https://example.com/callback?page=2");
  });

  it("stripParams leaves non-URL values untouched", () => {
    const fn = redact({ stripParams: ["token"] });
    const event = makeEvent({ label: "my-token-value", count: 42 });
    const result = fn(event)!;
    assert.equal(result.label, "my-token-value");
    assert.equal(result.count, 42);
  });

  it("redactKeys replaces matching key with [REDACTED]", () => {
    const fn = redact({ redactKeys: ["email"] });
    const event = makeEvent({ email: "jane@example.com", plan: "pro" });
    const result = fn(event)!;
    assert.equal(result.email, "[REDACTED]");
    assert.equal(result.plan, "pro");
  });

  it("redactKeys works on identify events", () => {
    const fn = redact({ redactKeys: ["ssn"] });
    const event = makeEvent({
      type: "identify",
      ssn: "123-45-6789",
      name: "Jane",
    });
    const result = fn(event)!;
    assert.equal(result.ssn, "[REDACTED]");
    assert.equal(result.name, "Jane");
  });

  it("dropRoutes returns null for matching URL pathname prefix", () => {
    const fn = redact({ dropRoutes: ["/internal", "/health"] });
    const event = makeEvent({ url: "https://example.com/internal/debug?x=1" });
    const result = fn(event);
    assert.equal(result, null);
  });

  it("dropRoutes passes through non-matching URLs", () => {
    const fn = redact({ dropRoutes: ["/internal"] });
    const event = makeEvent({ url: "https://example.com/dashboard?q=search" });
    const result = fn(event);
    assert.notEqual(result, null);
    assert.equal(result!.event, "Page Viewed");
  });

  it("combined options work together", () => {
    const fn = redact({
      stripParams: ["token"],
      redactKeys: ["email"],
      dropRoutes: ["/admin"],
    });

    // Should be dropped
    const adminEvent = makeEvent({ url: "https://example.com/admin/settings" });
    assert.equal(fn(adminEvent), null);

    // Should strip + redact
    const normalEvent = makeEvent({
      url: "https://example.com/page?token=abc",
      email: "jane@test.com",
      page: "/home",
    });
    const result = fn(normalEvent)!;
    assert.equal(result.url, "https://example.com/page");
    assert.equal(result.email, "[REDACTED]");
    assert.equal(result.page, "/home");
  });

  it("empty options pass events through unchanged", () => {
    const fn = redact({});
    const event = makeEvent({ url: "https://example.com?secret=123", email: "test@test.com" });
    const result = fn(event);
    // Should be the exact same object reference (no copy needed)
    assert.equal(result, event);
  });
});

describe("redactLog", () => {
  it("replaces matching keys in log.data", () => {
    const fn = redactLog({ redactKeys: ["password", "token"] });
    const log: JsonLog = {
      level: "info",
      message: "User login",
      timestamp: 1000,
      data: { password: "hunter2", token: "abc123", action: "login" },
    };
    const result = fn(log)!;
    assert.equal(result.data!.password, "[REDACTED]");
    assert.equal(result.data!.token, "[REDACTED]");
    assert.equal(result.data!.action, "login");
  });
});

describe("SENSITIVE_PARAMS", () => {
  it("contains expected entries", () => {
    const expected = [
      "token",
      "api_key",
      "key",
      "secret",
      "password",
      "access_token",
      "refresh_token",
      "authorization",
    ];
    for (const param of expected) {
      assert.ok(
        SENSITIVE_PARAMS.includes(param),
        `SENSITIVE_PARAMS should include "${param}"`,
      );
    }
  });
});
