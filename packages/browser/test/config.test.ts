import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig, development, production, DEFAULTS } from "../src/config.js";

describe("resolveConfig", () => {
  it("returns defaults when no options given", () => {
    const config = resolveConfig(undefined);
    assert.equal(config.endpoint, "https://collect.tell.app");
    assert.equal(config.batchSize, 20);
    assert.equal(config.flushInterval, 5_000);
    assert.equal(config.maxRetries, 5);
    assert.equal(config.networkTimeout, 10_000);
    assert.equal(config.sessionTimeout, 1_800_000);
    assert.equal(config.persistence, "localStorage");
    assert.equal(config.botDetection, true);
    assert.equal(config.respectDoNotTrack, false);
    assert.equal(config.disabled, false);
  });

  it("overrides work", () => {
    const config = resolveConfig({ batchSize: 50, persistence: "memory" });
    assert.equal(config.batchSize, 50);
    assert.equal(config.persistence, "memory");
    assert.equal(config.endpoint, "https://collect.tell.app"); // default kept
  });
});

describe("presets", () => {
  it("development returns correct config", () => {
    const config = development();
    assert.equal(config.endpoint, "http://localhost:8080");
    assert.equal(config.batchSize, 5);
    assert.equal(config.flushInterval, 2_000);
    assert.equal(config.logLevel, "debug");
  });

  it("production returns correct config", () => {
    const config = production();
    assert.equal(config.logLevel, "error");
    assert.equal(config.endpoint, undefined); // uses defaults
  });

  it("presets allow overrides", () => {
    const config = development({ batchSize: 50 });
    assert.equal(config.batchSize, 50);
    assert.equal(config.endpoint, "http://localhost:8080"); // kept
  });
});
