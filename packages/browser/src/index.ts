import type {
  JsonEvent,
  JsonLog,
  LogLevel,
  Properties,
  BeforeSendFn,
} from "@tell-rs/core";
import {
  ClosedError,
  ConfigurationError,
  ValidationError,
  validateApiKey,
  validateEventName,
  validateLogMessage,
  validateUserId,
  Batcher,
  runBeforeSend,
} from "@tell-rs/core";

import type { TellBrowserConfig, ResolvedBrowserConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import type { TellStorage } from "./persistence.js";
import { createStorage, STORAGE_KEYS } from "./persistence.js";
import { generateId } from "./id.js";
import { isBot } from "./bot.js";
import { captureContext } from "./context.js";
import { captureUtm } from "./utm.js";
import type { SessionReason } from "./session.js";
import { SessionManager } from "./session.js";
import { BrowserTransport } from "./transport.js";
import { PreInitQueue } from "./queue.js";

// Re-export core types and values
export { Events, type EventName } from "@tell-rs/core";
export type { Properties, LogLevel, JsonEvent, JsonLog, BeforeSendFn } from "@tell-rs/core";
export { redact, redactLog, SENSITIVE_PARAMS, type RedactOptions } from "@tell-rs/core";
export {
  TellError,
  ConfigurationError,
  ValidationError,
  NetworkError,
  ClosedError,
  SerializationError,
} from "@tell-rs/core";

// Re-export browser-specific config
export type { TellBrowserConfig } from "./config.js";
export { development, production } from "./config.js";
export type { DeviceContext } from "./context.js";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let configured = false;
let closed = false;
let _disabled = false;
let _optedOut = false;

let storage: TellStorage;
let transport: BrowserTransport;
let eventBatcher: Batcher<JsonEvent>;
let logBatcher: Batcher<JsonLog>;
let sessionManager: SessionManager;
let resolvedConfig: ResolvedBrowserConfig;

let _apiKey: string;
let deviceId: string;
let userId: string | undefined;
let superProperties: Properties = {};
let beforeSend: BeforeSendFn<JsonEvent> | BeforeSendFn<JsonEvent>[] | undefined;
let beforeSendLog:
  | BeforeSendFn<JsonLog>
  | BeforeSendFn<JsonLog>[]
  | undefined;
let sdkLogLevel: number;

const queue = new PreInitQueue(1000);

let unloadHandler: (() => void) | null = null;
let visibilityUnloadHandler: (() => void) | null = null;
let errorHandler: ((event: ErrorEvent) => void) | null = null;
let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function reportError(err: unknown): void {
  if (resolvedConfig?.onError && err instanceof Error) {
    resolvedConfig.onError(err);
  }
}

function sdkDebug(msg: string): void {
  if (sdkLogLevel >= LOG_LEVELS.debug) {
    console.debug(`[Tell] ${msg}`);
  }
}

function handleUnload(): void {
  const events = eventBatcher.drain();
  const logs = logBatcher.drain();
  transport.beacon(events, logs);
}

function handleVisibilityUnload(): void {
  if (document.visibilityState === "hidden") {
    handleUnload();
  }
}

function onNewSession(reason: SessionReason, sessionId: string): void {
  if (_disabled || _optedOut || closed) return;
  const ctx = captureContext();
  const event: JsonEvent = {
    type: "context",
    device_id: deviceId,
    session_id: sessionId,
    user_id: userId,
    timestamp: Date.now(),
    reason,
    ...ctx,
  };
  eventBatcher.add(event);
}

function persistSuperProps(): void {
  storage.set(STORAGE_KEYS.SUPER_PROPS, JSON.stringify(superProperties));
}

function loadSuperProps(): Properties {
  const raw = storage.get(STORAGE_KEYS.SUPER_PROPS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Properties;
  } catch {
    storage.remove(STORAGE_KEYS.SUPER_PROPS);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TellInstance {
  configure(apiKey: string, options?: TellBrowserConfig): void;
  track(eventName: string, properties?: Properties): void;
  identify(userId: string, traits?: Properties): void;
  group(groupId: string, properties?: Properties): void;
  revenue(
    amount: number,
    currency: string,
    orderId: string,
    properties?: Properties
  ): void;
  alias(previousId: string, userId: string): void;
  log(
    level: LogLevel,
    message: string,
    service?: string,
    data?: Properties
  ): void;
  logEmergency(message: string, service?: string, data?: Properties): void;
  logAlert(message: string, service?: string, data?: Properties): void;
  logCritical(message: string, service?: string, data?: Properties): void;
  logError(message: string, service?: string, data?: Properties): void;
  logWarning(message: string, service?: string, data?: Properties): void;
  logNotice(message: string, service?: string, data?: Properties): void;
  logInfo(message: string, service?: string, data?: Properties): void;
  logDebug(message: string, service?: string, data?: Properties): void;
  logTrace(message: string, service?: string, data?: Properties): void;
  register(properties: Properties): void;
  unregister(key: string): void;
  optOut(): void;
  optIn(): void;
  isOptedOut(): boolean;
  flush(): Promise<void>;
  close(): Promise<void>;
  reset(): void;
  enable(): void;
  disable(): void;
  /** @internal Reset all module state. Only for testing. */
  _resetForTesting(): void;
}

const tell: TellInstance = {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  configure(apiKey: string, options?: TellBrowserConfig): void {
    if (configured) {
      reportError(new ConfigurationError("Tell is already configured"));
      return;
    }

    validateApiKey(apiKey);
    _apiKey = apiKey;
    resolvedConfig = resolveConfig(options);
    sdkLogLevel = LOG_LEVELS[resolvedConfig.logLevel] ?? 0;
    beforeSend = resolvedConfig.beforeSend;
    beforeSendLog = resolvedConfig.beforeSendLog;
    _disabled = resolvedConfig.disabled;

    // Persistence
    storage = createStorage(resolvedConfig.persistence);
    deviceId = storage.get(STORAGE_KEYS.DEVICE_ID) ?? generateId();
    storage.set(STORAGE_KEYS.DEVICE_ID, deviceId);
    userId = storage.get(STORAGE_KEYS.USER_ID) ?? undefined;
    _optedOut = storage.get(STORAGE_KEYS.OPT_OUT) === "1";
    superProperties = loadSuperProps();

    // UTM parameters — capture from URL and merge into super properties
    const utm = captureUtm();
    if (Object.keys(utm).length > 0) {
      Object.assign(superProperties, utm);
      persistSuperProps();
    }

    // Bot detection
    if (resolvedConfig.botDetection && isBot()) {
      _disabled = true;
      sdkDebug("bot detected, disabling");
    }

    // Do Not Track
    if (
      resolvedConfig.respectDoNotTrack &&
      typeof navigator !== "undefined" &&
      navigator.doNotTrack === "1"
    ) {
      _disabled = true;
      sdkDebug("Do Not Track enabled, disabling");
    }

    // Transport
    transport = new BrowserTransport({
      endpoint: resolvedConfig.endpoint,
      apiKey: _apiKey,
      maxRetries: resolvedConfig.maxRetries,
      networkTimeout: resolvedConfig.networkTimeout,
      onError: resolvedConfig.onError,
      onPayloadTooLarge: () => {
        eventBatcher.halveBatchSize();
        logBatcher.halveBatchSize();
        sdkDebug("413 received, halved batch size");
      },
    });

    // Batchers
    eventBatcher = new Batcher<JsonEvent>({
      size: resolvedConfig.batchSize,
      interval: resolvedConfig.flushInterval,
      maxQueueSize: resolvedConfig.maxQueueSize,
      send: (items) => transport.sendEvents(items),
      onOverflow: () => sdkDebug("event queue overflow, dropping oldest"),
    });

    logBatcher = new Batcher<JsonLog>({
      size: resolvedConfig.batchSize,
      interval: resolvedConfig.flushInterval,
      maxQueueSize: resolvedConfig.maxQueueSize,
      send: (items) => transport.sendLogs(items),
      onOverflow: () => sdkDebug("log queue overflow, dropping oldest"),
    });

    // Session management
    sessionManager = new SessionManager({
      timeout: resolvedConfig.sessionTimeout,
      onNewSession,
    });

    // Unload handlers
    if (typeof window !== "undefined") {
      unloadHandler = handleUnload;
      window.addEventListener("beforeunload", unloadHandler);
    }
    if (typeof document !== "undefined") {
      visibilityUnloadHandler = handleVisibilityUnload;
      document.addEventListener("visibilitychange", visibilityUnloadHandler);
    }

    // Error auto-capture
    if (resolvedConfig.captureErrors && typeof window !== "undefined") {
      errorHandler = (event: ErrorEvent) => {
        if (_disabled || _optedOut || closed) return;
        const msg = event.message || "Unknown error";
        const data: Properties = {};
        if (event.filename) data.filename = event.filename;
        if (event.lineno) data.lineno = event.lineno;
        if (event.colno) data.colno = event.colno;
        if (event.error?.stack) data.stack = event.error.stack;
        tell.logError(msg, "browser", data);
      };
      rejectionHandler = (event: PromiseRejectionEvent) => {
        if (_disabled || _optedOut || closed) return;
        const reason = event.reason;
        const msg =
          reason instanceof Error
            ? reason.message
            : String(reason ?? "Unhandled promise rejection");
        const data: Properties = {};
        if (reason instanceof Error && reason.stack) data.stack = reason.stack;
        tell.logError(msg, "browser", data);
      };
      window.addEventListener("error", errorHandler);
      window.addEventListener("unhandledrejection", rejectionHandler);
    }

    configured = true;
    closed = false;

    sdkDebug(
      `configured (endpoint=${resolvedConfig.endpoint}, batch=${resolvedConfig.batchSize})`
    );

    // Replay pre-init queue
    queue.replay(tell as unknown as Record<string, (...args: any[]) => any>);
  },

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  track(eventName: string, properties?: Properties): void {
    if (!configured) {
      queue.push({ method: "track", args: [eventName, properties] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      validateEventName(eventName);
    } catch (err) {
      reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "track",
      event: eventName,
      device_id: deviceId,
      session_id: sessionManager.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...superProperties,
      ...properties,
    };

    if (beforeSend) {
      event = runBeforeSend(event, beforeSend);
      if (event === null) return;
    }

    sessionManager.touch();
    eventBatcher.add(event);
  },

  identify(newUserId: string, traits?: Properties): void {
    if (!configured) {
      queue.push({ method: "identify", args: [newUserId, traits] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      validateUserId(newUserId);
    } catch (err) {
      reportError(err);
      return;
    }

    userId = newUserId;
    storage.set(STORAGE_KEYS.USER_ID, userId);

    let event: JsonEvent | null = {
      type: "identify",
      device_id: deviceId,
      session_id: sessionManager.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...traits,
    };

    if (beforeSend) {
      event = runBeforeSend(event, beforeSend);
      if (event === null) return;
    }

    sessionManager.touch();
    eventBatcher.add(event);
  },

  group(groupId: string, properties?: Properties): void {
    if (!configured) {
      queue.push({ method: "group", args: [groupId, properties] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      if (!groupId) throw new ValidationError("groupId", "is required");
    } catch (err) {
      reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "group",
      device_id: deviceId,
      session_id: sessionManager.sessionId,
      user_id: userId,
      group_id: groupId,
      timestamp: Date.now(),
      ...superProperties,
      ...properties,
    };

    if (beforeSend) {
      event = runBeforeSend(event, beforeSend);
      if (event === null) return;
    }

    sessionManager.touch();
    eventBatcher.add(event);
  },

  revenue(
    amount: number,
    currency: string,
    orderId: string,
    properties?: Properties
  ): void {
    if (!configured) {
      queue.push({ method: "revenue", args: [amount, currency, orderId, properties] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      if (amount <= 0) throw new ValidationError("amount", "must be positive");
      if (!currency) throw new ValidationError("currency", "is required");
      if (!orderId) throw new ValidationError("orderId", "is required");
    } catch (err) {
      reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "track",
      event: "Order Completed",
      device_id: deviceId,
      session_id: sessionManager.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...superProperties,
      ...properties,
      order_id: orderId,
      amount,
      currency,
    };

    if (beforeSend) {
      event = runBeforeSend(event, beforeSend);
      if (event === null) return;
    }

    sessionManager.touch();
    eventBatcher.add(event);
  },

  alias(previousId: string, newUserId: string): void {
    if (!configured) {
      queue.push({ method: "alias", args: [previousId, newUserId] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      if (!previousId)
        throw new ValidationError("previousId", "is required");
      validateUserId(newUserId);
    } catch (err) {
      reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "alias",
      device_id: deviceId,
      session_id: sessionManager.sessionId,
      user_id: newUserId,
      timestamp: Date.now(),
      previous_id: previousId,
    };

    if (beforeSend) {
      event = runBeforeSend(event, beforeSend);
      if (event === null) return;
    }

    sessionManager.touch();
    eventBatcher.add(event);
  },

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------

  log(
    level: LogLevel,
    message: string,
    service?: string,
    data?: Properties
  ): void {
    if (!configured) {
      queue.push({ method: "log", args: [level, message, service, data] });
      return;
    }
    if (_disabled || _optedOut) return;
    if (closed) {
      reportError(new ClosedError());
      return;
    }
    try {
      validateLogMessage(message);
    } catch (err) {
      reportError(err);
      return;
    }

    let logEntry: JsonLog | null = {
      level,
      message,
      source: resolvedConfig.source,
      service: service ?? "app",
      session_id: sessionManager.sessionId,
      timestamp: Date.now(),
      data,
    };

    if (beforeSendLog) {
      logEntry = runBeforeSend(logEntry, beforeSendLog);
      if (logEntry === null) return;
    }

    logBatcher.add(logEntry);
  },

  logEmergency(message: string, service?: string, data?: Properties): void {
    tell.log("emergency", message, service, data);
  },
  logAlert(message: string, service?: string, data?: Properties): void {
    tell.log("alert", message, service, data);
  },
  logCritical(message: string, service?: string, data?: Properties): void {
    tell.log("critical", message, service, data);
  },
  logError(message: string, service?: string, data?: Properties): void {
    tell.log("error", message, service, data);
  },
  logWarning(message: string, service?: string, data?: Properties): void {
    tell.log("warning", message, service, data);
  },
  logNotice(message: string, service?: string, data?: Properties): void {
    tell.log("notice", message, service, data);
  },
  logInfo(message: string, service?: string, data?: Properties): void {
    tell.log("info", message, service, data);
  },
  logDebug(message: string, service?: string, data?: Properties): void {
    tell.log("debug", message, service, data);
  },
  logTrace(message: string, service?: string, data?: Properties): void {
    tell.log("trace", message, service, data);
  },

  // -----------------------------------------------------------------------
  // Super Properties
  // -----------------------------------------------------------------------

  register(properties: Properties): void {
    if (!configured) {
      queue.push({ method: "register", args: [properties] });
      return;
    }
    Object.assign(superProperties, properties);
    persistSuperProps();
  },

  unregister(key: string): void {
    if (!configured) {
      queue.push({ method: "unregister", args: [key] });
      return;
    }
    delete superProperties[key];
    persistSuperProps();
  },

  // -----------------------------------------------------------------------
  // Privacy
  // -----------------------------------------------------------------------

  optOut(): void {
    if (!configured) {
      queue.push({ method: "optOut", args: [] });
      return;
    }
    _optedOut = true;
    storage.set(STORAGE_KEYS.OPT_OUT, "1");
  },

  optIn(): void {
    if (!configured) {
      queue.push({ method: "optIn", args: [] });
      return;
    }
    _optedOut = false;
    storage.remove(STORAGE_KEYS.OPT_OUT);
  },

  isOptedOut(): boolean {
    return _optedOut;
  },

  // -----------------------------------------------------------------------
  // Control
  // -----------------------------------------------------------------------

  enable(): void {
    _disabled = false;
  },

  disable(): void {
    _disabled = true;
  },

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async flush(): Promise<void> {
    if (!configured) return;
    await Promise.all([eventBatcher.flush(), logBatcher.flush()]);
  },

  async close(): Promise<void> {
    if (!configured || closed) return;
    closed = true;

    if (sessionManager) sessionManager.destroy();

    if (typeof window !== "undefined" && unloadHandler) {
      window.removeEventListener("beforeunload", unloadHandler);
      unloadHandler = null;
    }
    if (typeof document !== "undefined" && visibilityUnloadHandler) {
      document.removeEventListener("visibilitychange", visibilityUnloadHandler);
      visibilityUnloadHandler = null;
    }
    if (typeof window !== "undefined") {
      if (errorHandler) {
        window.removeEventListener("error", errorHandler);
        errorHandler = null;
      }
      if (rejectionHandler) {
        window.removeEventListener("unhandledrejection", rejectionHandler);
        rejectionHandler = null;
      }
    }

    const work = Promise.all([eventBatcher.close(), logBatcher.close()]);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("close timed out")),
        resolvedConfig.closeTimeout
      )
    );

    try {
      await Promise.race([work, timeout]);
    } catch (err) {
      reportError(err);
    }

    configured = false;
  },

  reset(): void {
    if (!configured) return;
    userId = undefined;
    deviceId = generateId();
    superProperties = {};

    storage.remove(STORAGE_KEYS.USER_ID);
    storage.set(STORAGE_KEYS.DEVICE_ID, deviceId);
    storage.remove(STORAGE_KEYS.SUPER_PROPS);

    if (sessionManager) {
      sessionManager.sessionId = generateId();
    }
  },

  // -----------------------------------------------------------------------
  // Testing helper
  // -----------------------------------------------------------------------

  _resetForTesting(): void {
    if (configured && !closed) {
      // Synchronously tear down timers
      if (sessionManager) sessionManager.destroy();
      if (eventBatcher) {
        eventBatcher.drain();
        eventBatcher.close().catch(() => {});
      }
      if (logBatcher) {
        logBatcher.drain();
        logBatcher.close().catch(() => {});
      }
      if (typeof window !== "undefined" && unloadHandler) {
        window.removeEventListener("beforeunload", unloadHandler);
      }
      if (typeof document !== "undefined" && visibilityUnloadHandler) {
        document.removeEventListener(
          "visibilitychange",
          visibilityUnloadHandler
        );
      }
      if (typeof window !== "undefined") {
        if (errorHandler) window.removeEventListener("error", errorHandler);
        if (rejectionHandler)
          window.removeEventListener("unhandledrejection", rejectionHandler);
      }
    }

    configured = false;
    closed = false;
    _disabled = false;
    _optedOut = false;
    userId = undefined;
    deviceId = "";
    superProperties = {};
    beforeSend = undefined;
    beforeSendLog = undefined;
    sdkLogLevel = 0;
    unloadHandler = null;
    visibilityUnloadHandler = null;
    errorHandler = null;
    rejectionHandler = null;
    queue.clear();
  },
};

export default tell;
export { tell };
