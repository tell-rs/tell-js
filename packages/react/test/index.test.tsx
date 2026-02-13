import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import tell from "@tell-rs/browser";
import { TellProvider, useTell, useTrack, useIdentify } from "../src/index.js";

// Enable React act() environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const API_KEY = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

// ---------------------------------------------------------------------------
// DOM + browser-global setup
// ---------------------------------------------------------------------------

let happyWindow: InstanceType<typeof Window>;
let container: HTMLElement;
let root: Root;

const fetchCalls: { url: string; init: RequestInit }[] = [];
const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();
const GLOBALS = ["window", "document", "navigator", "screen", "location", "localStorage", "fetch"] as const;

function mockFetch(url: string | URL | Request, init?: RequestInit) {
  fetchCalls.push({ url: String(url), init: init! });
  return Promise.resolve({ status: 202, statusText: "Accepted" } as Response);
}

function setGlobal(name: string, value: any) {
  if (!savedDescriptors.has(name)) {
    savedDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}

function restoreGlobals() {
  for (const [name, desc] of savedDescriptors) {
    if (desc) {
      Object.defineProperty(globalThis, name, desc);
    } else {
      delete (globalThis as any)[name];
    }
  }
  savedDescriptors.clear();
}

function setup() {
  happyWindow = new Window({ url: "https://example.com" });
  const doc = happyWindow.document as unknown as Document;

  setGlobal("window", happyWindow);
  setGlobal("document", doc);
  setGlobal("navigator", happyWindow.navigator);
  setGlobal("screen", { width: 1920, height: 1080 });
  setGlobal("location", happyWindow.location);
  setGlobal("localStorage", happyWindow.localStorage);
  setGlobal("fetch", mockFetch);

  container = doc.createElement("div");
  doc.body.appendChild(container);
  root = createRoot(container);
  fetchCalls.length = 0;
}

async function teardown() {
  // Unmount inside act() so React cleanup effects (tell.close()) run
  // before we tear down the browser globals they depend on.
  await act(() => {
    root.unmount();
  });
  tell._resetForTesting();
  happyWindow.close();
  restoreGlobals();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TellProvider", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("calls configure on mount", async () => {
    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <div />
        </TellProvider>
      );
    });

    // If configure didn't throw, SDK is active – track an event to prove it
    tell.track("Mounted");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => c.url.includes("/v1/events")),
      "expected at least one event flush after configure"
    );
  });

  it("calls close on unmount", async () => {
    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <div />
        </TellProvider>
      );
    });

    // Unmount triggers cleanup effect → tell.close()
    await act(() => {
      root.render(<div />);
    });

    // After close, configured resets — a new configure should succeed
    tell.configure(API_KEY, { botDetection: false });
    tell.track("After Remount");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("After Remount");
      }),
      "expected SDK to be reconfigurable after provider unmount"
    );
  });

  it("survives unmount + remount (HMR / Strict Mode)", async () => {
    // Mount
    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <div />
        </TellProvider>
      );
    });

    // Unmount
    await act(() => {
      root.render(<div />);
    });

    // Remount (simulates HMR or conditional render)
    fetchCalls.length = 0;
    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <div />
        </TellProvider>
      );
    });

    tell.track("Survived");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("Survived");
      }),
      "expected SDK to work after unmount + remount cycle"
    );
  });
});

describe("hooks", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("useTell returns the tell singleton", async () => {
    let hookResult: unknown;

    function TestComponent() {
      hookResult = useTell();
      return null;
    }

    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <TestComponent />
        </TellProvider>
      );
    });

    assert.equal(hookResult, tell);
  });

  it("useTrack returns a function that calls tell.track", async () => {
    let trackFn: ((name: string, props?: Record<string, any>) => void) | undefined;

    function TestComponent() {
      trackFn = useTrack();
      return null;
    }

    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <TestComponent />
        </TellProvider>
      );
    });

    assert.equal(typeof trackFn, "function");
    trackFn!("Hook Event", { from: "test" });
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("Hook Event");
      }),
      "expected useTrack to send events"
    );
  });

  it("useIdentify returns a function that calls tell.identify", async () => {
    let identifyFn: ((userId: string, traits?: Record<string, any>) => void) | undefined;

    function TestComponent() {
      identifyFn = useIdentify();
      return null;
    }

    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <TestComponent />
        </TellProvider>
      );
    });

    assert.equal(typeof identifyFn, "function");
    identifyFn!("user_42", { name: "Jane" });
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("user_42");
      }),
      "expected useIdentify to send identify event"
    );
  });

  it("useTrack returns a stable reference across re-renders", async () => {
    const refs: Function[] = [];

    function TestComponent() {
      const track = useTrack();
      refs.push(track);
      const [, setCount] = useState(0);
      React.useEffect(() => { setCount(1); }, []);
      return null;
    }

    await act(() => {
      root.render(
        <TellProvider apiKey={API_KEY} options={{ botDetection: false }}>
          <TestComponent />
        </TellProvider>
      );
    });

    // Should have rendered at least twice (initial + state update)
    assert.ok(refs.length >= 2, "expected at least 2 renders");
    assert.equal(refs[0], refs[1], "useTrack should return stable reference");
  });
});
