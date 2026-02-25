import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createApp, defineComponent, h } from "vue";
import tell from "@tell-rs/browser";
import { TellPlugin, useTell } from "../src/index.js";

const API_KEY = "feed1e11feed1e11feed1e11feed1e11";

// ---------------------------------------------------------------------------
// Fetch mock (happy-dom globals already registered via test/setup.ts)
// ---------------------------------------------------------------------------

const fetchCalls: { url: string; init: RequestInit }[] = [];
const originalFetch = globalThis.fetch;

function mockFetch(url: string | URL | Request, init?: RequestInit) {
  fetchCalls.push({ url: String(url), init: init! });
  return Promise.resolve({ status: 202, statusText: "Accepted" } as Response);
}

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  fetchCalls.length = 0;
});

afterEach(() => {
  tell._resetForTesting();
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TellPlugin", () => {
  it("calls tell.configure on install", () => {
    const app = createApp({ render: () => null });
    app.use(TellPlugin, { apiKey: API_KEY, botDetection: false });

    // If configure succeeded, tracking should work without throwing
    tell.track("Plugin Installed");
  });

  it("provides tell via $tell global property", () => {
    const app = createApp({ render: () => null });
    app.use(TellPlugin, { apiKey: API_KEY, botDetection: false });

    assert.equal(app.config.globalProperties.$tell, tell);
  });

  it("calls tell.close on app.unmount", async () => {
    const mountEl = document.createElement("div");
    document.body.appendChild(mountEl);

    const app = createApp({ render: () => h("div") });
    app.use(TellPlugin, { apiKey: API_KEY, botDetection: false });
    app.mount(mountEl);

    tell.track("Before Unmount");
    await tell.flush();

    app.unmount();

    // close() is async (flushes batchers) — wait for it to complete
    await new Promise((r) => setTimeout(r, 50));

    // After unmount, close() was called — reconfigure should work
    tell.configure(API_KEY, { botDetection: false });
    tell.track("After Unmount");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("After Unmount");
      }),
      "expected SDK to be reconfigurable after app unmount"
    );

    document.body.removeChild(mountEl);
  });
});

describe("useTell", () => {
  it("returns tell instance inside a component with plugin installed", () => {
    let injected: unknown;

    const Child = defineComponent({
      setup() {
        injected = useTell();
        return () => null;
      },
    });

    const mountEl = document.createElement("div");
    document.body.appendChild(mountEl);

    const app = createApp({ render: () => h(Child) });
    app.use(TellPlugin, { apiKey: API_KEY, botDetection: false });
    app.mount(mountEl);

    assert.equal(injected, tell);

    app.unmount();
    document.body.removeChild(mountEl);
  });

  it("throws when plugin is not installed", () => {
    let thrownError: Error | undefined;

    const Child = defineComponent({
      setup() {
        try {
          useTell();
        } catch (err) {
          thrownError = err as Error;
        }
        return () => null;
      },
    });

    const mountEl = document.createElement("div");
    document.body.appendChild(mountEl);

    const app = createApp({ render: () => h(Child) });
    app.mount(mountEl);

    assert.ok(thrownError, "expected useTell to throw without plugin");
    assert.ok(
      thrownError!.message.includes("not provided"),
      "expected error message about missing plugin"
    );

    app.unmount();
    document.body.removeChild(mountEl);
  });
});
