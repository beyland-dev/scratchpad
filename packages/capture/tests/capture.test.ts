import http from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { Core, initWorkspace } from "@design-tool/core";
import { startSandbox } from "@design-tool/server";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { captureCommands, closeBrowser, inferTokenType } from "../src/index.ts";

const APP_CSS = `
:root { --fg: rgb(17, 17, 17); --accent: rgb(0, 95, 184); --radius: 4px; }
.app { font: 13px/1.4 sans-serif; color: var(--fg); padding: 8px; }
.app .toolbar { display: flex; gap: 4px; padding: 2px; border: 1px solid var(--accent); border-left-color: var(--fg); border-radius: var(--radius); }
.app .toolbar > .item { padding: 2px 8px; border-radius: var(--radius); }
.app .toolbar > .item:hover { background: rgba(0, 0, 0, 0.1); }
.app .toolbar > .item.disabled { opacity: 0.4; }
.app .toolbar > .item::before { content: "•"; margin-right: 4px; }
.unrelated { color: red; }
`;

const APP_HTML = `<!doctype html><html><head><style>${APP_CSS}</style><title>Fixture</title></head>
<body><div class="app"><div class="toolbar"><div class="item disabled">Cut</div><div class="item">Paste</div></div><p class="unrelated">x</p></div></body></html>`;

let fixture: http.Server;
let fixtureUrl: string;
let root: string;
let core: Core;
let sandbox: { url: string; close(): Promise<void> };

beforeAll(async () => {
  fixture = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(APP_HTML);
  });
  await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  fixtureUrl = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}/`;

  root = await mkdtemp(path.join(tmpdir(), "dt-capture-"));
  await initWorkspace(root, { name: "Capture", example: false });
  core = await Core.open({ root, commands: captureCommands });
  sandbox = await startSandbox({ core });
  core.setSandboxProvider(async () => sandbox.url);
  await core.run("system.create", {
    id: "ex",
    name: "Example",
    prefix: "ex",
    rootContext: "ex-app",
    themes: [{ id: "light", label: "Light", kind: "light" }],
  });
});

afterAll(async () => {
  await closeBrowser();
  await sandbox?.close();
  await core?.close();
  await new Promise((resolve) => fixture.close(resolve));
  await rm(root, { recursive: true, force: true });
});

test("token type inference", () => {
  expect(inferTokenType("--x-bg", "#fff")).toBe("color");
  expect(inferTokenType("--x-bg", "rgba(0, 0, 0, 0.5)")).toBe("color");
  expect(inferTokenType("--x-radius", "4px")).toBe("dimension");
  expect(inferTokenType("--x-font-size", "13px")).toBe("fontSize");
  expect(inferTokenType("--x-duration", "150ms")).toBe("duration");
  expect(inferTokenType("--x-font-family", 'system-ui, "Ubuntu", sans-serif')).toBe("fontFamily");
  expect(inferTokenType("--x-thing", "auto")).toBe("other");
});

describe("capture", () => {
  test("outline lists the DOM with classes and sizes", async () => {
    const out = await core.run<{ outline: string }>("capture.outline", {
      target: { url: fixtureUrl },
      selector: ".app",
    });
    expect(out.outline).toMatch(/div\.app \d+×\d+/);
    expect(out.outline).toContain('div.item.disabled "Cut"');
  });

  test("element capture keeps only matching rules, including state and pseudo variants", async () => {
    const out = await core.run<{ rules: number; files: string[]; dir: string; images: unknown[] }>(
      "capture.element",
      {
        target: { url: fixtureUrl },
        selector: ".toolbar",
        system: "ex",
        label: "toolbar",
        theme: "light",
      },
    );
    expect(out.files).toEqual(
      expect.arrayContaining([
        "capture.json",
        "dom.html",
        "rules.css",
        "geometry.json",
        "screenshot.png",
      ]),
    );
    expect(out.images).toHaveLength(1);
    const css = await readFile(path.join(root, out.dir, "rules.css"), "utf8");
    expect(css).toContain("@capture");
    expect(css).toContain(".app .toolbar > .item:hover");
    expect(css).toContain(".app .toolbar > .item.disabled");
    expect(css).toContain("::before");
    expect(css).not.toContain(".unrelated");
    // A var() shorthand with an overridden longhand is recovered from the source text.
    expect(css).toContain("border: 1px solid var(--accent)");
    expect(css).toContain("border-left-color: var(--fg)");
    expect(css).not.toMatch(/:\s*;/);
    const meta = JSON.parse(await readFile(path.join(root, out.dir, "capture.json"), "utf8"));
    expect(meta).toMatchObject({
      selector: ".toolbar",
      theme: "light",
      vars: { "--accent": "rgb(0, 95, 184)", "--radius": "4px" },
    });
    expect(meta.ancestors[0].classes).toBe("app");
  });

  test("tokens capture imports runtime variables per theme", async () => {
    const out = await core.run<{ added: number }>("capture.tokens", {
      target: { url: fixtureUrl },
      selector: ":root",
      prefix: "--",
      system: "ex",
      theme: "light",
    });
    expect(out.added).toBe(3);
    const accent = (await core.systems.tokens("ex")).find((t) => t.cssVar === "--accent");
    expect(accent).toMatchObject({
      name: "accent",
      type: "color",
      values: { light: "rgb(0, 95, 184)" },
    });
  });

  test("components built from the capture verify against it, and drift is detected", async () => {
    const css = await readFile(
      path.join(root, ".design/systems/ex/captures/toolbar/rules.css"),
      "utf8",
    );
    // The context's own styles (font, color, padding) are captured from the context element; unrelated descendants are excluded.
    await core.run("capture.element", {
      target: { url: fixtureUrl },
      selector: ".app",
      system: "ex",
      label: "app",
      exclude: [".unrelated"],
      screenshot: false,
    });
    const appCss = await readFile(
      path.join(root, ".design/systems/ex/captures/app/rules.css"),
      "utf8",
    );
    expect(appCss).not.toContain(".unrelated");
    await core.run("component.create", {
      system: "ex",
      name: "app",
      tag: "ex-app",
      kind: "context",
      title: "App",
      css: appCss,
      js: "class App extends ds.Element { static hostClass = 'app'; static props = ['theme']; updated() { ds.applyTheme(this, this.attr('theme', ds.system.defaultTheme)); } }\nds.define('ex-app', App);",
    });
    await core.run("component.create", {
      system: "ex",
      name: "item",
      tag: "ex-item",
      title: "Item",
      requires: ["ex-app", "ex-toolbar"],
      js: "class Item extends ds.Element { static hostClass = 'item'; static props = ['disabled']; render() { this.setClasses({ disabled: this.flag('disabled') }); return this.slotted(''); } }\nds.define('ex-item', Item);",
    });
    await core.run("component.create", {
      system: "ex",
      name: "toolbar",
      tag: "ex-toolbar",
      title: "Toolbar",
      requires: ["ex-app"],
      css,
      js: "class Toolbar extends ds.Element { static hostClass = 'toolbar'; render() { return this.slotted(''); } }\nds.define('ex-toolbar', Toolbar);",
      examples: [
        {
          title: "Cut and paste",
          html: "<ex-toolbar><ex-item disabled>Cut</ex-item><ex-item>Paste</ex-item></ex-toolbar>",
        },
        {
          title: "Wrong state",
          html: "<ex-toolbar><ex-item>Cut</ex-item><ex-item>Paste</ex-item></ex-toolbar>",
        },
      ],
      references: [{ capture: "toolbar" }],
    });

    const ok = await core.run<{
      status: string;
      compared: number;
      summary: string[];
      images: unknown[];
    }>("capture.verify", { system: "ex", component: "toolbar" });
    expect(ok.summary).toEqual([]);
    expect(ok).toMatchObject({ status: "verified" });
    expect(ok.compared).toBe(3);
    expect(ok.images).toHaveLength(1);
    expect(core.systems.component("ex", "toolbar").verification).toMatchObject({
      status: "verified",
      diffs: 0,
    });

    await core.run("component.update", {
      system: "ex",
      name: "toolbar",
      references: [{ capture: "toolbar", example: 1 }],
    });
    const drift = await core.run<{ status: string; summary: string[] }>("capture.verify", {
      system: "ex",
      component: "toolbar",
    });
    expect(drift.status).toBe("drift");
    // The state class is part of the element path, so the un-disabled item shows up as missing.
    expect(drift.summary.join("\n")).toContain("missing: disabled.item");
  });

  test("component and prototype screenshots", async () => {
    const shot = await core.run<{ images: { mimeType: string; data: string }[] }>(
      "component.screenshot",
      { system: "ex", name: "toolbar" },
    );
    expect(shot.images[0]!.mimeType).toBe("image/png");
    expect(Buffer.from(shot.images[0]!.data, "base64").subarray(1, 4).toString()).toBe("PNG");
    await core.prototypes.create({ title: "Shot", html: "<h1>Hello</h1>" });
    const proto = await core.run<{ saved: string; images: unknown[] }>("prototype.screenshot", {
      id: "shot",
      width: 400,
      height: 300,
      save: "shots/a.png",
    });
    expect(proto.saved).toBe("shots/a.png");
    expect((await core.prototypes.listFiles("shot")).map((f) => f.path)).toContain("shots/a.png");
  });
});
