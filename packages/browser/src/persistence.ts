export interface TellStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const STORAGE_KEYS = {
  DEVICE_ID: "tell_device_id",
  USER_ID: "tell_user_id",
  OPT_OUT: "tell_opt_out",
  SUPER_PROPS: "tell_super_props",
} as const;

class LocalStorageStorage implements TellStorage {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Safari private mode or quota exceeded
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

class MemoryStorage implements TellStorage {
  private data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

/** Create a storage backend. Falls back to memory if localStorage is unavailable. */
export function createStorage(
  persistence: "localStorage" | "memory"
): TellStorage {
  if (persistence === "localStorage" && typeof localStorage !== "undefined") {
    try {
      const testKey = "tell_test";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return new LocalStorageStorage();
    } catch {
      // probe failed — fall through to memory
    }
  }
  return new MemoryStorage();
}
