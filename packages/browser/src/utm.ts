import type { Properties } from "@tell/core";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/**
 * Extract UTM parameters from the current URL search string.
 * Returns only keys that are present and non-empty.
 */
export function captureUtm(): Properties {
  if (typeof window === "undefined" || !window.location?.search) return {};

  const params = new URLSearchParams(window.location.search);
  const utm: Properties = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
    }
  }

  return utm;
}
