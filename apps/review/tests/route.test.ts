import { describe, expect, test } from "vite-plus/test";
import {
  documentTitle,
  formatRoute,
  parseRoute,
  viewSettings,
  type ReviewRoute,
} from "../src/route.ts";
import { parseManifest } from "../src/manifest.ts";

describe("parseRoute", () => {
  test("defaults to the overview", () => {
    expect(parseRoute("")).toEqual({ view: "overview" });
    expect(parseRoute("#")).toEqual({ view: "overview" });
    expect(parseRoute("#/")).toEqual({ view: "overview" });
    expect(parseRoute("#/nowhere/at/all")).toEqual({ view: "overview" });
  });

  test("reads an option with its page, device and theme", () => {
    expect(parseRoute("#/o/a?page=prototypes/a/settings.html&device=mobile&theme=dark")).toEqual({
      view: "option",
      key: "a",
      page: "prototypes/a/settings.html",
      device: "mobile",
      theme: "dark",
    });
  });

  test("decodes keys and ignores malformed ones", () => {
    expect(parseRoute("#/o/option%20b").key).toBe("option b");
    expect(parseRoute("#/o/%E0%A4%A").view).toBe("overview");
    expect(parseRoute("#/o/").view).toBe("overview");
  });

  test("reads compare with its options", () => {
    expect(parseRoute("#/compare?keys=a,c&device=tablet")).toEqual({
      view: "compare",
      keys: ["a", "c"],
      device: "tablet",
    });
    expect(parseRoute("#/compare")).toEqual({ view: "compare" });
  });

  test("drops unknown devices and empty parameters", () => {
    expect(parseRoute("#/?device=watch&theme=")).toEqual({ view: "overview" });
  });

  test("ignores parameters that don't belong to the view", () => {
    expect(parseRoute("#/?page=x.html&keys=a")).toEqual({ view: "overview" });
  });
});

describe("formatRoute", () => {
  test("formats each view", () => {
    expect(formatRoute({ view: "overview" })).toBe("#/");
    expect(formatRoute({ view: "option", key: "a", device: "mobile", theme: "dark" })).toBe(
      "#/o/a?device=mobile&theme=dark",
    );
    expect(formatRoute({ view: "compare", keys: ["a", "b"] })).toBe("#/compare?keys=a,b");
    expect(formatRoute({ view: "option", key: "a", page: "prototypes/a/b.html" })).toBe(
      "#/o/a?page=prototypes/a/b.html",
    );
  });

  test("falls back to the overview for an option without a key", () => {
    expect(formatRoute({ view: "option" })).toBe("#/");
  });

  test("round-trips through parseRoute", () => {
    const routes: ReviewRoute[] = [
      { view: "overview", device: "laptop" },
      { view: "option", key: "b c", page: "prototypes/x/a b.html", theme: "high contrast" },
      { view: "compare", keys: ["a", "c"], device: "mobile", theme: "dark" },
    ];
    for (const route of routes) expect(parseRoute(formatRoute(route))).toEqual(route);
  });
});

describe("viewSettings", () => {
  test("keeps only device and theme", () => {
    expect(viewSettings({ view: "option", key: "a", page: "p.html", device: "mobile" })).toEqual({
      device: "mobile",
    });
    expect(viewSettings({ view: "overview" })).toEqual({});
  });
});

describe("documentTitle", () => {
  const manifest = parseManifest({
    version: 1,
    title: "Checkout",
    items: [{ key: "a", label: "Option A", entry: "prototypes/a/index.html" }],
  });

  test("names the view", () => {
    expect(documentTitle(manifest, { view: "overview" })).toBe("Checkout");
    expect(documentTitle(manifest, { view: "option", key: "a" })).toBe("Option A · Checkout");
    expect(documentTitle(manifest, { view: "option", key: "zz" })).toBe("Checkout");
    expect(documentTitle(manifest, { view: "compare" })).toBe("Compare · Checkout");
  });
});
