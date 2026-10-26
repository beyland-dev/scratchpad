import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  Core,
  initWorkspace,
  mergeStylesheets,
  prepareCapturedCss,
  scopeSelectorToTheme,
  splitCssBlocks,
  widenTypeSelectors,
  type CoreEvent,
} from "../src/index.ts";

let root: string;
let core: Core;

const THEMES = [
  { id: "dark", label: "Dark", kind: "dark" as const, classes: "vs-dark" },
  { id: "light", label: "Light", kind: "light" as const, classes: "vs" },
];

async function makeSystem() {
  await core.run("system.create", {
    id: "acme",
    name: "Acme",
    prefix: "acme",
    themes: THEMES,
    defaultTheme: "dark",
    rootContext: "acme-root",
    themeSelector: ".acme-root{classes}",
    sheetOrder: ["main.css", "icons"],
    attribution: [{ name: "Acme UI", license: "MIT" }],
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dt-sys-"));
  await initWorkspace(root, { name: "Systems", example: false });
  core = await Core.open({ root });
});

afterEach(async () => {
  await core.close();
  await rm(root, { recursive: true, force: true });
});

describe("css merge", () => {
  test("splits statements and keeps leading comments", () => {
    const blocks = splitCssBlocks(
      `/* @capture main.css@0.2 */\n.a { color: red; }\n@media (x) { .b { c: "}"; } }\n/* note */ .c{}`,
    );
    expect(blocks.map((b) => b.capture?.key ?? null)).toEqual(["main.css@0.2", null, null]);
    expect(blocks[1]!.text).toContain('"}"');
    expect(blocks[2]!.text).toBe("/* note */ .c{}");
  });

  test("dedupes captured rules and orders them by sheet then path", () => {
    const merged = mergeStylesheets(
      [
        {
          origin: "b",
          css: "/* @capture main.css@0.10 */ .ten{}\n/* @capture icons@1.0 */ .icon{}\n.authored-b{}",
        },
        {
          origin: "a",
          css: "/* @capture main.css@0.2 */ .two{}\n/* @capture main.css@0.10 */ .ten{}",
        },
      ],
      ["main.css", "icons"],
    );
    const order = ["two", "ten", "icon", "authored-b"].map((c) => merged.css.indexOf(`.${c}`));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(merged.duplicates).toBe(1);
    expect(merged.captured).toBe(3);
  });

  test("copies of a captured rule with different matched selectors merge their selector lists", () => {
    const merged = mergeStylesheets([
      { origin: "tab", css: "/* @capture main.css@4 */\n.c > .tab {\n  min-height: 2px;\n}" },
      { origin: "tabs", css: "/* @capture main.css@4 */\n.c,\n.c > .tab {\n  min-height: 2px;\n}" },
      {
        origin: "m",
        css: "/* @capture main.css@5 */\n@media (x) {\n  .a {\n    color: red;\n  }\n}",
      },
      {
        origin: "n",
        css: "/* @capture main.css@5 */\n@media (x) {\n  .b {\n    color: red;\n  }\n}",
      },
    ]);
    expect(merged.css).toContain(
      "/* @capture main.css@4 */\n.c > .tab,\n.c {\n  min-height: 2px;\n}",
    );
    expect(merged.css).toContain("@media (x) {\n  .a,\n  .b {\n    color: red;\n  }\n}");
    expect(merged.duplicates).toBe(2);

    const clash = mergeStylesheets([
      { origin: "a", css: "/* @capture inline-3@0 */\n.x { color: red; }" },
      { origin: "b", css: "/* @capture inline-3@0 */\n.y { color: blue; }" },
    ]);
    expect(clash.css).toContain(".x { color: red; }");
    expect(clash.css).toContain(".y { color: blue; }");
    expect(clash.captured).toBe(2);
  });

  test("widens type selectors in selector preludes only", () => {
    const map = new Map([
      ["li", ["acme-action"]],
      ["a", ["acme-link", "acme-button"]],
    ]);
    const css = widenTypeSelectors(
      `/* li a */ .bar > li:last-child, a.x, .y [title="li"] { content: "li"; display: inline-block; }\n@media (min-width: 1px) { .z a:hover { color: red; } }\n.list { color: blue; }`,
      map,
    );
    expect(css).toContain(
      `/* li a */ .bar > :is(li, acme-action):last-child, :is(a, acme-link, acme-button).x, .y [title="li"] { content: "li"; display: inline-block; }`,
    );
    expect(css).toContain(".z :is(a, acme-link, acme-button):hover { color: red; }");
    expect(css).toContain(".list { color: blue; }");
  });

  test("scopes theme-sheet rules to the capture's theme without adding specificity", () => {
    const scope = {
      id: "dark",
      selector: ".root.vs-dark",
      root: ".root",
      classes: ".vs-dark",
    };
    expect(scopeSelectorToTheme(".x.root .tab:hover", scope)).toBe(
      ".x.root:where(.vs-dark) .tab:hover",
    );
    expect(scopeSelectorToTheme(".tab::before", scope)).toBe(":where(.root.vs-dark) .tab::before");
    const css = prepareCapturedCss(
      [
        "/*\n * header\n */",
        "/* @capture main.css@3 */\n.a { color: red; }",
        "/* @capture theme@7 */\n.root { --acme-bg: #000; }",
        "/* @capture theme@8 */\n.root .tab, .other { color: #fff; --acme-bg: #111; }",
      ].join("\n\n"),
      { themeSheets: ["theme"], theme: scope, tokenVars: new Set(["--acme-bg"]) },
    );
    expect(css).not.toContain("header");
    expect(css).toContain("/* @capture main.css@3 */\n.a { color: red; }");
    expect(css).not.toContain("theme@7");
    expect(css).toContain(
      "/* @capture theme~dark@8 */\n.root:where(.vs-dark) .tab,\n:where(.root.vs-dark) .other { color: #fff; --acme-bg: #111; }",
    );
  });
});

describe("design systems", () => {
  test("create, list, get, update", async () => {
    await makeSystem();
    const list = await core.run<{ systems: { id: string; components: number }[] }>("system.list");
    expect(list.systems).toMatchObject([{ id: "acme", components: 0 }]);
    await expect(makeSystem()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      core.run("system.update", { id: "acme", defaultTheme: "nope" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const updated = await core.run<{ system: { notes: string } }>("system.update", {
      id: "acme",
      notes: "Run the app first.",
    });
    expect(updated.system.notes).toBe("Run the app first.");
    const json = JSON.parse(
      await readFile(path.join(root, ".design/systems/acme/system.json"), "utf8"),
    );
    expect(json).toMatchObject({
      name: "Acme",
      rootContext: "acme-root",
      notes: "Run the app first.",
    });
  });

  test("token import merges per-theme values and metadata; search ranks matches", async () => {
    await makeSystem();
    await core.run("token.import", {
      system: "acme",
      tokens: [
        {
          name: "button.background",
          type: "color",
          cssVar: "--acme-button-background",
          values: { dark: "#0e639c" },
          group: "button",
        },
        {
          name: "button.foreground",
          type: "color",
          cssVar: "--acme-button-foreground",
          values: { dark: "#fff" },
          group: "button",
        },
        {
          name: "radius.large",
          type: "dimension",
          cssVar: "--acme-radius-large",
          value: "8px",
          group: "radius",
        },
      ],
    });
    const second = await core.run<{ added: number; updated: number }>("token.import", {
      system: "acme",
      tokens: [
        {
          name: "button.background",
          type: "color",
          cssVar: "--acme-button-background",
          values: { light: "#005fb8" },
          description: "Button background color.",
        },
      ],
    });
    expect(second).toMatchObject({ added: 0, updated: 1 });
    const found = await core.run<{
      tokens: { name: string; values: Record<string, string>; description?: string }[];
      total: number;
    }>("token.search", {
      system: "acme",
      query: "button background",
    });
    expect(found.tokens[0]).toMatchObject({
      name: "button.background",
      values: { dark: "#0e639c", light: "#005fb8" },
      description: "Button background color.",
    });
    expect(found.total).toBe(1);
    expect(
      (await core.run<{ total: number }>("token.search", { system: "acme", type: "dimension" }))
        .total,
    ).toBe(1);
  });

  test("components: create, search, get with wrapped snippet, update, files", async () => {
    await makeSystem();
    await core.run("component.create", {
      system: "acme",
      name: "root",
      tag: "acme-root",
      kind: "context",
      title: "Root",
      description: "Applies the theme.",
      js: "class Root extends ds.Element { static props = ['theme']; updated() { ds.applyTheme(this, this.attr('theme', ds.system.defaultTheme)); } }\nds.define('acme-root', Root);",
      examples: [{ title: "Root", html: "<acme-root></acme-root>" }],
    });
    await core.run("component.create", {
      system: "acme",
      name: "button",
      tag: "acme-button",
      title: "Button",
      category: "inputs",
      description: "A clickable button. Use for primary actions.",
      attributes: [
        { name: "variant", type: "enum", values: ["primary", "secondary"], default: "primary" },
      ],
      states: [{ name: "disabled", trigger: "disabled attribute" }],
      css: "/* @capture main.css@0.5 */\n.acme-button { color: var(--acme-button-foreground); background: var(--acme-button-background); border-radius: var(--acme-radius-large); }\n/* @capture main.css@0.1 */\n.acme-root { font: 13px sans-serif; }",
      js: "class Button extends ds.Element { static hostClass = 'acme-button'; static props = ['disabled']; render() { this.setClasses({ disabled: this.flag('disabled') }); return this.slotted(''); } }\nds.define('acme-button', Button);",
      examples: [{ title: "Primary", html: "<acme-button>Save</acme-button>" }],
    });
    await expect(
      core.run("component.create", {
        system: "acme",
        name: "button2",
        tag: "acme-button",
        title: "Dup",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const search = await core.run<{ components: { tag: string }[] }>("component.search", {
      system: "acme",
      query: "clickable",
    });
    expect(search.components.map((c) => c.tag)).toEqual(["acme-button"]);
    const list = await core.run<{ components: { tag: string }[] }>("component.list", {
      system: "acme",
    });
    expect(list.components.map((c) => c.tag)).toEqual(["acme-root", "acme-button"]);

    const got = await core.run<{ snippet: string; specimens: { theme: string; url: string }[] }>(
      "component.get",
      { system: "acme", tag: "acme-button" },
    );
    expect(got.snippet).toBe(
      '<acme-root theme="dark">\n  <acme-button>Save</acme-button>\n</acme-root>',
    );
    expect(got.specimens.map((s) => s.theme)).toEqual(["dark", "light"]);

    const updated = await core.run<{ component: { status: string } }>("component.update", {
      system: "acme",
      name: "button",
      status: "stable",
    });
    expect(updated.component.status).toBe("stable");
    await expect(
      core.run("component.writeFile", {
        system: "acme",
        name: "button",
        path: "component.json",
        content: "{}",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await core.run("component.writeFile", {
      system: "acme",
      name: "button",
      path: "reference/geometry.json",
      content: "[]",
    });
    const files = await core
      .run<{ path: string }[]>("component.get", { system: "acme", name: "button" })
      .then((r) => (r as unknown as { files: { path: string }[] }).files);
    expect(files.map((f) => f.path)).toContain("reference/geometry.json");
  });

  test("build compiles tokens per theme, merged CSS, JS, catalog, specimen and skill", async () => {
    await makeSystem();
    await core.run("token.import", {
      system: "acme",
      tokens: [
        {
          name: "button.background",
          type: "color",
          cssVar: "--acme-button-background",
          values: { dark: "#0e639c", light: "#005fb8" },
          group: "button",
          description: "Button background.",
        },
        {
          name: "radius.large",
          type: "dimension",
          cssVar: "--acme-radius-large",
          value: "8px",
          group: "radius",
        },
      ],
    });
    await core.run("system.writeFile", {
      id: "acme",
      path: "base.css",
      content: '@font-face { font-family: icons; src: url("assets/icons.ttf"); }',
    });
    await core.run("system.writeFile", {
      id: "acme",
      path: "assets/icons.ttf",
      content: Buffer.from([1, 2, 3]).toString("base64"),
      encoding: "base64",
    });
    await expect(
      core.run("system.writeFile", { id: "acme", path: "dist/x.css", content: "" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await core.run("component.create", {
      system: "acme",
      name: "button",
      tag: "acme-button",
      title: "Button",
      requires: ["acme-root"],
      css: "/* @capture main.css@0.5 */\n.acme-button { background: var(--acme-button-background); color: var(--acme-undefined-token); }",
      js: "ds.define('acme-button', class extends ds.Element {});",
      examples: [{ title: "Default", html: "<acme-button>Go</acme-button>" }],
    });
    await core.run("component.create", {
      system: "acme",
      name: "badge",
      tag: "acme-badge",
      title: "Badge",
      hostDisplay: "inline-block",
    });

    const result = await core.run<{ warnings: string[]; css: { captured: number } }>(
      "system.build",
      { id: "acme" },
    );
    expect(result.css.captured).toBe(1);
    expect(result.warnings.join("\n")).toMatch(/--acme-undefined-token/);
    expect(result.warnings.join("\n")).toMatch(
      /<acme-button> requires <acme-root>, which is not defined/,
    );
    expect(result.warnings.join("\n")).toMatch(/<acme-badge> has no component.js/);

    const dist = path.join(root, ".design/systems/acme/dist");
    const css = await readFile(path.join(dist, "system.css"), "utf8");
    expect(css).toContain(":root {\n  --acme-radius-large: 8px;\n}");
    expect(css).toContain(".acme-root.vs-dark {\n  --acme-button-background: #0e639c;\n}");
    expect(css).toContain(".acme-root.vs {\n  --acme-button-background: #005fb8;\n}");
    expect(css).toContain("@font-face");
    expect(css).toContain(":where(acme-button) { display: block; }");
    expect(css).toContain(":where(acme-badge) { display: inline-block; }");
    expect(css).toContain("Acme UI — MIT");
    const js = await readFile(path.join(dist, "system.js"), "utf8");
    expect(js).toContain('"id":"acme"');
    expect(js).toContain("ds.define('acme-button'");
    const catalog = JSON.parse(await readFile(path.join(dist, "catalog.json"), "utf8"));
    expect(catalog.components.map((c: { tag: string }) => c.tag)).toEqual([
      "acme-badge",
      "acme-button",
    ]);
    expect(await readFile(path.join(dist, "assets/icons.ttf"))).toEqual(Buffer.from([1, 2, 3]));
    expect(await readFile(path.join(dist, "specimen.html"), "utf8")).toContain("dt-specimen-size");

    const skill = await readFile(path.join(root, ".design/systems/acme/skill/SKILL.md"), "utf8");
    expect(skill).toMatch(/^---\nname: acme-design-system\ndescription: /);
    expect(skill).toContain('<link rel="stylesheet" href="/s/acme/system.css" />');
    expect(skill).toContain("| `<acme-button>` |");
    const tokensMd = await readFile(
      path.join(root, ".design/systems/acme/skill/references/tokens.md"),
      "utf8",
    );
    expect(tokensMd).toContain(
      "| `--acme-button-background` | color | `#0e639c` | `#005fb8` | Button background. |",
    );

    const exported = await core.run<{ relative: string }>("system.exportSkill", {
      id: "acme",
      target: "github",
    });
    expect(exported.relative).toBe(path.join(".github", "skills", "acme-design-system"));
    expect(await readFile(path.join(root, exported.relative, "SKILL.md"), "utf8")).toContain(
      "name: acme-design-system",
    );
    expect(core.lastBuild("acme")).toMatchObject({ ok: true });

    const coverage = await core.run<{
      components: { byVerification: Record<string, number>; withoutExamples: string[] };
    }>("system.coverage", { id: "acme" });
    expect(coverage.components).toMatchObject({
      byVerification: { unverified: 2 },
      withoutExamples: ["acme-badge"],
    });
  });

  test("build pulls cssCaptures, scopes theme sheets per theme and widens host tags", async () => {
    await makeSystem();
    await core.run("system.update", {
      id: "acme",
      themeSheets: ["theme"],
      sheetOrder: ["main.css", "theme"],
    });
    await core.run("token.import", {
      system: "acme",
      tokens: [
        { name: "bg", type: "color", cssVar: "--acme-bg", values: { dark: "#000", light: "#fff" } },
      ],
    });
    const caps = path.join(root, ".design/systems/acme/captures");
    for (const [label, theme, index, color] of [
      ["bar-dark", "dark", 4, "#111"],
      ["bar-light", "light", 5, "#eee"],
    ] as const) {
      await mkdir(path.join(caps, label), { recursive: true });
      await writeFile(path.join(caps, label, "capture.json"), JSON.stringify({ label, theme }));
      await writeFile(
        path.join(caps, label, "rules.css"),
        `/*\n * Captured ${label}\n */\n\n/* @capture main.css@2 */\n.bar > li { flex: none; }\n\n/* @capture theme@${index} */\n.acme-root .bar { color: ${color}; }\n\n/* @capture theme@9 */\n.acme-root { --acme-bg: ${color}; }\n`,
      );
    }
    await core.run("component.create", {
      system: "acme",
      name: "bar",
      tag: "acme-bar",
      title: "Bar",
      cssCaptures: ["bar-dark", "bar-light", "missing"],
      examples: [{ title: "Bar", html: "<acme-bar></acme-bar>" }],
    });
    await core.run("component.create", {
      system: "acme",
      name: "item",
      tag: "acme-item",
      title: "Item",
      hostTag: "li",
    });
    const result = await core.run<{
      warnings: string[];
      css: { captured: number; duplicates: number };
    }>("system.build", { id: "acme" });
    expect(result.warnings.join("\n")).toContain('capture "missing" not found');
    expect(result.css).toMatchObject({ captured: 3, duplicates: 1 });
    const css = await readFile(path.join(root, ".design/systems/acme/dist/system.css"), "utf8");
    expect(css).toContain(".bar > :is(li, acme-item) { flex: none; }");
    expect(css).toContain(
      "/* @capture theme~dark@4 */\n.acme-root:where(.vs-dark) .bar { color: #111; }",
    );
    expect(css).toContain(
      "/* @capture theme~light@5 */\n.acme-root:where(.vs) .bar { color: #eee; }",
    );
    expect(css).not.toContain("--acme-bg: #111");
    expect(css).not.toContain("Captured bar-dark");
  });

  test("watcher reloads edited components and rebuilds", async () => {
    await makeSystem();
    await core.run("component.create", {
      system: "acme",
      name: "button",
      tag: "acme-button",
      title: "Button",
      js: "",
      css: ".x{}",
    });
    await core.startWatching();
    const events: CoreEvent[] = [];
    core.events.subscribe((e) => events.push(e));
    const file = path.join(root, ".design/systems/acme/components/button/component.json");
    const json = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...json, title: "Fancy Button" }));
    await expect
      .poll(() => core.systems.component("acme", "button").title, { timeout: 4000 })
      .toBe("Fancy Button");
    await expect
      .poll(() => events.some((e) => e.type === "system.changed" && e.data.built), {
        timeout: 4000,
      })
      .toBe(true);
    const css = await readFile(path.join(root, ".design/systems/acme/dist/system.css"), "utf8");
    expect(css).toContain(".x{}");

    // Captures and the activity log notify without reloading or rebuilding.
    events.length = 0;
    const capDir = path.join(root, ".design/systems/acme/captures/bar-dark");
    await mkdir(capDir, { recursive: true });
    await writeFile(path.join(capDir, "capture.json"), "{}");
    await core.systems.logActivity("acme", { kind: "capture", title: "Captured bar-dark" });
    await expect
      .poll(
        () =>
          events.some(
            (e) =>
              e.type === "system.changed" &&
              e.data.paths.includes("captures/bar-dark/capture.json") &&
              e.data.paths.includes("activity.jsonl"),
          ),
        { timeout: 4000 },
      )
      .toBe(true);
    await new Promise((r) => setTimeout(r, 400));
    expect(events.some((e) => e.type === "system.changed" && e.data.built)).toBe(false);
  });

  test("build skips components with syntax errors; contexts wrap tags that share a prefix", async () => {
    await makeSystem();
    await core.run("component.create", {
      system: "acme",
      name: "root",
      tag: "acme-root",
      kind: "context",
      title: "Root",
      js: "ds.define('acme-root', class extends ds.Element {});",
    });
    await core.run("component.create", {
      system: "acme",
      name: "list",
      tag: "acme-list",
      kind: "context",
      title: "List",
      requires: ["acme-root"],
      js: "ds.define('acme-list', class extends ds.Element {});",
    });
    await core.run("component.create", {
      system: "acme",
      name: "list-item",
      tag: "acme-list-item",
      title: "Item",
      requires: ["acme-root", "acme-list"],
      js: "ds.define('acme-list-item', class extends ds.Element { render() { return [ }});",
      examples: [{ title: "Item", html: "<acme-list-item></acme-list-item>" }],
    });
    const result = await core.run<{ warnings: string[] }>("system.build", { id: "acme" });
    expect(result.warnings.join("\n")).toContain(
      "<acme-list-item> component.js has a syntax error and was skipped",
    );
    const js = await readFile(path.join(root, ".design/systems/acme/dist/system.js"), "utf8");
    // The bundle still parses (vm.Script only compiles; it doesn't run).
    expect(() => new vm.Script(js)).not.toThrow();
    expect(js).toContain("ds.define('acme-list'");
    const got = await core.run<{ snippet: string }>("component.get", {
      system: "acme",
      name: "list-item",
    });
    expect(got.snippet).toContain("<acme-list>");
    expect(
      await readFile(path.join(root, ".design/systems/acme/dist/specimen.html"), "utf8"),
    ).toContain(String.raw`"[\\s>/]"`);
  });

  test("activity log records audit steps, newest first", async () => {
    await makeSystem();
    await core.run("token.import", {
      system: "acme",
      tokens: [{ name: "bg", type: "color", cssVar: "--acme-bg", group: "base" }],
    });
    await core.run("component.create", {
      system: "acme",
      name: "bar",
      tag: "acme-bar",
      title: "Bar",
      js: "",
    });
    await core.run("component.update", { system: "acme", name: "bar", description: "A bar." });
    await core.run("component.update", {
      system: "acme",
      name: "bar",
      verification: { status: "verified", checkedAt: new Date().toISOString() },
    });
    await core.run("system.build", { id: "acme" });
    await core.run("system.build", { id: "acme" });
    const { entries } = await core.run<{ entries: { kind: string; title: string }[] }>(
      "system.activity",
      { id: "acme" },
    );
    expect(entries.map((e) => `${e.kind}: ${e.title}`)).toEqual([
      "build: Built 1 components · system.css 0 KB",
      "component: Updated <acme-bar>",
      "component: Created <acme-bar>",
      "tokens: Imported 1 token",
      "system: Created design system Acme",
    ]);
    const listed = await core.run<{ captures: unknown[] }>("capture.list", { system: "acme" });
    expect(listed.captures).toEqual([]);
  });
});
