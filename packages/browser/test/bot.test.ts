import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isBot } from "../src/bot.js";
import { setGlobal, restoreGlobal } from "./helpers.js";

describe("isBot", () => {
  beforeEach(() => {
    // save original
    setGlobal("navigator", { webdriver: false, userAgent: "Chrome/120.0" });
  });

  afterEach(() => {
    restoreGlobal("navigator");
  });

  it("returns true when webdriver is true", () => {
    setGlobal("navigator", { webdriver: true, userAgent: "" });
    assert.equal(isBot(), true);
  });

  it("returns true when UA contains HeadlessChrome", () => {
    setGlobal("navigator", {
      webdriver: false,
      userAgent: "Mozilla/5.0 HeadlessChrome/120.0",
    });
    assert.equal(isBot(), true);
  });

  it("returns true when UA contains Headless (case-insensitive)", () => {
    setGlobal("navigator", {
      webdriver: false,
      userAgent: "Mozilla/5.0 headless",
    });
    assert.equal(isBot(), true);
  });

  it("returns false for normal user agent", () => {
    setGlobal("navigator", {
      webdriver: false,
      userAgent: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
    });
    assert.equal(isBot(), false);
  });

  it("returns false when navigator is undefined", () => {
    setGlobal("navigator", undefined);
    assert.equal(isBot(), false);
  });
});
