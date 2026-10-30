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
  root = await mkdtemp(path.join(tmpdir(), "sp-core-"));
  await initWorkspace(root, { project: "Test" });
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
  test("init creates config, guide, a project with its .gitignore, and the example", async () => {
    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf8"));
    expect(config).toEqual({ version: 2, sources: [] });
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("# Sprue");
    expect(await readFile(path.join(root, "projects/test/.gitignore"), "utf8")).toContain(
      "systems/*/node_modules/",
    );
    expect(core.prototypes.list().map((p) => [p.project, p.id])).toEqual([["test", "welcome"]]);
  });

  test("init refuses to overwrite an existing project", async () => {
    await expect(initWorkspace(root, { project: "Test" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("opening a missing workspace creates it", async () => {
    const empty = path.join(await mkdtemp(path.join(tmpdir(), "sp-empty-")), "home");
    const fresh = await Core.open({ root: empty });
    expect(fresh.projects.list()).toEqual([]);
    expect(JSON.parse(await readFile(path.join(empty, "config.json"), "utf8"))).toEqual({
      version: 2,
      sources: [],
    });
    await expect(fresh.run("prototype.create", { title: "x" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await fresh.close();
    await rm(path.dirname(empty), { recursive: true });
  });

  test("source.add infers kind, name, and id", async () => {
    const local = await core.run<{
      source: { id: string; kind: string; location: string; resolvedLocation: string };
    }>("source.add", {
      location: "../my-app",
    });
    expect(local.source).toMatchObject({
      id: "my-app",
      kind: "local",
      location: path.resolve("../my-app"),
      resolvedLocation: path.resolve("../my-app"),
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
    expect(prototype.urls.viewer).toBe("http://127.0.0.1:7420/projects/test/p/checkout-flow");
    expect(prototype.urls.raw).toBe(
      "http://127.0.0.1:7421/projects/test/prototypes/checkout-flow/index.html",
    );
    const dir = path.join(root, "projects/test/prototypes/checkout-flow");
    expect(await readFile(path.join(dir, "index.html"), "utf8")).toBe("<h1>Hi</h1>");
    const meta = JSON.parse(await readFile(path.join(dir, "prototype.json"), "utf8"));
    expect(meta.project).toBeUndefined();
    expect(meta).toMatchObject({
      title: "Checkout Flow",
      status: "draft",
      group: "checkout",
      tags: ["a"],
      entry: "index.html",
    });
  });

  test("create without files writes a placeholder entry; ids are unique", async () => {
    const a = await core.prototypes.create("test", { title: "Same" });
    const b = await core.prototypes.create("test", { title: "Same" });
    expect([a.id, b.id]).toEqual(["same", "same-2"]);
    expect(a.issues).toBeUndefined();
    const file = await core.prototypes.readFile("same", "index.html");
    expect(file.content).toContain("<title>Same</title>");
  });

  test("explicit id conflicts are rejected", async () => {
    await expect(
      core.prototypes.create("test", { title: "x", id: "welcome" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("writeFile and readFile with binary content and path guards", async () => {
    await core.prototypes.create("test", { title: "Files", html: "<p>x</p>" });
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
    await core.prototypes.create("test", { title: "Upd", group: "g", description: "d" });
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
    await core.prototypes.create("test", { title: "Base", html: "<p>base</p>", group: "g" });
    const v2 = await core.prototypes.createVariant("base");
    const v3 = await core.prototypes.createVariant(v2.id, { description: "Third" });
    const v4 = await core.prototypes.createVariant(v3.id);
    // Versions share the family's name; they're told apart as V1, V2, … Latest.
    expect(v2).toMatchObject({ id: "base-v2", variantOf: "base", group: "g", title: "Base" });
    expect(v3).toMatchObject({ id: "base-v3", variantOf: "base-v2", title: "Base" });
    expect(v3.description).toBe("Third");
    // Forks of forks are still named after the family's original.
    expect(v4).toMatchObject({ id: "base-v4", variantOf: "base-v3", title: "Base" });
    expect((await core.prototypes.readFile(v3.id, "index.html")).content).toBe("<p>base</p>");
    expect(core.prototypes.family(v3.id).map((p) => p.id)).toEqual([
      "base",
      "base-v2",
      "base-v3",
      "base-v4",
    ]);

    // Renaming any version renames the family, without touching the others' edit times.
    const before = core.prototypes.get("base").updatedAt;
    await core.run("prototype.update", { id: v3.id, title: "Renamed" });
    expect(core.prototypes.family("base").map((p) => p.title)).toEqual(Array(4).fill("Renamed"));
    expect(core.prototypes.get("base").updatedAt).toBe(before);

    // Joining a family takes on its name.
    await core.prototypes.create("test", { title: "Stray", html: "<p>stray</p>" });
    await core.run("prototype.update", { id: "stray", variantOf: "base" });
    expect(core.prototypes.get("stray").title).toBe("Renamed");
  });

  test("delete moves to the project's trash", async () => {
    const result = await core.run<{ trashedTo: string }>("prototype.delete", { id: "welcome" });
    expect(result.trashedTo).toMatch(/^projects\/test\/\.trash\/prototype-welcome-\d+$/);
    expect(core.prototypes.has("welcome")).toBe(false);
  });

  test("folders written by hand are picked up with inferred or salvaged metadata", async () => {
    const dir = path.join(root, "projects/test/prototypes/Hand_Made");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), "<title>From Title Tag</title>");
    const bad = path.join(root, "projects/test/prototypes/bad-meta");
    await mkdir(bad, { recursive: true });
    await writeFile(
      path.join(bad, "prototype.json"),
      JSON.stringify({ title: "Kept", status: "nope" }),
    );
    await core.projects.load();

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
    await core.prototypes.create("test", { title: "One", group: "g", tags: ["x"] });
    await core.prototypes.create("test", { title: "Two", status: "review" });
    expect(core.prototypes.list({ group: "g" }).map((p) => p.id)).toEqual(["one"]);
    expect(core.prototypes.list({ tag: "x" }).map((p) => p.id)).toEqual(["one"]);
    expect(core.prototypes.list({ status: "review" }).map((p) => p.id)).toEqual(["two"]);
    expect(core.prototypes.list({ search: "TWO" }).map((p) => p.id)).toEqual(["two"]);
  });
});

describe("projects", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';

  test("init creates a default project holding the example", () => {
    expect(core.projects.list().map((p) => [p.id, p.name])).toEqual([["test", "Test"]]);
    expect(core.prototypes.get("welcome").project).toBe("test");
  });

  test("create, update and delete with color and icon", async () => {
    const { project } = await core.run<{
      project: { id: string; icon?: string; urls: { icon?: string } };
    }>("project.create", {
      name: "Web App",
      color: "#112233",
      icon: { format: "svg", content: SVG },
    });
    expect(project).toMatchObject({ id: "web-app", icon: "icon.svg" });
    expect(project.urls.icon).toMatch(/\/projects\/web-app\/~icon\?v=/);
    expect(await readFile(core.projects.iconPathOf("web-app")!, "utf8")).toContain("<svg");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
    await core.run("project.update", {
      id: "web-app",
      name: "Web",
      color: null,
      icon: { format: "png", content: png },
    });
    expect(core.projects.get("web-app")).toMatchObject({ name: "Web", icon: "icon.png" });
    expect(core.projects.get("web-app").color).toBeUndefined();
    await core.run("project.update", { id: "web-app", icon: null });
    expect(core.projects.get("web-app").icon).toBeUndefined();

    await expect(
      core.run("project.create", { name: "Bad", icon: { format: "svg", content: "<p>no</p>" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await core.projects.load();
    expect(core.projects.has("bad")).toBe(false);

    // A rejected icon update keeps the current icon.
    await core.run("project.update", { id: "web-app", icon: { format: "svg", content: SVG } });
    await expect(
      core.run("project.update", { id: "web-app", icon: { format: "svg", content: "nope" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(core.projects.get("web-app").icon).toBe("icon.svg");

    // Editing the icon file directly changes its URL, so the app refetches it.
    const before = core.projectUrls("web-app").icon;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeFile(core.projects.iconPathOf("web-app")!, SVG.replace("<rect", "<circle"));
    await core.projects.reloadOne("web-app");
    expect(core.projectUrls("web-app").icon).not.toBe(before);
    await expect(core.run("project.create", { name: "x", id: "web-app" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const result = await core.run<{ trashedTo: string }>("project.delete", { id: "web-app" });
    expect(result.trashedTo).toMatch(/^\.trash\/project-web-app-\d+$/);
    expect(core.projects.has("web-app")).toBe(false);
  });

  test("new prototypes and systems default to the only project", async () => {
    const one = await core.run<{ prototype: { project?: string } }>("prototype.create", {
      title: "One",
    });
    expect(one.prototype.project).toBe("test");
    await core.run("system.create", { id: "ds", name: "DS", prefix: "ds" });
    expect(core.systems.get("ds").project).toBe("test");
    expect(
      await readFile(path.join(root, "projects/test/systems/ds/system.json"), "utf8"),
    ).not.toContain('"project"');

    await core.run("project.create", { name: "Second" });
    await expect(core.run("prototype.create", { title: "Ambiguous" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(
      core.run("prototype.create", { title: "Typo", project: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("ids are unique per project; project/id disambiguates", async () => {
    await core.run("project.create", { name: "Second" });
    await core.run("prototype.create", { title: "Welcome", project: "second" });
    expect(core.prototypes.get("second/welcome").project).toBe("second");
    await expect(core.run("prototype.get", { id: "welcome" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("second/welcome, test/welcome"),
    });
    const { prototype } = await core.run<{ prototype: { project: string; id: string } }>(
      "prototype.get",
      { id: "second/welcome" },
    );
    expect(prototype).toMatchObject({ project: "second", id: "welcome" });
    await core.run("prototype.update", { id: "test/welcome", status: "review" });
    expect(core.prototypes.get("test/welcome").status).toBe("review");
    expect(core.prototypes.get("second/welcome").status).toBe("draft");
    await expect(core.run("prototype.get", { id: "nope/welcome" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Unique ids still work without the project.
    await core.run("prototype.create", { title: "Only Here", project: "second" });
    expect(core.prototypes.get("only-here").project).toBe("second");
  });

  test("prototypes resolve the design system they use (field, HTML reference, project)", async () => {
    type Out = { prototype: { id: string; resolvedSystem?: string } };
    const resolved = async (id: string) =>
      (await core.run<Out>("prototype.get", { id })).prototype.resolvedSystem;
    // No system in the project yet.
    expect(await resolved("welcome")).toBeUndefined();

    // The project's only design system.
    await core.run("system.create", { id: "ds", name: "DS", prefix: "ds" });
    expect(await resolved("welcome")).toBe("ds");

    // With several, the one the entry HTML loads wins.
    await core.run("system.create", { id: "other-ds", name: "Other", prefix: "ot" });
    expect(await resolved("welcome")).toBeUndefined();
    const linked = await core.run<Out>("prototype.create", {
      title: "Linked",
      html: '<link rel="stylesheet" href="../../systems/other-ds/system.css" /><script src="../../systems/other-ds/system.js"></script>',
    });
    expect(linked.prototype.resolvedSystem).toBe("other-ds");

    // An explicit `system` wins over both, and null goes back to inferring it.
    await core.run("prototype.update", { id: linked.prototype.id, system: "ds" });
    expect(core.prototypes.get(linked.prototype.id).system).toBe("ds");
    expect(await resolved(linked.prototype.id)).toBe("ds");
    await core.run("prototype.update", { id: linked.prototype.id, system: null });
    expect(core.prototypes.get(linked.prototype.id).system).toBeUndefined();
    expect(await resolved(linked.prototype.id)).toBe("other-ds");
    await expect(
      core.run("prototype.update", { id: linked.prototype.id, system: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Editing the entry HTML updates the inferred system.
    await core.run("prototype.writeFile", {
      id: linked.prototype.id,
      path: "index.html",
      content: '<script type="module" src="../../systems/ds/system.js"></script>',
    });
    expect(await resolved(linked.prototype.id)).toBe("ds");
  });

  test("prototypes move between projects (their folder moves); lists filter by project", async () => {
    await core.run("project.create", { name: "Other" });
    await core.run("system.create", { id: "ds", name: "DS", prefix: "ds", project: "test" });
    const base = await core.prototypes.createVariant("welcome");
    await core.run("prototype.update", { id: base.id, system: "ds" });
    await core.run("prototype.update", { id: base.id, project: "other", status: "review" });
    const moved = core.prototypes.get(`other/${base.id}`);
    // Links that don't hold in the other project are dropped.
    expect(moved).toMatchObject({ project: "other", status: "review" });
    expect(moved.variantOf).toBeUndefined();
    expect(moved.system).toBeUndefined();
    expect(
      await readFile(path.join(root, "projects/other/prototypes", base.id, "index.html"), "utf8"),
    ).toContain("Welcome");
    expect(core.prototypes.list({ project: "test" }).map((p) => p.id)).toEqual(["welcome"]);
    await expect(
      core.run("prototype.update", { id: "welcome", project: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await core.run("prototype.create", { title: "Welcome", project: "other" });
    await expect(
      core.run("prototype.update", { id: "test/welcome", project: "other" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const listed = await core.run<{ systems: { id: string; project: string }[] }>("system.list", {
      project: "test",
    });
    expect(listed.systems.map((s) => [s.project, s.id])).toEqual([["test", "ds"]]);

    const { projects } = await core.run<{
      projects: { id: string; prototypes: number; systems: number }[];
    }>("project.list");
    expect(projects).toEqual([
      expect.objectContaining({ id: "other", prototypes: 2, systems: 0 }),
      expect.objectContaining({ id: "test", prototypes: 1, systems: 1 }),
    ]);
    const info = await core.run<{ projects: { id: string }[] }>("workspace.info");
    expect(info.projects.map((p) => p.id)).toEqual(["other", "test"]);
  });

  test("design systems and components are deleted to the trash", async () => {
    await core.run("system.create", { id: "ds", name: "DS", prefix: "ds" });
    await core.run("component.create", { system: "ds", name: "x", tag: "ds-x", title: "X" });
    const removed = await core.run<{ trashedTo: string }>("component.remove", {
      system: "ds",
      name: "x",
    });
    expect(removed.trashedTo).toMatch(/^projects\/test\/\.trash\/component-ds-x-\d+$/);
    expect(core.systems.components("ds")).toEqual([]);
    const deleted = await core.run<{ trashedTo: string }>("system.delete", { id: "ds" });
    expect(deleted.trashedTo).toMatch(/^projects\/test\/\.trash\/system-ds-\d+$/);
    expect(core.systems.has("ds")).toBe(false);
  });

  test("folders written by hand are picked up, and the watcher reports changes", async () => {
    await core.startWatching();
    const events: CoreEvent[] = [];
    core.events.subscribe((e) => events.push(e));
    const dir = path.join(root, "projects/hand-made");
    await mkdir(path.join(dir, "prototypes/cloned"), { recursive: true });
    await writeFile(path.join(dir, "prototypes/cloned/index.html"), "<title>Cloned</title>");
    await writeFile(path.join(dir, "icon.svg"), SVG);

    await expect.poll(() => core.projects.has("hand-made"), { timeout: 3000 }).toBe(true);
    expect(core.projects.get("hand-made")).toMatchObject({
      name: "Hand Made",
      icon: "icon.svg",
      issues: ["Missing project.json"],
    });
    await expect
      .poll(() => events.find((e) => e.type === "project.changed" && e.data.id === "hand-made"), {
        timeout: 3000,
      })
      .toMatchObject({ data: { exists: true } });
    // A project folder that appears (e.g. a clone) comes with its contents.
    await expect.poll(() => core.prototypes.has("hand-made/cloned"), { timeout: 3000 }).toBe(true);
  });
});

describe("package design systems", () => {
  const THEME = `@import "tailwindcss";
@theme inline { --color-primary: var(--primary); }
:root { --radius: 0.75rem; --primary: oklch(0.54 0.25 293); --background: #fff; }
.dark { --primary: oklch(0.7 0.18 293); --background: #000; }
@layer base { body { background: var(--background); } }
`;

  test("create scaffolds a Vite + React project and needs no tag prefix", async () => {
    await core.run("system.create", {
      id: "acme-ui",
      name: "Acme UI",
      kind: "package",
      library: { name: "shadcn/ui", package: "shadcn", docsUrl: "https://ui.shadcn.com/docs" },
    });
    const system = core.systems.get("acme-ui");
    expect(system).toMatchObject({ kind: "package", framework: "react", styles: "src/index.css" });
    expect(system.themes.map((t) => [t.id, t.classes])).toEqual([
      ["light", ""],
      ["dark", "dark"],
    ]);
    const dir = core.systems.dirOf("acme-ui");
    for (const f of ["package.json", "vite.config.ts", "tsconfig.json", "src/index.css"])
      expect(await readFile(path.join(dir, f), "utf8")).toBeTruthy();
    expect(await readFile(path.join(dir, ".gitignore"), "utf8")).toContain("node_modules/");
    await expect(
      core.run("system.create", { id: "cap", name: "Cap", kind: "captured" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("tokens come from the theme stylesheet, per theme, merged with tokens.json", async () => {
    await core.run("system.create", { id: "acme-ui", name: "Acme UI", kind: "package" });
    await core.run("system.writeFile", { id: "acme-ui", path: "src/index.css", content: THEME });
    await core.projects.scope("test").systems.reloadSystem("acme-ui");
    await core.run("token.import", {
      system: "acme-ui",
      tokens: [{ name: "primary", type: "color", cssVar: "--primary", description: "Brand" }],
    });
    const tokens = await core.systems.tokens("acme-ui");
    expect(tokens.map((t) => t.cssVar)).toEqual(["--background", "--primary", "--radius"]);
    expect(tokens.find((t) => t.cssVar === "--primary")).toMatchObject({
      type: "color",
      description: "Brand",
      values: { light: "oklch(0.54 0.25 293)", dark: "oklch(0.7 0.18 293)" },
    });
    expect(tokens.find((t) => t.cssVar === "--radius")).toMatchObject({
      type: "dimension",
      values: { light: "0.75rem", dark: "0.75rem" },
    });
  });

  test("components use JSX names, imports, stories and docs links", async () => {
    await core.run("system.create", { id: "acme-ui", name: "Acme UI", kind: "package" });
    await core.run("component.create", {
      system: "acme-ui",
      name: "button",
      tag: "Button",
      title: "Button",
      import: 'import { Button } from "@/components/ui/button";',
      story: "stories/button.stories.tsx",
      docsUrl: "https://ui.shadcn.com/docs/components/button",
      examples: [{ title: "Default", html: "<Button>Save</Button>", story: "Default" }],
    });
    const out = await core.run<{ snippet: string; component: { tag: string } }>("component.get", {
      system: "acme-ui",
      name: "button",
    });
    expect(out.component.tag).toBe("Button");
    expect(out.snippet).toBe(
      'import { Button } from "@/components/ui/button";\n\n<Button>Save</Button>',
    );
  });

  test("React prototypes scaffold a shell and main.tsx, and resolve their system", async () => {
    await expect(
      core.run("prototype.create", { title: "No system", framework: "react" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await core.run("system.create", { id: "acme-ui", name: "Acme UI", kind: "package" });
    const { prototype } = await core.run<{ prototype: { id: string; system?: string } }>(
      "prototype.create",
      { title: "Settings", framework: "react" },
    );
    expect(prototype.system).toBe("acme-ui");
    const files = (await core.prototypes.listFiles(prototype.id)).map((f) => f.path).sort();
    expect(files).toEqual(["index.html", "main.tsx"]);
    expect((await core.prototypes.readFile(prototype.id, "index.html")).content).toContain(
      'src="./main.tsx"',
    );
    // Any prototype can name its system now (plain HTML ones for the viewer's theme options).
    const plain = await core.run<{ prototype: { system?: string } }>("prototype.create", {
      title: "Plain",
      system: "acme-ui",
    });
    expect(plain.prototype.system).toBe("acme-ui");
    await expect(
      core.run("prototype.create", { title: "Typo", system: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("building without installed dependencies explains how to fix it", async () => {
    await core.run("system.create", { id: "acme-ui", name: "Acme UI", kind: "package" });
    // The system itself isn't "failed" before `npm install`, just not built yet.
    const built = await core.buildSystem("acme-ui");
    expect(built.files).toEqual([]);
    expect(built.warnings.join()).toMatch(/npm install/);
    await core.run("prototype.create", { title: "Settings", framework: "react" });
    await expect(core.buildPrototype("settings")).rejects.toThrow(/npm install/);
    // The failure is cached until something changes, so repeated requests don't rebuild.
    await expect(core.buildPrototype("settings")).rejects.toThrow(/npm install/);
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

    const dir = path.join(root, "projects/test/prototypes/external");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), "<title>External</title>");

    await expect.poll(() => core.prototypes.has("external"), { timeout: 3000 }).toBe(true);
    await expect
      .poll(() => events.find((e) => e.type === "prototype.changed" && e.data.id === "external"), {
        timeout: 3000,
      })
      .toMatchObject({ data: { project: "test", exists: true } });

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
