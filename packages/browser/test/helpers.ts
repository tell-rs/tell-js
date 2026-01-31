/** Shared mocking utilities for browser SDK tests. */

export interface MockFetchCall {
  url: string;
  init: RequestInit;
}

export let fetchCalls: MockFetchCall[] = [];
export let fetchResponse: { status: number; statusText: string } = {
  status: 202,
  statusText: "Accepted",
};

export function mockFetch(
  url: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  fetchCalls.push({ url: String(url), init: init! });
  return Promise.resolve({
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
  } as Response);
}

export function resetFetchMock(): void {
  fetchCalls = [];
  fetchResponse = { status: 202, statusText: "Accepted" };
}

// ---- localStorage mock ----

export function createMockLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    },
    removeItem(key: string): void {
      data.delete(key);
    },
    clear(): void {
      data.clear();
    },
    get length(): number {
      return data.size;
    },
    key(index: number): string | null {
      return Array.from(data.keys())[index] ?? null;
    },
  } as Storage;
}

// ---- Global property helpers ----

const savedDescriptors: Map<string, PropertyDescriptor | undefined> = new Map();

/** Set a global property, saving original descriptor for later restoration. */
export function setGlobal(name: string, value: any): void {
  if (!savedDescriptors.has(name)) {
    savedDescriptors.set(
      name,
      Object.getOwnPropertyDescriptor(globalThis, name)
    );
  }
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
}

/** Restore a global property to its original descriptor. */
export function restoreGlobal(name: string): void {
  const desc = savedDescriptors.get(name);
  if (desc) {
    Object.defineProperty(globalThis, name, desc);
  } else {
    delete (globalThis as any)[name];
  }
  savedDescriptors.delete(name);
}

// ---- DOM mocks ----

type EventCallback = (...args: any[]) => void;

export class MockEventTarget {
  private handlers: Map<string, Set<EventCallback>> = new Map();

  addEventListener(type: string, cb: EventCallback): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(cb);
  }

  removeEventListener(type: string, cb: EventCallback): void {
    this.handlers.get(type)?.delete(cb);
  }

  dispatchEvent(type: string, data?: any): void {
    for (const cb of this.handlers.get(type) ?? []) {
      cb(data ?? {});
    }
  }
}

export interface MockDocument extends MockEventTarget {
  visibilityState: "visible" | "hidden";
  referrer: string;
  title: string;
}

export function createMockDocument(): MockDocument {
  const target = new MockEventTarget();
  return Object.assign(target, {
    visibilityState: "visible" as "visible" | "hidden",
    referrer: "",
    title: "Test Page",
  });
}

export function createMockNavigator(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    language: "en-US",
    onLine: true,
    doNotTrack: null,
    sendBeacon: () => true,
    webdriver: false,
    ...overrides,
  };
}

const BROWSER_GLOBALS = [
  "document",
  "navigator",
  "window",
  "screen",
  "location",
  "localStorage",
] as const;

export function setupBrowserGlobals(): {
  doc: MockDocument;
  nav: Record<string, any>;
  cleanup: () => void;
} {
  // Save originals
  for (const name of BROWSER_GLOBALS) {
    if (!savedDescriptors.has(name)) {
      savedDescriptors.set(
        name,
        Object.getOwnPropertyDescriptor(globalThis, name)
      );
    }
  }
  // Also save fetch
  const originalFetch = globalThis.fetch;

  const doc = createMockDocument();
  const nav = createMockNavigator();
  const win = Object.assign(new MockEventTarget(), {
    innerWidth: 1280,
    innerHeight: 720,
  });

  setGlobal("document", doc);
  setGlobal("navigator", nav);
  setGlobal("window", win);
  setGlobal("screen", { width: 2560, height: 1440 });
  setGlobal("location", { href: "https://example.com/test" });
  setGlobal("localStorage", createMockLocalStorage());
  globalThis.fetch = mockFetch as typeof globalThis.fetch;

  resetFetchMock();

  return {
    doc,
    nav,
    cleanup() {
      for (const name of BROWSER_GLOBALS) {
        restoreGlobal(name);
      }
      globalThis.fetch = originalFetch;
    },
  };
}
