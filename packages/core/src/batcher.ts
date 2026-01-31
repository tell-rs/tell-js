export interface BatcherConfig<T> {
  size: number;
  interval: number; // ms
  maxQueueSize: number;
  send: (items: T[]) => Promise<void>;
  onOverflow?: () => void;
}

export class Batcher<T> {
  private queue: T[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private flushing: Promise<void> | null = null;
  private config: BatcherConfig<T>;

  constructor(config: BatcherConfig<T>) {
    this.config = config;
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush().catch(() => {});
      }
    }, config.interval);
    // Don't keep Node.js process alive just for flush timer
    if (this.timer && typeof (this.timer as any).unref === "function") {
      (this.timer as any).unref();
    }
  }

  add(item: T): void {
    if (this.closed) return;

    if (this.queue.length >= this.config.maxQueueSize) {
      this.queue.shift(); // drop oldest
      if (this.config.onOverflow) {
        this.config.onOverflow();
      }
    }

    this.queue.push(item);

    if (this.queue.length >= this.config.size) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    // Prevent concurrent flushes
    if (this.flushing) {
      return this.flushing;
    }
    this.flushing = this.doFlush();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  get pending(): number {
    return this.queue.length;
  }

  drain(): T[] {
    const items = this.queue;
    this.queue = [];
    return items;
  }

  halveBatchSize(): void {
    this.config.size = Math.max(1, Math.floor(this.config.size / 2));
  }

  private async doFlush(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.slice(0, this.config.size);
      try {
        await this.config.send(batch);
        this.queue.splice(0, batch.length); // remove only on success
      } catch {
        return; // items stay in queue (e.g. 413 — batch size already halved)
      }
    }
  }
}
