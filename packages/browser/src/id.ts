/** Generate a 32-char hex ID (16 random bytes) using crypto.getRandomValues. */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments without crypto (extremely rare)
  let hex = "";
  for (let i = 0; i < 32; i++) {
    hex += ((Math.random() * 16) | 0).toString(16);
  }
  return hex;
}
