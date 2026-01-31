// Public types for the Tell SDK

export interface Properties {
  [key: string]: string | number | boolean | null | undefined;
}

export type EventType =
  | "track"
  | "identify"
  | "group"
  | "alias"
  | "enrich"
  | "context";

export type LogLevel =
  | "emergency"
  | "alert"
  | "critical"
  | "error"
  | "warning"
  | "notice"
  | "info"
  | "debug"
  | "trace";

// Wire format: JSON event line sent to POST /v1/events
export interface JsonEvent {
  type: EventType;
  event?: string;
  device_id: string;
  session_id?: string;
  user_id?: string;
  group_id?: string;
  timestamp?: number;
  properties?: Properties;
  traits?: Properties;
  context?: Properties;
}

// Wire format: JSON log line sent to POST /v1/logs
export interface JsonLog {
  level: LogLevel;
  message: string;
  timestamp?: number;
  source?: string;
  service?: string;
  session_id?: string;
  data?: Properties;
  type?: "log" | "enrich";
}
