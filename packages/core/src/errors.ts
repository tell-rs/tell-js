export class TellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TellError";
  }
}

export class ConfigurationError extends TellError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ValidationError extends TellError {
  public readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NetworkError extends TellError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }
}

export class ClosedError extends TellError {
  constructor() {
    super("Client is closed");
    this.name = "ClosedError";
  }
}

export class SerializationError extends TellError {
  constructor(message: string) {
    super(message);
    this.name = "SerializationError";
  }
}
