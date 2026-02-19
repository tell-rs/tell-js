import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateId } from "../src/id.js";

const HEX_32 = /^[0-9a-f]{32}$/;

describe("generateId", () => {
  it("returns a 32-char hex string", () => {
    const id = generateId();
    assert.match(id, HEX_32);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    assert.equal(ids.size, 100);
  });
});
