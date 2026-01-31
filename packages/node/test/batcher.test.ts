import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Batcher } from "@tell/core";

describe("Batcher", () => {
  it("flushes when size threshold reached", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 3,
      interval: 60_000, // won't fire during test
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.add(1);
    batcher.add(2);
    assert.equal(sent.length, 0);

    batcher.add(3); // triggers flush
    // flush is async, give it a tick
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [1, 2, 3]);

    await batcher.close();
  });

  it("flushes on manual flush()", async () => {
    const sent: string[][] = [];
    const batcher = new Batcher<string>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.add("a");
    batcher.add("b");
    await batcher.flush();

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], ["a", "b"]);

    await batcher.close();
  });

  it("does nothing on flush when empty", async () => {
    let callCount = 0;
    const batcher = new Batcher<string>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async () => {
        callCount++;
      },
    });

    await batcher.flush();
    assert.equal(callCount, 0);

    await batcher.close();
  });

  it("close() flushes remaining items and stops accepting", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.add(1);
    batcher.add(2);
    await batcher.close();

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [1, 2]);

    // Adding after close is silently ignored
    batcher.add(3);
    await batcher.flush();
    assert.equal(sent.length, 1);
  });

  it("reports pending count", async () => {
    const batcher = new Batcher<number>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async () => {},
    });

    assert.equal(batcher.pending, 0);
    batcher.add(1);
    assert.equal(batcher.pending, 1);
    batcher.add(2);
    assert.equal(batcher.pending, 2);

    await batcher.flush();
    assert.equal(batcher.pending, 0);

    await batcher.close();
  });

  it("flushes periodically via timer", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 100,
      interval: 50, // short interval for testing
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.add(1);
    assert.equal(sent.length, 0);

    // Wait for timer to fire
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [1]);

    await batcher.close();
  });

  // --- New tests: maxQueueSize ---

  it("drops oldest item when maxQueueSize is reached", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 100, // won't auto-flush
      interval: 60_000,
      maxQueueSize: 3,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.add(1);
    batcher.add(2);
    batcher.add(3);
    // Queue is now full [1, 2, 3]

    batcher.add(4); // should drop 1, queue becomes [2, 3, 4]
    batcher.add(5); // should drop 2, queue becomes [3, 4, 5]

    assert.equal(batcher.pending, 3);
    await batcher.flush();

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [3, 4, 5]);

    await batcher.close();
  });

  it("calls onOverflow when dropping items", async () => {
    let overflowCount = 0;
    const batcher = new Batcher<number>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 2,
      send: async () => {},
      onOverflow: () => {
        overflowCount++;
      },
    });

    batcher.add(1);
    batcher.add(2);
    assert.equal(overflowCount, 0);

    batcher.add(3); // triggers overflow
    assert.equal(overflowCount, 1);

    batcher.add(4); // triggers overflow again
    assert.equal(overflowCount, 2);

    await batcher.close();
  });

  // --- New tests: halveBatchSize ---

  it("halveBatchSize reduces size by half", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 8,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.halveBatchSize(); // 8 -> 4

    // Add 4 items — should auto-flush at 4
    for (let i = 1; i <= 4; i++) {
      batcher.add(i);
    }
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [1, 2, 3, 4]);

    await batcher.close();
  });

  it("halveBatchSize floors at 1", async () => {
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 2,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async (items) => {
        sent.push([...items]);
      },
    });

    batcher.halveBatchSize(); // 2 -> 1
    batcher.halveBatchSize(); // 1 -> 1 (min)

    // Add one item — should auto-flush immediately (size=1)
    batcher.add(42);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [42]);

    await batcher.close();
  });

  // --- New test: doFlush keeps items on send failure ---

  it("keeps items in queue when send fails", async () => {
    let callCount = 0;
    const sent: number[][] = [];
    const batcher = new Batcher<number>({
      size: 100,
      interval: 60_000,
      maxQueueSize: 1000,
      send: async (items) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("send failed");
        }
        sent.push([...items]);
      },
    });

    batcher.add(1);
    batcher.add(2);

    // First flush fails — items should stay in queue
    await batcher.flush();
    assert.equal(sent.length, 0);
    assert.equal(batcher.pending, 2);

    // Second flush succeeds
    await batcher.flush();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], [1, 2]);
    assert.equal(batcher.pending, 0);

    await batcher.close();
  });
});
