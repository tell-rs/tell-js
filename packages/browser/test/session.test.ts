import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SessionManager } from "../src/session.js";
import { createMockDocument, setGlobal, restoreGlobal, type MockDocument } from "./helpers.js";
import type { TellStorage } from "../src/persistence.js";

function createMemoryStorage(): TellStorage {
  const data = new Map<string, string>();
  return {
    get: (key: string) => data.get(key) ?? null,
    set: (key: string, value: string) => { data.set(key, value); },
    remove: (key: string) => { data.delete(key); },
  };
}

const THIRTY_MIN = 1_800_000;
const TWENTY_FOUR_HR = 86_400_000;

describe("SessionManager", () => {
  let doc: MockDocument;
  let storage: TellStorage;

  beforeEach(() => {
    doc = createMockDocument();
    storage = createMemoryStorage();
    setGlobal("document", doc);
  });

  afterEach(() => {
    restoreGlobal("document");
  });

  it("emits session_start on construction with no stored session", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.deepEqual(reasons, ["session_start"]);
    assert.ok(sm.sessionId);
    sm.destroy();
  });

  it("restores session from storage when still valid", () => {
    const reasons: string[] = [];
    const now = Date.now();
    storage.set("tell_session_id", "restored-session");
    storage.set("tell_session_ts", String(now - 5_000)); // 5s ago
    storage.set("tell_session_start", String(now - 60_000)); // 1 min ago

    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.equal(sm.sessionId, "restored-session");
    assert.deepEqual(reasons, []); // no event emitted
    sm.destroy();
  });

  it("creates new session when stored session has idle-expired", () => {
    const reasons: string[] = [];
    const now = Date.now();
    storage.set("tell_session_id", "old-session");
    storage.set("tell_session_ts", String(now - THIRTY_MIN - 1_000)); // 30min + 1s ago
    storage.set("tell_session_start", String(now - THIRTY_MIN - 1_000));

    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.notEqual(sm.sessionId, "old-session");
    assert.deepEqual(reasons, ["session_start"]);
    sm.destroy();
  });

  it("creates new session when stored session exceeds max length", () => {
    const reasons: string[] = [];
    const now = Date.now();
    storage.set("tell_session_id", "old-session");
    storage.set("tell_session_ts", String(now - 1_000)); // recent activity
    storage.set("tell_session_start", String(now - TWENTY_FOUR_HR - 1_000)); // started >24h ago

    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.notEqual(sm.sessionId, "old-session");
    assert.deepEqual(reasons, ["session_start"]);
    sm.destroy();
  });

  it("persists session to storage on creation", () => {
    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: () => {},
    });

    assert.equal(storage.get("tell_session_id"), sm.sessionId);
    assert.ok(storage.get("tell_session_ts"));
    assert.ok(storage.get("tell_session_start"));
    sm.destroy();
  });

  it("rotates session on visibility change after timeout", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 50,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    const firstSession = sm.sessionId;
    reasons.length = 0;

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");

    const start = Date.now();
    while (Date.now() - start < 60) {
      // busy wait past timeout
    }

    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    assert.equal(reasons[0], "session_timeout");
    assert.notEqual(sm.sessionId, firstSession);
    sm.destroy();
  });

  it("does not emit on visibility change within timeout", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 60_000,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    reasons.length = 0;

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");

    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    assert.equal(reasons.length, 0); // no event — session just continues
    sm.destroy();
  });

  it("touch resets activity timer", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    sm.touch();
    assert.deepEqual(reasons, ["session_start"]);
    sm.destroy();
  });

  it("touch rotates session when idle longer than timeout", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 50,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    const firstSession = sm.sessionId;
    reasons.length = 0;

    const start = Date.now();
    while (Date.now() - start < 60) {
      // busy wait past timeout
    }

    sm.touch();
    assert.equal(reasons[0], "session_timeout");
    assert.notEqual(sm.sessionId, firstSession);
    sm.destroy();
  });

  it("touch rotates session when max length exceeded", () => {
    const reasons: string[] = [];
    const now = Date.now();
    // Set up a session that started just over maxLength ago but is still "active"
    storage.set("tell_session_id", "long-session");
    storage.set("tell_session_ts", String(now - 1_000));
    storage.set("tell_session_start", String(now - 100)); // recent start for constructor check

    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: 50, // 50ms max length
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    reasons.length = 0;

    const start = Date.now();
    while (Date.now() - start < 60) {
      // busy wait past max length
    }

    sm.touch();
    assert.equal(reasons[0], "session_timeout");
    assert.notEqual(sm.sessionId, "long-session");
    sm.destroy();
  });

  it("destroy removes listeners", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    sm.destroy();
    reasons.length = 0;

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");
    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    assert.equal(reasons.length, 0);
  });

  it("repeated tab switches do not emit any events", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 60_000,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    reasons.length = 0;

    // Simulate rapid tab switching (the exact scenario from the bug)
    for (let i = 0; i < 10; i++) {
      doc.visibilityState = "hidden";
      doc.dispatchEvent("visibilitychange");
      doc.visibilityState = "visible";
      doc.dispatchEvent("visibilitychange");
    }

    assert.equal(reasons.length, 0); // zero events — session is continuous
    sm.destroy();
  });

  it("session survives across page loads via storage", () => {
    // First "page load"
    const sm1 = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: () => {},
    });
    const originalSessionId = sm1.sessionId;
    sm1.touch(); // update activity
    sm1.destroy();

    // Second "page load" — should restore same session
    const reasons: string[] = [];
    const sm2 = new SessionManager({
      timeout: THIRTY_MIN,
      maxLength: TWENTY_FOUR_HR,
      storage,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.equal(sm2.sessionId, originalSessionId);
    assert.deepEqual(reasons, []); // no session_start — same session
    sm2.destroy();
  });
});
