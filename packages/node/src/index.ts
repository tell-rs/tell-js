import type { TellConfig } from "./config.js";
import type { JsonEvent, JsonLog, LogLevel, Properties, BeforeSendFn } from "@tell-rs/core";
import { resolveConfig } from "./config.js";
import { ClosedError, ValidationError, validateApiKey, validateEventName, validateLogMessage, validateUserId, Batcher, runBeforeSend } from "@tell-rs/core";
import { HttpTransport } from "./transport.js";

// Re-export core types and values
export { Events, type EventName } from "@tell-rs/core";
export type { Properties, LogLevel, JsonEvent, JsonLog, BeforeSendFn } from "@tell-rs/core";
export { redact, redactLog, SENSITIVE_PARAMS, type RedactOptions } from "@tell-rs/core";
export { TellError, ConfigurationError, ValidationError, NetworkError, ClosedError, SerializationError } from "@tell-rs/core";

// Re-export node-specific config
export type { TellConfig } from "./config.js";
export { development, production } from "./config.js";

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function uuid(): string {
  return crypto.randomUUID();
}

export class Tell {
  private readonly transport: HttpTransport;
  private readonly eventBatcher: Batcher<JsonEvent>;
  private readonly logBatcher: Batcher<JsonLog>;
  private readonly deviceId: string;
  private sessionId: string;
  private readonly onError?: (error: Error) => void;
  private readonly source: string;
  private readonly closeTimeout: number;
  private readonly sdkLogLevel: number;
  private readonly beforeSend?: BeforeSendFn<JsonEvent> | BeforeSendFn<JsonEvent>[];
  private readonly beforeSendLog?: BeforeSendFn<JsonLog> | BeforeSendFn<JsonLog>[];
  private superProperties: Properties = {};
  private closed = false;
  private _disabled: boolean;

  constructor(config: TellConfig) {
    validateApiKey(config.apiKey);

    const resolved = resolveConfig(config);
    this.onError = resolved.onError;
    this.source = resolved.source;
    this.closeTimeout = resolved.closeTimeout;
    this.sdkLogLevel = LOG_LEVELS[resolved.logLevel] ?? 2;
    this._disabled = resolved.disabled;
    this.beforeSend = resolved.beforeSend;
    this.beforeSendLog = resolved.beforeSendLog;
    this.deviceId = uuid();
    this.sessionId = uuid();

    this.transport = new HttpTransport({
      endpoint: resolved.endpoint,
      apiKey: resolved.apiKey,
      maxRetries: resolved.maxRetries,
      networkTimeout: resolved.networkTimeout,
      gzip: resolved.gzip,
      onError: this.onError,
      onPayloadTooLarge: () => {
        this.eventBatcher.halveBatchSize();
        this.logBatcher.halveBatchSize();
        this.sdkDebug("413 received, halved batch size");
      },
    });

    this.eventBatcher = new Batcher<JsonEvent>({
      size: resolved.batchSize,
      interval: resolved.flushInterval,
      maxQueueSize: resolved.maxQueueSize,
      send: (items) => this.transport.sendEvents(items),
      onOverflow: () => {
        this.sdkDebug("event queue overflow, dropping oldest item");
      },
    });

    this.logBatcher = new Batcher<JsonLog>({
      size: resolved.batchSize,
      interval: resolved.flushInterval,
      maxQueueSize: resolved.maxQueueSize,
      send: (items) => this.transport.sendLogs(items),
      onOverflow: () => {
        this.sdkDebug("log queue overflow, dropping oldest item");
      },
    });

    this.sdkDebug(`initialized (endpoint=${resolved.endpoint}, batch=${resolved.batchSize}, flush=${resolved.flushInterval}ms)`);
  }

  // --- Super Properties ---

  register(properties: Properties): void {
    Object.assign(this.superProperties, properties);
  }

  unregister(key: string): void {
    delete this.superProperties[key];
  }

  // --- Disabled ---

  disable(): void {
    this._disabled = true;
  }

  enable(): void {
    this._disabled = false;
  }

  // --- Events ---

  track(userId: string, eventName: string, properties?: Properties): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      validateUserId(userId);
      validateEventName(eventName);
    } catch (err) {
      this.reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "track",
      event: eventName,
      device_id: this.deviceId,
      session_id: this.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...this.superProperties,
      ...properties,
    };

    if (this.beforeSend) {
      event = runBeforeSend(event, this.beforeSend);
      if (event === null) return;
    }

    this.eventBatcher.add(event);
  }

  identify(userId: string, traits?: Properties): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      validateUserId(userId);
    } catch (err) {
      this.reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "identify",
      device_id: this.deviceId,
      session_id: this.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...traits,
    };

    if (this.beforeSend) {
      event = runBeforeSend(event, this.beforeSend);
      if (event === null) return;
    }

    this.eventBatcher.add(event);
  }

  group(userId: string, groupId: string, properties?: Properties): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      validateUserId(userId);
      if (!groupId) throw new ValidationError("groupId", "is required");
    } catch (err) {
      this.reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "group",
      device_id: this.deviceId,
      session_id: this.sessionId,
      user_id: userId,
      group_id: groupId,
      timestamp: Date.now(),
      ...this.superProperties,
      ...properties,
    };

    if (this.beforeSend) {
      event = runBeforeSend(event, this.beforeSend);
      if (event === null) return;
    }

    this.eventBatcher.add(event);
  }

  revenue(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    properties?: Properties
  ): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      validateUserId(userId);
      if (amount <= 0) throw new ValidationError("amount", "must be positive");
      if (!currency) throw new ValidationError("currency", "is required");
      if (!orderId) throw new ValidationError("orderId", "is required");
    } catch (err) {
      this.reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "track",
      event: "Order Completed",
      device_id: this.deviceId,
      session_id: this.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      ...this.superProperties,
      ...properties,
      order_id: orderId,
      amount,
      currency,
    };

    if (this.beforeSend) {
      event = runBeforeSend(event, this.beforeSend);
      if (event === null) return;
    }

    this.eventBatcher.add(event);
  }

  alias(previousId: string, userId: string): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      if (!previousId) throw new ValidationError("previousId", "is required");
      validateUserId(userId);
    } catch (err) {
      this.reportError(err);
      return;
    }

    let event: JsonEvent | null = {
      type: "alias",
      device_id: this.deviceId,
      session_id: this.sessionId,
      user_id: userId,
      timestamp: Date.now(),
      previous_id: previousId,
    };

    if (this.beforeSend) {
      event = runBeforeSend(event, this.beforeSend);
      if (event === null) return;
    }

    this.eventBatcher.add(event);
  }

  resetSession(): void {
    this.sessionId = uuid();
  }

  // --- Logging ---

  log(level: LogLevel, message: string, service?: string, data?: Properties): void {
    if (this._disabled) return;
    if (this.closed) { this.reportError(new ClosedError()); return; }
    try {
      validateLogMessage(message);
    } catch (err) {
      this.reportError(err);
      return;
    }

    let logEntry: JsonLog | null = {
      level,
      message,
      source: this.source,
      service: service ?? "app",
      session_id: this.sessionId,
      timestamp: Date.now(),
      data,
    };

    if (this.beforeSendLog) {
      logEntry = runBeforeSend(logEntry, this.beforeSendLog);
      if (logEntry === null) return;
    }

    this.logBatcher.add(logEntry);
  }

  logEmergency(message: string, service?: string, data?: Properties): void {
    this.log("emergency", message, service, data);
  }
  logAlert(message: string, service?: string, data?: Properties): void {
    this.log("alert", message, service, data);
  }
  logCritical(message: string, service?: string, data?: Properties): void {
    this.log("critical", message, service, data);
  }
  logError(message: string, service?: string, data?: Properties): void {
    this.log("error", message, service, data);
  }
  logWarning(message: string, service?: string, data?: Properties): void {
    this.log("warning", message, service, data);
  }
  logNotice(message: string, service?: string, data?: Properties): void {
    this.log("notice", message, service, data);
  }
  logInfo(message: string, service?: string, data?: Properties): void {
    this.log("info", message, service, data);
  }
  logDebug(message: string, service?: string, data?: Properties): void {
    this.log("debug", message, service, data);
  }
  logTrace(message: string, service?: string, data?: Properties): void {
    this.log("trace", message, service, data);
  }

  // --- Lifecycle ---

  async flush(): Promise<void> {
    await Promise.all([this.eventBatcher.flush(), this.logBatcher.flush()]);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.sdkDebug("closing...");
    const work = Promise.all([this.eventBatcher.close(), this.logBatcher.close()]);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("close timed out")), this.closeTimeout)
    );
    try {
      await Promise.race([work, timeout]);
    } catch (err) {
      this.reportError(err);
    }
  }

  // --- Internal ---

  private reportError(err: unknown): void {
    if (this.onError && err instanceof Error) {
      this.onError(err);
    }
  }

  private sdkDebug(msg: string): void {
    if (this.sdkLogLevel >= LOG_LEVELS.debug) {
      console.debug(`[Tell] ${msg}`);
    }
  }
}
