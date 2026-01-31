import { ConfigurationError, ValidationError } from "./errors.js";

const HEX_RE = /^[0-9a-fA-F]{32}$/;
const MAX_EVENT_NAME = 256;
const MAX_LOG_MESSAGE = 65_536;

export function validateApiKey(key: string): void {
  if (!key) {
    throw new ConfigurationError("apiKey is required");
  }
  if (!HEX_RE.test(key)) {
    throw new ConfigurationError(
      "apiKey must be exactly 32 hex characters"
    );
  }
}

export function validateEventName(name: unknown): void {
  if (typeof name !== "string" || name.length === 0) {
    throw new ValidationError("eventName", "must be a non-empty string");
  }
  if (name.length > MAX_EVENT_NAME) {
    throw new ValidationError(
      "eventName",
      `must be at most ${MAX_EVENT_NAME} characters, got ${name.length}`
    );
  }
}

export function validateLogMessage(message: unknown): void {
  if (typeof message !== "string" || message.length === 0) {
    throw new ValidationError("message", "must be a non-empty string");
  }
  if (message.length > MAX_LOG_MESSAGE) {
    throw new ValidationError(
      "message",
      `must be at most ${MAX_LOG_MESSAGE} characters, got ${message.length}`
    );
  }
}

export function validateUserId(id: unknown): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new ValidationError("userId", "must be a non-empty string");
  }
}
