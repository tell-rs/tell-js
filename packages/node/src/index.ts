import type { TellOptions } from "./config.js";
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
export type { TellOptions } from "./config.js";
export { development, production } from "./config.js";

export interface TellServiceScope {
  track(userId: string, eventName: string, properties?: Properties): void;
  identify(userId: string, traits?: Properties): void;
  group(userId: string, groupId: string, properties?: Properties): void;
  revenue(userId: string, amount: number, currency: string, orderId: string, properties?: Properties): void;
  alias(previousId: string, userId: string): void;
  log(level: LogLevel, message: string, data?: Properties): void;
  logEmergency(message: string, data?: Properties): void;
  logAlert(message: string, data?: Properties): void;
  logCritical(message: string, data?: Properties): void;
  logError(message: string, data?: Properties): void;
  logWarning(message: string, data?: Properties): void;
  logNotice(message: string, data?: Properties): void;
  logInfo(message: string, data?: Properties): void;
  logDebug(message: string, data?: Properties): void;
  logTrace(message: string, data?: Properties): void;
  withService(service: string): TellServiceScope;
}

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export class Tell {
  private readonly transport: HttpTransport;
  private readonly eventBatcher: Batcher<JsonEvent>;
  private readonly logBatcher: Batcher<JsonLog>;
  private readonly deviceId: string;
  private sessionId: string;
  private readonly onError?: (error: Error) => void;
  private readonly source: string;
  private readonly service: string | undefined;
  private readonly closeTimeout: number;
  private readonly sdkLogLevel: number;
  private readonly beforeSend?: BeforeSendFn<JsonEvent> | BeforeSendFn<JsonEvent>[];
  private readonly beforeSendLog?: BeforeSendFn<JsonLog> | BeforeSendFn<JsonLog>[];
  private superProperties: Properties = {};
  private closed = false;
  private _disabled: boolean;

  constructor(apiKey: string, options?: TellOptions) {
    validateApiKey(apiKey);

    const resolved = resolveConfig(apiKey, options);
    this.onError = resolved.onError;
    this.source = resolved.source;
    this.service = options?.service;
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

  private _track(userId: string, eventName: string, properties: Properties | undefined, service: string | undefined): void {
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
      service,
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

  track(userId: string, eventName: string, properties?: Properties): void {
    this._track(userId, eventName, properties, this.service);
  }

  private _identify(userId: string, traits: Properties | undefined, service: string | undefined): void {
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
      service,
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

  identify(userId: string, traits?: Properties): void {
    this._identify(userId, traits, this.service);
  }

  private _group(userId: string, groupId: string, properties: Properties | undefined, service: string | undefined): void {
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
      service,
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

  group(userId: string, groupId: string, properties?: Properties): void {
    this._group(userId, groupId, properties, this.service);
  }

  private _revenue(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    properties: Properties | undefined,
    service: string | undefined,
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
      service,
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

  revenue(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    properties?: Properties
  ): void {
    this._revenue(userId, amount, currency, orderId, properties, this.service);
  }

  private _alias(previousId: string, userId: string, service: string | undefined): void {
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
      service,
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

  alias(previousId: string, userId: string): void {
    this._alias(previousId, userId, this.service);
  }

  resetSession(): void {
    this.sessionId = uuid();
  }

  // --- Logging ---

  private _log(level: LogLevel, message: string, data: Properties | undefined, service: string): void {
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
      service,
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

  log(level: LogLevel, message: string, data?: Properties): void {
    this._log(level, message, data, this.service ?? "app");
  }

  logEmergency(message: string, data?: Properties): void {
    this.log("emergency", message, data);
  }
  logAlert(message: string, data?: Properties): void {
    this.log("alert", message, data);
  }
  logCritical(message: string, data?: Properties): void {
    this.log("critical", message, data);
  }
  logError(message: string, data?: Properties): void {
    this.log("error", message, data);
  }
  logWarning(message: string, data?: Properties): void {
    this.log("warning", message, data);
  }
  logNotice(message: string, data?: Properties): void {
    this.log("notice", message, data);
  }
  logInfo(message: string, data?: Properties): void {
    this.log("info", message, data);
  }
  logDebug(message: string, data?: Properties): void {
    this.log("debug", message, data);
  }
  logTrace(message: string, data?: Properties): void {
    this.log("trace", message, data);
  }

  // --- Service Scoping ---

  withService(service: string): TellServiceScope {
    return {
      track: (userId, eventName, properties) => this._track(userId, eventName, properties, service),
      identify: (userId, traits) => this._identify(userId, traits, service),
      group: (userId, groupId, properties) => this._group(userId, groupId, properties, service),
      revenue: (userId, amount, currency, orderId, properties) => this._revenue(userId, amount, currency, orderId, properties, service),
      alias: (previousId, userId) => this._alias(previousId, userId, service),
      log: (level, message, data) => this._log(level, message, data, service),
      logEmergency: (message, data) => this._log("emergency", message, data, service),
      logAlert: (message, data) => this._log("alert", message, data, service),
      logCritical: (message, data) => this._log("critical", message, data, service),
      logError: (message, data) => this._log("error", message, data, service),
      logWarning: (message, data) => this._log("warning", message, data, service),
      logNotice: (message, data) => this._log("notice", message, data, service),
      logInfo: (message, data) => this._log("info", message, data, service),
      logDebug: (message, data) => this._log("debug", message, data, service),
      logTrace: (message, data) => this._log("trace", message, data, service),
      withService: (newService) => this.withService(newService),
    };
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
