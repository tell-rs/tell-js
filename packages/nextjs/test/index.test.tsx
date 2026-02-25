import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import tell from "@tell-rs/browser";
import { Tell } from "../src/index.js";
import {
  setPathname,
  setSearchParams,
  resetMock,
} from "./next-navigation-mock.js";

// Enable React act() environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const API_KEY = "feed1e11feed1e11feed1e11feed1e11";

// ---------------------------------------------------------------------------
// DOM + browser-global setup
// ---------------------------------------------------------------------------

let happyWindow: InstanceType<typeof Window>;
let container: HTMLElement;
let root: Root;

const fetchCalls: { url: string; init: RequestInit }[] = [];
const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();

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
  resetMock();
}

async function teardown() {
  await act(() => {
    root.unmount();
  });
  tell._resetForTesting();
  happyWindow.close();
  restoreGlobals();
}

// ---------------------------------------------------------------------------
// Helper: extract tracked event names from fetch calls
// ---------------------------------------------------------------------------

function trackedEvents(): string[] {
  return fetchCalls
    .filter((c) => c.url.includes("/v1/events"))
    .flatMap((c) =>
      (c.init.body as string)
        .split("\n")
        .map((l) => JSON.parse(l))
        .filter((e: any) => e.type === "track")
        .map((e: any) => e.event)
    );
}

function trackedProperties(): Record<string, any>[] {
  return fetchCalls
    .filter((c) => c.url.includes("/v1/events"))
    .flatMap((c) =>
      (c.init.body as string)
        .split("\n")
        .map((l) => JSON.parse(l))
        .filter((e: any) => e.type === "track" && e.event === "Page Viewed")
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Tell (Next.js)", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("configures on mount", async () => {
    setPathname("/home");

    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });

    tell.track("Mounted");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => c.url.includes("/v1/events")),
      "expected events to flush after configure"
    );
  });

  it("tracks initial page view on mount", async () => {
    setPathname("/dashboard");

    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });
    await tell.flush();

    const events = trackedEvents();
    assert.ok(events.includes("Page Viewed"), "expected Page Viewed event");

    const props = trackedProperties();
    assert.ok(
      props.some((p) => p.path === "/dashboard"),
      "expected path=/dashboard in page view properties"
    );
  });

  it("tracks page view on pathname change", async () => {
    setPathname("/page-a");

    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });
    await tell.flush();
    fetchCalls.length = 0;

    // Simulate navigation
    setPathname("/page-b");
    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });
    await tell.flush();

    const props = trackedProperties();
    assert.ok(
      props.some((p) => p.path === "/page-b"),
      "expected page view for /page-b after navigation"
    );
  });

  it("includes search params in page view url", async () => {
    setPathname("/search");
    setSearchParams(new URLSearchParams("q=hello"));

    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });
    await tell.flush();

    const props = trackedProperties();
    assert.ok(
      props.some((p) => p.url === "/search?q=hello"),
      "expected url with search params"
    );
  });

  it("respects trackPageViews=false", async () => {
    setPathname("/silent");

    await act(() => {
      root.render(
        <Tell
          apiKey={API_KEY}
          options={{ botDetection: false }}
          trackPageViews={false}
        />
      );
    });
    await tell.flush();

    const events = trackedEvents();
    assert.ok(
      !events.includes("Page Viewed"),
      "expected no Page Viewed when trackPageViews=false"
    );
  });

  it("merges pageViewProperties into page view events", async () => {
    setPathname("/promo");

    await act(() => {
      root.render(
        <Tell
          apiKey={API_KEY}
          options={{ botDetection: false }}
          pageViewProperties={{ campaign: "summer" }}
        />
      );
    });
    await tell.flush();

    const props = trackedProperties();
    assert.ok(
      props.some((p) => p.campaign === "summer"),
      "expected custom pageViewProperties in event"
    );
  });

  it("calls close on unmount and allows reconfigure", async () => {
    setPathname("/");

    await act(() => {
      root.render(<Tell apiKey={API_KEY} options={{ botDetection: false }} />);
    });

    await act(() => {
      root.render(<div />);
    });

    // Reconfigure after unmount
    tell.configure(API_KEY, { botDetection: false });
    tell.track("After Remount");
    await tell.flush();

    assert.ok(
      fetchCalls.some((c) => {
        if (!c.url.includes("/v1/events")) return false;
        return (c.init.body as string).includes("After Remount");
      }),
      "expected reconfigure to work after unmount"
    );
  });
});
