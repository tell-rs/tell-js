import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateApiKey,
  validateEventName,
  validateLogMessage,
  validateUserId,
  ConfigurationError,
  ValidationError,
} from "@tell-rs/core";

describe("validateApiKey", () => {
  it("accepts valid 32-char hex key", () => {
    assert.doesNotThrow(() => validateApiKey("a1b2c3d4e5f60718293a4b5c6d7e8f90"));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateApiKey(""), ConfigurationError);
  });

  it("rejects short hex", () => {
    assert.throws(() => validateApiKey("abcdef"), ConfigurationError);
  });

  it("rejects non-hex characters", () => {
    assert.throws(() => validateApiKey("g1b2c3d4e5f60718293a4b5c6d7e8f90"), ConfigurationError);
  });

  it("rejects 33-char hex", () => {
    assert.throws(() => validateApiKey("a1b2c3d4e5f60718293a4b5c6d7e8f900"), ConfigurationError);
  });
});

describe("validateEventName", () => {
  it("accepts non-empty string", () => {
    assert.doesNotThrow(() => validateEventName("Page Viewed"));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateEventName(""), ValidationError);
  });

  it("rejects non-string", () => {
    assert.throws(() => validateEventName(123), ValidationError);
  });

  it("rejects null", () => {
    assert.throws(() => validateEventName(null), ValidationError);
  });

  it("rejects event name longer than 256 chars", () => {
    const long = "x".repeat(257);
    assert.throws(() => validateEventName(long), ValidationError);
  });

  it("accepts event name of exactly 256 chars", () => {
    const exact = "x".repeat(256);
    assert.doesNotThrow(() => validateEventName(exact));
  });
});

describe("validateLogMessage", () => {
  it("accepts non-empty string", () => {
    assert.doesNotThrow(() => validateLogMessage("connection refused"));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateLogMessage(""), ValidationError);
  });

  it("rejects non-string", () => {
    assert.throws(() => validateLogMessage(undefined), ValidationError);
  });

  it("rejects log message longer than 65536 chars", () => {
    const long = "x".repeat(65_537);
    assert.throws(() => validateLogMessage(long), ValidationError);
  });

  it("accepts log message of exactly 65536 chars", () => {
    const exact = "x".repeat(65_536);
    assert.doesNotThrow(() => validateLogMessage(exact));
  });
});

describe("validateUserId", () => {
  it("accepts non-empty string", () => {
    assert.doesNotThrow(() => validateUserId("user_123"));
  });

  it("rejects empty string", () => {
    assert.throws(() => validateUserId(""), ValidationError);
  });

  it("rejects non-string", () => {
    assert.throws(() => validateUserId(42), ValidationError);
  });
});
