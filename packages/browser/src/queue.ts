import type { LogLevel, Properties } from "@tell-rs/core";

export type QueuedCall =
  | { method: "track"; args: [string, Properties?] }
  | { method: "identify"; args: [string, Properties?] }
  | { method: "group"; args: [string, Properties?] }
  | { method: "revenue"; args: [number, string, string, Properties?] }
  | { method: "alias"; args: [string, string] }
  | { method: "log"; args: [LogLevel, string, string?, Properties?] }
  | { method: "register"; args: [Properties] }
  | { method: "unregister"; args: [string] }
  | { method: "optOut"; args: [] }
  | { method: "optIn"; args: [] };

export class PreInitQueue {
  private items: QueuedCall[] = [];
  readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  push(call: QueuedCall): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift(); // drop oldest
    }
    this.items.push(call);
  }

  replay(target: Record<string, (...args: any[]) => any>): void {
    const calls = this.items;
    this.items = [];
    for (const call of calls) {
      try {
        target[call.method](...call.args);
      } catch {
        // continue on per-call error
      }
    }
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}
