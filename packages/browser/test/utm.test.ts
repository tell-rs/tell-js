import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { captureUtm } from "../src/utm.js";
import { setGlobal, restoreGlobal } from "./helpers.js";

describe("captureUtm", () => {
  afterEach(() => {
    restoreGlobal("window");
  });

  it("extracts all UTM parameters", () => {
    setGlobal("window", {
      location: {
        search:
          "?utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=analytics&utm_content=banner",
      },
    });

    const utm = captureUtm();
    assert.equal(utm.utm_source, "google");
    assert.equal(utm.utm_medium, "cpc");
    assert.equal(utm.utm_campaign, "launch");
    assert.equal(utm.utm_term, "analytics");
    assert.equal(utm.utm_content, "banner");
  });

  it("returns only present keys", () => {
    setGlobal("window", {
      location: { search: "?utm_source=twitter&page=2" },
    });

    const utm = captureUtm();
    assert.equal(utm.utm_source, "twitter");
    assert.equal(utm.utm_medium, undefined);
    assert.equal(utm.utm_campaign, undefined);
    assert.equal(Object.keys(utm).length, 1);
  });

  it("returns empty object when no UTMs", () => {
    setGlobal("window", {
      location: { search: "?page=2&sort=name" },
    });

    const utm = captureUtm();
    assert.equal(Object.keys(utm).length, 0);
  });

  it("returns empty object when window is undefined", () => {
    setGlobal("window", undefined);
    const utm = captureUtm();
    assert.equal(Object.keys(utm).length, 0);
  });
});
