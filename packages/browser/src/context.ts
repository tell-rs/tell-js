export interface DeviceContext {
  browser?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  device_type?: string;
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
  device_pixel_ratio?: number;
  locale?: string;
  timezone?: string;
  referrer?: string;
  referrer_domain?: string;
  url?: string;
  title?: string;
  connection_type?: string;
  cpu_cores?: number;
  device_memory?: number;
  touch?: boolean;
}

/** Capture a snapshot of the current device/browser context. */
export function captureContext(): DeviceContext {
  const ctx: DeviceContext = {};

  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    const parsed = parseUA(ua);
    ctx.browser = parsed.browser;
    ctx.browser_version = parsed.browserVersion;
    ctx.os_name = parsed.os;
    ctx.os_version = parsed.osVersion;
    ctx.locale = navigator.language;

    // Hardware capabilities (touch must come before device_type inference)
    if ("hardwareConcurrency" in navigator) {
      ctx.cpu_cores = (navigator as any).hardwareConcurrency;
    }
    if ("deviceMemory" in navigator) {
      ctx.device_memory = (navigator as any).deviceMemory;
    }
    if ("maxTouchPoints" in navigator) {
      ctx.touch = navigator.maxTouchPoints > 0;
    }

    ctx.device_type = inferDeviceType(parsed.os, ua, ctx.touch);

    // Network info (Chrome/Edge)
    const conn = (navigator as any).connection;
    if (conn?.effectiveType) {
      ctx.connection_type = conn.effectiveType;
    }
  }

  if (typeof screen !== "undefined") {
    ctx.screen_width = screen.width;
    ctx.screen_height = screen.height;
  }

  if (typeof window !== "undefined") {
    ctx.viewport_width = window.innerWidth;
    ctx.viewport_height = window.innerHeight;
    if (window.devicePixelRatio) {
      ctx.device_pixel_ratio = window.devicePixelRatio;
    }
  }

  if (typeof document !== "undefined") {
    ctx.referrer = document.referrer || undefined;
    if (ctx.referrer) {
      try {
        ctx.referrer_domain = new URL(ctx.referrer).hostname;
      } catch {
        // malformed referrer
      }
    }
    ctx.title = document.title || undefined;
  }

  if (typeof location !== "undefined") {
    ctx.url = location.href;
  }

  try {
    ctx.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl not available
  }

  return ctx;
}

function inferDeviceType(os?: string, ua?: string, touch?: boolean): string {
  // iPad (iPadOS 13+) reports as macOS but has touch support
  if (os === "macOS" && touch) return "tablet";
  // Android tablets have "Android" in UA but not "Mobile"
  if (os === "Android") return ua && !/Mobile/.test(ua) ? "tablet" : "mobile";
  if (os === "iOS") return "mobile";
  return "desktop";
}

interface ParsedUA {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
}

function parseUA(ua: string): ParsedUA {
  const result: ParsedUA = {};

  // Browser detection (order matters: Edge before Chrome, Chrome before Safari)
  if (/Edg\/(\d+[\d.]*)/.test(ua)) {
    result.browser = "Edge";
    result.browserVersion = RegExp.$1;
  } else if (/OPR\/(\d+[\d.]*)/.test(ua)) {
    result.browser = "Opera";
    result.browserVersion = RegExp.$1;
  } else if (/Chrome\/(\d+[\d.]*)/.test(ua)) {
    result.browser = "Chrome";
    result.browserVersion = RegExp.$1;
  } else if (/Safari\/[\d.]+/.test(ua) && /Version\/(\d+[\d.]*)/.test(ua)) {
    result.browser = "Safari";
    result.browserVersion = RegExp.$1;
  } else if (/Firefox\/(\d+[\d.]*)/.test(ua)) {
    result.browser = "Firefox";
    result.browserVersion = RegExp.$1;
  }

  // OS detection
  if (/Windows NT ([\d.]+)/.test(ua)) {
    result.os = "Windows";
    result.osVersion = RegExp.$1;
  } else if (/Mac OS X ([\d_.]+)/.test(ua)) {
    result.os = "macOS";
    result.osVersion = RegExp.$1.replace(/_/g, ".");
  } else if (/iPhone OS ([\d_]+)/.test(ua)) {
    result.os = "iOS";
    result.osVersion = RegExp.$1.replace(/_/g, ".");
  } else if (/Android ([\d.]+)/.test(ua)) {
    result.os = "Android";
    result.osVersion = RegExp.$1;
  } else if (/Linux/.test(ua)) {
    result.os = "Linux";
  }

  return result;
}
