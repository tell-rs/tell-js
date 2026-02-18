import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { captureContext } from "../src/context.js";
import { setGlobal, restoreGlobal } from "./helpers.js";

const GLOBALS = ["navigator", "screen", "window", "document", "location"] as const;

describe("captureContext", () => {
  afterEach(() => {
    for (const g of GLOBALS) restoreGlobal(g);
  });

  it("parses Chrome UA", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.6099.199 Safari/537.36",
      language: "en-US",
      maxTouchPoints: 0,
      hardwareConcurrency: 10,
    });
    setGlobal("screen", { width: 2560, height: 1440 });
    setGlobal("window", { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 });
    setGlobal("document", { referrer: "https://google.com", title: "Test" });
    setGlobal("location", { href: "https://example.com/page" });

    const ctx = captureContext();
    assert.equal(ctx.browser, "Chrome");
    assert.equal(ctx.browser_version, "120.0.6099.199");
    assert.equal(ctx.os_name, "macOS");
    assert.equal(ctx.device_type, "desktop");
    assert.equal(ctx.screen_width, 2560);
    assert.equal(ctx.viewport_width, 1280);
    assert.equal(ctx.device_pixel_ratio, 2);
    assert.equal(ctx.referrer, "https://google.com");
    assert.equal(ctx.referrer_domain, "google.com");
    assert.equal(ctx.url, "https://example.com/page");
    assert.equal(ctx.locale, "en-US");
    assert.equal(ctx.cpu_cores, 10);
    assert.equal(ctx.touch, false);
  });

  it("parses Firefox UA", () => {
    setGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0",
      language: "en",
    });
    const ctx = captureContext();
    assert.equal(ctx.browser, "Firefox");
    assert.equal(ctx.browser_version, "121.0");
    assert.equal(ctx.os_name, "Linux");
    assert.equal(ctx.device_type, "desktop");
  });

  it("parses Safari UA", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      language: "en",
    });
    const ctx = captureContext();
    assert.equal(ctx.browser, "Safari");
    assert.equal(ctx.browser_version, "17.2");
  });

  it("parses Edge UA", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91",
      language: "en",
    });
    const ctx = captureContext();
    assert.equal(ctx.browser, "Edge");
    assert.equal(ctx.os_name, "Windows");
    assert.equal(ctx.os_version, "10.0");
    assert.equal(ctx.device_type, "desktop");
  });

  it("detects mobile device type from iOS UA", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      language: "en",
      maxTouchPoints: 5,
    });
    const ctx = captureContext();
    assert.equal(ctx.os_name, "iOS");
    assert.equal(ctx.device_type, "mobile");
    assert.equal(ctx.touch, true);
  });

  it("detects iPad as tablet (macOS UA with touch)", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      language: "en",
      maxTouchPoints: 5,
    });
    const ctx = captureContext();
    assert.equal(ctx.os_name, "macOS");
    assert.equal(ctx.device_type, "tablet");
    assert.equal(ctx.touch, true);
  });

  it("detects Android tablet (no Mobile in UA)", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      language: "en",
      maxTouchPoints: 5,
    });
    const ctx = captureContext();
    assert.equal(ctx.os_name, "Android");
    assert.equal(ctx.device_type, "tablet");
  });

  it("detects Android phone (Mobile in UA)", () => {
    setGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      language: "en",
      maxTouchPoints: 5,
    });
    const ctx = captureContext();
    assert.equal(ctx.os_name, "Android");
    assert.equal(ctx.device_type, "mobile");
  });

  it("returns empty object when globals are missing", () => {
    setGlobal("navigator", undefined);
    setGlobal("screen", undefined);
    setGlobal("window", undefined);
    setGlobal("document", undefined);
    setGlobal("location", undefined);

    const ctx = captureContext();
    assert.equal(ctx.browser, undefined);
    assert.equal(ctx.screen_width, undefined);
    assert.equal(ctx.viewport_width, undefined);
    assert.equal(ctx.url, undefined);
    assert.equal(ctx.device_type, undefined);
  });
});
