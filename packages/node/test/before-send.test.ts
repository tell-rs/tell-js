import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runBeforeSend } from "@tell-rs/core";
import type { BeforeSendFn } from "@tell-rs/core";

describe("runBeforeSend", () => {
  it("passes item through a single function", () => {
    const fn: BeforeSendFn<{ name: string }> = (item) => ({
      ...item,
      name: item.name.toUpperCase(),
    });

    const result = runBeforeSend({ name: "hello" }, fn);
    assert.deepEqual(result, { name: "HELLO" });
  });

  it("returns null when single function drops", () => {
    const fn: BeforeSendFn<{ name: string }> = () => null;

    const result = runBeforeSend({ name: "hello" }, fn);
    assert.equal(result, null);
  });

  it("runs array pipeline in order", () => {
    const fns: BeforeSendFn<{ value: number }>[] = [
      (item) => ({ ...item, value: item.value + 1 }),
      (item) => ({ ...item, value: item.value * 10 }),
    ];

    const result = runBeforeSend({ value: 5 }, fns);
    assert.deepEqual(result, { value: 60 }); // (5+1)*10
  });

  it("short-circuits on null in pipeline", () => {
    let thirdCalled = false;
    const fns: BeforeSendFn<{ value: number }>[] = [
      (item) => ({ ...item, value: item.value + 1 }),
      () => null,
      (item) => {
        thirdCalled = true;
        return item;
      },
    ];

    const result = runBeforeSend({ value: 5 }, fns);
    assert.equal(result, null);
    assert.equal(thirdCalled, false);
  });

  it("handles empty array pipeline", () => {
    const result = runBeforeSend({ name: "hello" }, []);
    assert.deepEqual(result, { name: "hello" });
  });
});
