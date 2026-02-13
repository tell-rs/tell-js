// @tell-rs/core — shared internals for tell-node and tell-js
// This package is private and never published to npm.

export type { Properties, EventType, LogLevel, JsonEvent, JsonLog } from "./types.js";
export type { BeforeSendFn } from "./before-send.js";
export { Events, type EventName } from "./constants.js";
export { TellError, ConfigurationError, ValidationError, NetworkError, ClosedError, SerializationError } from "./errors.js";
export { validateApiKey, validateEventName, validateLogMessage, validateUserId } from "./validation.js";
export { Batcher, type BatcherConfig } from "./batcher.js";
export { runBeforeSend } from "./before-send.js";
export { redact, redactLog, SENSITIVE_PARAMS, type RedactOptions } from "./redact.js";
