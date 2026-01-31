import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PreInitQueue } from "../src/queue.js";

describe("PreInitQueue", () => {
  it("buffers calls", () => {
    const q = new PreInitQueue();
    q.push({ method: "track", args: ["Click"] });
    q.push({ method: "identify", args: ["u_1"] });
    assert.equal(q.length, 2);
  });

  it("drops oldest when exceeding maxSize", () => {
    const q = new PreInitQueue(3);
    q.push({ method: "track", args: ["A"] });
    q.push({ method: "track", args: ["B"] });
    q.push({ method: "track", args: ["C"] });
    q.push({ method: "track", args: ["D"] }); // drops A

    assert.equal(q.length, 3);

    const calls: string[] = [];
    q.replay({
      track: (name: string) => calls.push(name),
    });
    assert.deepEqual(calls, ["B", "C", "D"]);
  });

  it("replay calls methods in order on target", () => {
    const q = new PreInitQueue();
    q.push({ method: "track", args: ["Click"] });
    q.push({ method: "identify", args: ["u_1"] });

    const log: string[] = [];
    q.replay({
      track: (name: string) => log.push(`track:${name}`),
      identify: (id: string) => log.push(`identify:${id}`),
    });

    assert.deepEqual(log, ["track:Click", "identify:u_1"]);
    assert.equal(q.length, 0); // cleared after replay
  });

  it("replay catches per-call errors and continues", () => {
    const q = new PreInitQueue();
    q.push({ method: "track", args: ["A"] });
    q.push({ method: "track", args: ["B"] });

    let callCount = 0;
    q.replay({
      track: () => {
        callCount++;
        if (callCount === 1) throw new Error("fail");
      },
    });

    assert.equal(callCount, 2);
  });

  it("clear empties the queue", () => {
    const q = new PreInitQueue();
    q.push({ method: "track", args: ["A"] });
    q.push({ method: "track", args: ["B"] });
    q.clear();
    assert.equal(q.length, 0);
  });
});
