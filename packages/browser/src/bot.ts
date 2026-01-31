/** Returns true if the current environment appears to be an automated bot. */
export function isBot(): boolean {
  if (typeof navigator === "undefined") return false;
  if ((navigator as any).webdriver === true) return true;
  const ua = navigator.userAgent || "";
  return /headless/i.test(ua);
}
