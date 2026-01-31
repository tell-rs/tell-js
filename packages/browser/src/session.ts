import { generateId } from "./id.js";

export type SessionReason = "session_start" | "session_timeout" | "app_foreground";

export interface SessionManagerConfig {
  timeout: number; // ms
  onNewSession: (reason: SessionReason, sessionId: string) => void;
}

export class SessionManager {
  private _sessionId: string;
  private lastHiddenAt = 0;
  private lastActivityAt: number;
  private readonly timeout: number;
  private readonly onNewSession: (reason: SessionReason, sessionId: string) => void;
  private readonly visibilityHandler: () => void;
  private readonly checkTimer: ReturnType<typeof setInterval>;
  private lastContextAt: Record<string, number> = {};

  constructor(config: SessionManagerConfig) {
    this.timeout = config.timeout;
    this.onNewSession = config.onNewSession;
    this._sessionId = generateId();
    this.lastActivityAt = Date.now();

    this.emitContext("session_start");

    this.visibilityHandler = () => this.handleVisibility();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    this.checkTimer = setInterval(() => this.checkTimeout(), 60_000);
    if (typeof (this.checkTimer as any).unref === "function") {
      (this.checkTimer as any).unref();
    }
  }

  get sessionId(): string {
    return this._sessionId;
  }

  set sessionId(id: string) {
    this._sessionId = id;
  }

  touch(): void {
    this.lastActivityAt = Date.now();
  }

  destroy(): void {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    clearInterval(this.checkTimer);
  }

  private handleVisibility(): void {
    if (document.visibilityState === "hidden") {
      this.lastHiddenAt = Date.now();
    } else if (document.visibilityState === "visible") {
      if (this.lastHiddenAt > 0 && Date.now() - this.lastHiddenAt > this.timeout) {
        this.rotateSession("session_timeout");
      } else if (this.lastHiddenAt > 0) {
        this.emitContext("app_foreground");
      }
      this.lastHiddenAt = 0;
    }
  }

  private checkTimeout(): void {
    if (Date.now() - this.lastActivityAt > this.timeout) {
      this.rotateSession("session_timeout");
    }
  }

  private rotateSession(reason: SessionReason): void {
    this._sessionId = generateId();
    this.lastActivityAt = Date.now();
    this.emitContext(reason);
  }

  private emitContext(reason: SessionReason): void {
    const now = Date.now();
    const last = this.lastContextAt[reason] ?? 0;
    if (now - last < 1000) return; // cooldown
    this.lastContextAt[reason] = now;
    this.onNewSession(reason, this._sessionId);
  }
}
