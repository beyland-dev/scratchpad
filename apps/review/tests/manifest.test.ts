import type { ReviewManifest } from "@beyland/scratchpad-core/review-manifest";
import { describe, expect, test } from "vite-plus/test";
import {
  canCompare,
  canSequence,
  compareKeys,
  exportUrl,
  formatDate,
  introParagraphs,
  isExportPath,
  ManifestError,
  pageLabel,
  pageOf,
  pagesOf,
  parseManifest,
} from "../src/manifest.ts";

const valid: ReviewManifest = {
  version: 1,
  title: "Checkout: payment step",
  intro: "First.\n\nSecond.",
  questions: ["Which is clearest?"],
  presentation: "both",
  device: "laptop",
  theme: "dark",
  round: 2,
  exportedAt: "2026-10-28T16:00:00.000Z",
  project: "Storefront",
  items: [
    {
      key: "a",
      label: "Option A",
      note: "Single page",
      entry: "prototypes/checkout/index.html",
      pages: ["prototypes/checkout/done.html"],
    },
    { key: "b", label: "Option B", entry: "prototypes/checkout-b/index.html", pages: [] },
  ],
};

function manifestWith(overrides: Record<string, unknown>): unknown {
  return { ...valid, ...overrides };
}

describe("parseManifest", () => {
  test("keeps a valid manifest as is", () => {
    expect(parseManifest(structuredClone(valid))).toEqual(valid);
  });

  test("rejects what isn't a review", () => {
    expect(() => parseManifest(null)).toThrow(ManifestError);
    expect(() => parseManifest([])).toThrow(ManifestError);
    expect(() => parseManifest("review")).toThrow(ManifestError);
    expect(() => parseManifest(manifestWith({ version: 2 }))).toThrow(/version/);
    expect(() => parseManifest(manifestWith({ items: [] }))).toThrow(/no options/);
    expect(() => parseManifest(manifestWith({ items: "a,b" }))).toThrow(/no options/);
  });

  test("fills in defaults for missing or malformed fields", () => {
    const manifest = parseManifest({
      version: 1,
      title: "  ",
      questions: ["Keep", 3, "", null],
      presentation: "slideshow",
      device: "watch",
      theme: 7,
      round: 0,
      items: [{ key: "a", entry: "prototypes/a/index.html" }],
    });
    expect(manifest).toEqual({
      version: 1,
      title: "Design review",
      questions: ["Keep"],
      presentation: "both",
      device: "desktop",
      round: 1,
      exportedAt: "",
      project: "",
      items: [{ key: "a", label: "a", entry: "prototypes/a/index.html", pages: [] }],
    });
  });

  test("rounds fractional rounds down", () => {
    expect(parseManifest(manifestWith({ round: 3.7 })).round).toBe(3);
  });

  test("drops invalid and duplicate items", () => {
    const manifest = parseManifest(
      manifestWith({
        items: [
          { key: "a", label: "First", entry: "prototypes/a/index.html" },
          { key: "a", label: "Duplicate", entry: "prototypes/x/index.html" },
          { key: "has space", label: "Bad key", entry: "prototypes/y/index.html" },
          { key: "b", label: "No entry" },
          { key: "c", label: "Remote", entry: "https://example.com/index.html" },
          { key: "d", label: "Escapes", entry: "../secrets/index.html" },
          "nonsense",
          { key: "e", label: "Fine", entry: "prototypes/e/index.html" },
        ],
      }),
    );
    expect(manifest.items.map((i) => `${i.key}:${i.label}`)).toEqual(["a:First", "e:Fine"]);
  });

  test("keeps only safe, distinct extra pages", () => {
    const [item] = parseManifest(
      manifestWith({
        items: [
          {
            key: "a",
            label: "A",
            entry: "prototypes/a/index.html",
            pages: [
              "prototypes/a/index.html",
              "prototypes/a/two.html",
              "prototypes/a/two.html",
              "/etc/passwd",
              "javascript:alert(1)",
              42,
            ],
          },
        ],
      }),
    ).items;
    expect(item?.pages).toEqual(["prototypes/a/two.html"]);
  });
});

describe("isExportPath", () => {
  test("accepts relative paths inside the export", () => {
    expect(isExportPath("prototypes/a/index.html")).toBe(true);
    expect(isExportPath("prototypes/a b/página.html")).toBe(true);
  });

  test("rejects anything that could leave it", () => {
    for (const path of [
      "",
      "/prototypes/a/index.html",
      "//evil.example/a.html",
      "https://evil.example/a.html",
      "data:text/html,hi",
      "JavaScript:alert(1)",
      "prototypes/../../a.html",
      "prototypes\\a.html",
      "prototypes/a/index.html?x=1",
      "prototypes/a/index.html#top",
      "prototypes//a.html",
      42,
      null,
    ]) {
      expect(isExportPath(path), String(path)).toBe(false);
    }
  });
});

describe("presentation", () => {
  test("sequence and compare follow the presentation", () => {
    expect(canSequence(valid)).toBe(true);
    expect(canCompare(valid)).toBe(true);
    expect(canSequence({ ...valid, presentation: "compare" })).toBe(false);
    expect(canCompare({ ...valid, presentation: "sequence" })).toBe(false);
  });

  test("compare needs at least two options", () => {
    expect(canCompare({ ...valid, items: valid.items.slice(0, 1) })).toBe(false);
  });
});

describe("pages", () => {
  const item = valid.items[0]!;

  test("lists the entry first", () => {
    expect(pagesOf(item)).toEqual([
      "prototypes/checkout/index.html",
      "prototypes/checkout/done.html",
    ]);
  });

  test("falls back to the entry for unknown pages", () => {
    expect(pageOf(item, "prototypes/checkout/done.html")).toBe("prototypes/checkout/done.html");
    expect(pageOf(item, "prototypes/other/index.html")).toBe("prototypes/checkout/index.html");
    expect(pageOf(item, undefined)).toBe("prototypes/checkout/index.html");
  });

  test("labels pages relative to the prototype folder", () => {
    expect(pageLabel(item, "prototypes/checkout/done.html")).toBe("done.html");
    expect(pageLabel(item, "prototypes/checkout/settings/index.html")).toBe("settings/index.html");
    expect(pageLabel(item, "prototypes/elsewhere/a.html")).toBe("prototypes/elsewhere/a.html");
    expect(pageLabel({ ...item, entry: "index.html" }, "about.html")).toBe("about.html");
  });
});

describe("compareKeys", () => {
  const many: ReviewManifest = {
    ...valid,
    items: ["a", "b", "c", "d", "e"].map((key) => ({
      key,
      label: key,
      entry: `prototypes/${key}/index.html`,
      pages: [],
    })),
  };

  test("defaults to the first four", () => {
    expect(compareKeys(many, undefined)).toEqual(["a", "b", "c", "d"]);
    expect(compareKeys(valid, [])).toEqual(["a", "b"]);
  });

  test("keeps requested keys that exist, at most four", () => {
    expect(compareKeys(many, ["e", "a", "zz", "a"])).toEqual(["e", "a"]);
    expect(compareKeys(many, ["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d"]);
    expect(compareKeys(many, ["zz"])).toEqual(["a", "b", "c", "d"]);
  });
});

describe("text helpers", () => {
  test("splits the intro into paragraphs", () => {
    expect(introParagraphs("One\nstill one.\n\n  Two  \n \n\nThree")).toEqual([
      "One\nstill one.",
      "Two",
      "Three",
    ]);
    expect(introParagraphs(undefined)).toEqual([]);
  });

  test("formats the export date", () => {
    expect(formatDate("2026-10-28T16:00:00.000Z", "en-US")).toBe("Oct 28, 2026");
    expect(formatDate("", "en-US")).toBe("");
    expect(formatDate("not a date", "en-US")).toBe("");
  });
});

describe("exportUrl", () => {
  test("resolves against the page, from any sub-path", () => {
    const page = "https://acme.github.io/reviews/checkout/#/o/a?device=mobile";
    expect(exportUrl("prototypes/a/index.html", page)).toBe(
      "https://acme.github.io/reviews/checkout/prototypes/a/index.html",
    );
    expect(
      exportUrl("prototypes/a/index.html", "https://acme.github.io/reviews/checkout/index.html"),
    ).toBe("https://acme.github.io/reviews/checkout/prototypes/a/index.html");
  });
});
