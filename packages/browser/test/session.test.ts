import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SessionManager } from "../src/session.js";
import { createMockDocument, setGlobal, restoreGlobal, type MockDocument } from "./helpers.js";

describe("SessionManager", () => {
  let doc: MockDocument;

  beforeEach(() => {
    doc = createMockDocument();
    setGlobal("document", doc);
  });

  afterEach(() => {
    restoreGlobal("document");
  });

  it("emits session_start on construction", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 1_800_000,
      onNewSession: (r: string) => reasons.push(r),
    });

    assert.deepEqual(reasons, ["session_start"]);
    assert.ok(sm.sessionId);
    sm.destroy();
  });

  it("rotates session on visibility change after timeout", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 50,
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

  it("emits app_foreground when returning within timeout", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 60_000,
      onNewSession: (r: string) => reasons.push(r),
    });

    reasons.length = 0;

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");

    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    assert.equal(reasons[0], "app_foreground");
    sm.destroy();
  });

  it("touch resets activity timer", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 1_800_000,
      onNewSession: (r: string) => reasons.push(r),
    });

    sm.touch();
    assert.deepEqual(reasons, ["session_start"]);
    sm.destroy();
  });

  it("destroy removes listeners", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 1_800_000,
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

  it("cooldown prevents duplicate context events", () => {
    const reasons: string[] = [];
    const sm = new SessionManager({
      timeout: 60_000,
      onNewSession: (r: string) => reasons.push(r),
    });

    reasons.length = 0;

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");
    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange");
    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange");

    assert.equal(reasons.filter((r) => r === "app_foreground").length, 1);
    sm.destroy();
  });
});
