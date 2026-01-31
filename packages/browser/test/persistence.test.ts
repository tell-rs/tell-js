import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createStorage, STORAGE_KEYS } from "../src/persistence.js";
import { createMockLocalStorage, setGlobal, restoreGlobal } from "./helpers.js";

describe("persistence", () => {
  beforeEach(() => {
    setGlobal("localStorage", createMockLocalStorage());
  });

  afterEach(() => {
    restoreGlobal("localStorage");
  });

  it("localStorage storage reads, writes, and removes", () => {
    const s = createStorage("localStorage");
    assert.equal(s.get("tell_device_id"), null);

    s.set("tell_device_id", "abc");
    assert.equal(s.get("tell_device_id"), "abc");

    s.remove("tell_device_id");
    assert.equal(s.get("tell_device_id"), null);
  });

  it("falls back to memory when localStorage throws", () => {
    setGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });

    const s = createStorage("localStorage");
    s.set("key", "val");
    assert.equal(s.get("key"), "val");
  });

  it("memory storage works independently", () => {
    const s = createStorage("memory");
    s.set("a", "1");
    assert.equal(s.get("a"), "1");
    s.remove("a");
    assert.equal(s.get("a"), null);
  });

  it("exports correct storage keys", () => {
    assert.equal(STORAGE_KEYS.DEVICE_ID, "tell_device_id");
    assert.equal(STORAGE_KEYS.USER_ID, "tell_user_id");
    assert.equal(STORAGE_KEYS.OPT_OUT, "tell_opt_out");
    assert.equal(STORAGE_KEYS.SUPER_PROPS, "tell_super_props");
  });
});
