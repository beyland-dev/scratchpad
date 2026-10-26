import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  Core,
  CoreError,
  familyOf,
  groupFamilies,
  initWorkspace,
  safeJoin,
  slugify,
  versionLabel,
  type CoreEvent,
} from "../src/index.ts";

let root: string;
let core: Core;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dt-core-"));
  await initWorkspace(root, { name: "Test" });
  core = await Core.open({ root });
});

afterEach(async () => {
  await core.close();
  await rm(root, { recursive: true, force: true });
});

describe("utilities", () => {
  test("slugify", () => {
    expect(slugify("Checkout — Single Page!")).toBe("checkout-single-page");
    expect(slugify("   ")).toBe("untitled");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });

  test("safeJoin rejects traversal and absolute paths", () => {
    expect(safeJoin("/base", "a/b.html")).toBe(path.resolve("/base/a/b.html"));
    expect(() => safeJoin("/base", "../x")).toThrow(CoreError);
    expect(() => safeJoin("/base", "a/../../x")).toThrow(CoreError);
    expect(() => safeJoin("/base", "/etc/passwd")).toThrow(CoreError);
    expect(() => safeJoin("/base", ".")).toThrow(CoreError);
  });
});

describe("workspace", () => {
  test("init creates config, guide, and example prototype", async () => {
    const config = JSON.parse(await readFile(path.join(root, ".design/workspace.json"), "utf8"));
    expect(config).toMatchObject({ version: 1, name: "Test", sources: [] });
    expect(await readFile(path.join(root, ".design/AGENTS.md"), "utf8")).toContain(
      "design-tool workspace",
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(".design/AGENTS.md");
    expect(core.prototypes.list().map((p) => p.id)).toEqual(["welcome"]);
  });

  test("init refuses to overwrite an existing workspace", async () => {
    await expect(initWorkspace(root)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("open fails without a workspace", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "dt-empty-"));
    await expect(Core.open({ root: empty })).rejects.toMatchObject({ code: "NO_WORKSPACE" });
    await rm(empty, { recursive: true });
  });

  test("source.add infers kind, name, and id", async () => {
    const local = await core.run<{
      source: { id: string; kind: string; resolvedLocation: string };
    }>("source.add", {
      location: "../my-app",
    });
    expect(local.source).toMatchObject({
      id: "my-app",
      kind: "local",
      resolvedLocation: path.resolve(root, "../my-app"),
    });
    const git = await core.run<{ source: { id: string; kind: string } }>("source.add", {
      location: "https://github.com/acme/my-app.git",
    });
    expect(git.source).toMatchObject({ id: "my-app-2", kind: "git" });
    const listed = await core.run<{ sources: { id: string; available?: boolean }[] }>(
      "source.list",
    );
    expect(listed.sources.map((s) => [s.id, s.available])).toEqual([
      ["my-app", false],
      ["my-app-2", undefined],
    ]);
    await core.run("source.remove", { id: "my-app" });
    expect(core.workspace.config.sources.map((s) => s.id)).toEqual(["my-app-2"]);
  });
});

describe("prototypes", () => {
  test("create with html writes files and metadata", async () => {
    const { prototype } = await core.run<{
      prototype: { id: string; urls: { viewer: string; raw: string } };
    }>("prototype.create", {
      title: "Checkout Flow",
      html: "<h1>Hi</h1>",
      group: "checkout",
      tags: ["a"],
    });
    expect(prototype.id).toBe("checkout-flow");
    expect(prototype.urls.viewer).toBe("http://127.0.0.1:7420/p/checkout-flow");
    expect(prototype.urls.raw).toBe("http://127.0.0.1:7421/p/checkout-flow/index.html");
    const dir = path.join(root, ".design/prototypes/checkout-flow");
    expect(await readFile(path.join(dir, "index.html"), "utf8")).toBe("<h1>Hi</h1>");
    const meta = JSON.parse(await readFile(path.join(dir, "prototype.json"), "utf8"));
    expect(meta).toMatchObject({
      title: "Checkout Flow",
      status: "draft",
      group: "checkout",
      tags: ["a"],
      entry: "index.html",
    });
  });

  test("create without files writes a placeholder entry; ids are unique", async () => {
    const a = await core.prototypes.create({ title: "Same" });
    const b = await core.prototypes.create({ title: "Same" });
    expect([a.id, b.id]).toEqual(["same", "same-2"]);
    expect(a.issues).toBeUndefined();
    const file = await core.prototypes.readFile("same", "index.html");
    expect(file.content).toContain("<title>Same</title>");
  });

  test("explicit id conflicts are rejected", async () => {
    await expect(core.prototypes.create({ title: "x", id: "welcome" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("writeFile and readFile with binary content and path guards", async () => {
    await core.prototypes.create({ title: "Files", html: "<p>x</p>" });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    await core.run("prototype.writeFile", {
      id: "files",
      path: "img/dot.png",
      content: png,
      encoding: "base64",
    });
    const read = await core.prototypes.readFile("files", "img/dot.png");
    expect(read).toMatchObject({ encoding: "base64", content: png, size: 4 });
    await expect(core.prototypes.writeFile("files", "../escape.html", "x")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(core.prototypes.writeFile("files", "prototype.json", "{}")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const files = await core.prototypes.listFiles("files");
    expect(files.map((f) => f.path)).toEqual(["img/dot.png", "index.html"]);
  });

  test("update patches and clears fields", async () => {
    await core.prototypes.create({ title: "Upd", group: "g", description: "d" });
    const updated = await core.prototypes.update("upd", {
      status: "review",
      group: null,
      description: null,
      tags: ["t"],
    });
    expect(updated).toMatchObject({ status: "review", tags: ["t"] });
    expect(updated.group).toBeUndefined();
    expect(updated.description).toBeUndefined();
    await expect(core.prototypes.update("upd", { variantOf: "upd" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  test("variants copy files and form a family", async () => {
    await core.prototypes.create({ title: "Base", html: "<p>base</p>", group: "g" });
    const v2 = await core.prototypes.createVariant("base");
    const v3 = await core.prototypes.createVariant(v2.id, { title: "Third" });
    expect(v2).toMatchObject({
      id: "base-v2",
      variantOf: "base",
      group: "g",
      title: "Base (variant 2)",
    });
    expect(v3).toMatchObject({ variantOf: "base-v2", title: "Third" });
    expect((await core.prototypes.readFile(v3.id, "index.html")).content).toBe("<p>base</p>");
    expect(core.prototypes.family(v3.id).map((p) => p.id)).toEqual(["base", "base-v2", v3.id]);
  });

  test("delete moves to trash", async () => {
    const result = await core.run<{ trashedTo: string }>("prototype.delete", { id: "welcome" });
    expect(result.trashedTo).toMatch(/^\.design\/\.trash\/welcome-\d+$/);
    expect(core.prototypes.has("welcome")).toBe(false);
  });

  test("folders written by hand are picked up with inferred or salvaged metadata", async () => {
    const dir = path.join(root, ".design/prototypes/Hand_Made");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), "<title>From Title Tag</title>");
    const bad = path.join(root, ".design/prototypes/bad-meta");
    await mkdir(bad, { recursive: true });
    await writeFile(
      path.join(bad, "prototype.json"),
      JSON.stringify({ title: "Kept", status: "nope" }),
    );
    await core.prototypes.load();

    expect(core.prototypes.get("Hand_Made")).toMatchObject({
      title: "From Title Tag",
      status: "draft",
    });
    const salvaged = core.prototypes.get("bad-meta");
    expect(salvaged).toMatchObject({ title: "Kept", status: "draft" });
    expect(salvaged.issues?.join("\n")).toMatch(/status/);
    expect(salvaged.issues?.join("\n")).toMatch(/Entry file index.html not found/);
  });

  test("list filters", async () => {
    await core.prototypes.create({ title: "One", group: "g", tags: ["x"] });
    await core.prototypes.create({ title: "Two", status: "review" });
    expect(core.prototypes.list({ group: "g" }).map((p) => p.id)).toEqual(["one"]);
    expect(core.prototypes.list({ tag: "x" }).map((p) => p.id)).toEqual(["one"]);
    expect(core.prototypes.list({ status: "review" }).map((p) => p.id)).toEqual(["two"]);
    expect(core.prototypes.list({ search: "TWO" }).map((p) => p.id)).toEqual(["two"]);
  });
});

describe("registry", () => {
  test("validates input with readable errors", async () => {
    await expect(core.run("prototype.create", { title: "" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(core.run("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(core.run("prototype.get", { id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("describe exposes JSON schemas", () => {
    const create = core.registry.describe().find((c) => c.name === "prototype.create");
    expect(create?.kind).toBe("mutation");
    expect(create?.inputSchema).toMatchObject({ type: "object", required: ["title"] });
  });
});

describe("watcher", () => {
  test("external edits refresh the index and emit events", async () => {
    await core.startWatching();
    const events: CoreEvent[] = [];
    core.events.subscribe((e) => events.push(e));

    const dir = path.join(root, ".design/prototypes/external");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), "<title>External</title>");

    await expect.poll(() => core.prototypes.has("external"), { timeout: 3000 }).toBe(true);
    await expect
      .poll(() => events.find((e) => e.type === "prototype.changed" && e.data.id === "external"), {
        timeout: 3000,
      })
      .toMatchObject({ data: { exists: true } });

    await rm(dir, { recursive: true });
    await expect.poll(() => core.prototypes.has("external"), { timeout: 3000 }).toBe(false);
  });
});

describe("variant families", () => {
  const p = (id: string, createdAt: string, variantOf?: string) => ({
    id,
    createdAt,
    ...(variantOf ? { variantOf } : {}),
  });

  test("groups by root and orders oldest → newest", () => {
    const items = [
      p("b-v3", "2026-01-03", "b-v2"),
      p("solo", "2026-01-05"),
      p("b", "2026-01-01"),
      p("b-v2", "2026-01-02", "b"),
      p("b-alt", "2026-01-04", "b"),
      p("orphan", "2026-01-06", "missing"),
    ];
    const families = groupFamilies(items).map((f) => f.map((x) => x.id));
    expect(families).toEqual([["b", "b-v2", "b-v3", "b-alt"], ["solo"], ["orphan"]]);
    expect(familyOf(items, "b-v3").map((x) => x.id)).toEqual(["b", "b-v2", "b-v3", "b-alt"]);
    expect(familyOf(items, "nope")).toEqual([]);
  });

  test("survives variantOf cycles", () => {
    const items = [p("x", "2026-01-01", "y"), p("y", "2026-01-02", "x")];
    expect(groupFamilies(items).map((f) => f.length)).toEqual([2]);
  });

  test("labels versions V1, V2, … Latest", () => {
    expect([0, 1, 2].map((i) => versionLabel(i, 3))).toEqual(["V1", "V2", "Latest"]);
    expect(versionLabel(0, 1)).toBe("V1");
  });
});
