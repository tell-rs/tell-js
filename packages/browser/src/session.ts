import { generateId } from "./id.js";
import type { TellStorage } from "./persistence.js";

export type SessionReason = "session_start" | "session_timeout";

export interface SessionManagerConfig {
  timeout: number; // idle timeout in ms (default 30 min)
  maxLength: number; // max session length in ms (default 24 hours)
  storage: TellStorage;
  onNewSession: (reason: SessionReason, sessionId: string) => void;
}

const SESSION_ID_KEY = "tell_session_id";
const SESSION_TS_KEY = "tell_session_ts";
const SESSION_START_KEY = "tell_session_start";
const PERSIST_INTERVAL = 60_000;

export class SessionManager {
  private _sessionId: string;
  private lastHiddenAt = 0;
  private lastActivityAt: number;
  private sessionStartedAt: number;
  private lastPersistedAt = 0;
  private readonly timeout: number;
  private readonly maxLength: number;
  private readonly storage: TellStorage;
  private readonly onNewSession: (reason: SessionReason, sessionId: string) => void;
  private readonly visibilityHandler: () => void;

  constructor(config: SessionManagerConfig) {
    this.timeout = config.timeout;
    this.maxLength = config.maxLength;
    this.storage = config.storage;
    this.onNewSession = config.onNewSession;

    const now = Date.now();
    const storedId = this.storage.get(SESSION_ID_KEY);
    const storedTs = Number(this.storage.get(SESSION_TS_KEY) || 0);
    const storedStart = Number(this.storage.get(SESSION_START_KEY) || 0);

    if (
      storedId &&
      storedTs > 0 &&
      storedStart > 0 &&
      now - storedTs < this.timeout &&
      now - storedStart < this.maxLength
    ) {
      this._sessionId = storedId;
      this.lastActivityAt = storedTs;
      this.sessionStartedAt = storedStart;
    } else {
      this._sessionId = generateId();
      this.lastActivityAt = now;
      this.sessionStartedAt = now;
      this.persist();
      this.onNewSession("session_start", this._sessionId);
    }

    this.visibilityHandler = () => this.handleVisibility();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  get sessionId(): string {
    return this._sessionId;
  }

  set sessionId(id: string) {
    this._sessionId = id;
    const now = Date.now();
    this.lastActivityAt = now;
    this.sessionStartedAt = now;
    this.persist();
  }

  /** Update activity timestamp; rotates session if idle longer than timeout or exceeds max length. */
  touch(): void {
    const now = Date.now();
    if (
      now - this.lastActivityAt > this.timeout ||
      now - this.sessionStartedAt > this.maxLength
    ) {
      this.rotateSession("session_timeout");
    }
    this.lastActivityAt = now;
    if (now - this.lastPersistedAt >= PERSIST_INTERVAL) {
      this.persistActivity();
    }
  }

  destroy(): void {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  private handleVisibility(): void {
    if (document.visibilityState === "hidden") {
      this.lastHiddenAt = Date.now();
    } else if (document.visibilityState === "visible") {
      const now = Date.now();
      if (
        this.lastHiddenAt > 0 &&
        (now - this.lastHiddenAt > this.timeout ||
          now - this.sessionStartedAt > this.maxLength)
      ) {
        this.rotateSession("session_timeout");
      }
      this.lastHiddenAt = 0;
    }
  }

  private rotateSession(reason: SessionReason): void {
    this._sessionId = generateId();
    const now = Date.now();
    this.lastActivityAt = now;
    this.sessionStartedAt = now;
    this.persist();
    this.onNewSession(reason, this._sessionId);
  }

  private persist(): void {
    this.storage.set(SESSION_ID_KEY, this._sessionId);
    this.storage.set(SESSION_TS_KEY, String(this.lastActivityAt));
    this.storage.set(SESSION_START_KEY, String(this.sessionStartedAt));
    this.lastPersistedAt = Date.now();
  }

  private persistActivity(): void {
    this.storage.set(SESSION_TS_KEY, String(this.lastActivityAt));
    this.lastPersistedAt = Date.now();
  }
}
