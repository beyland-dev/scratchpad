import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { main, type CliIO } from "../src/index.ts";

let dir: string;

function io(cwd = dir): CliIO & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  // Never the real ~/.scratchpad.
  const env = { SCRATCHPAD_HOME: path.join(dir, "home") };
  return { out, err, stdout: (t) => out.push(t), stderr: (t) => err.push(t), cwd, env };
}

async function run(args: string[], cwd = dir) {
  const ctx = io(cwd);
  const code = await main(args, ctx);
  return { code, stdout: ctx.out.join("\n"), stderr: ctx.err.join("\n") };
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "sp-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("sp", () => {
  test("help and version work without a workspace", async () => {
    const help = await run(["help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("prototype.createVariant");
    expect((await run(["--version"])).stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect((await run(["prototype", "create", "--help"])).stdout).toContain(
      "--title <value> (required)",
    );
  });

  test("creates the workspace on first use; new work needs a project", async () => {
    const empty = await run(["prototype", "list", "--json"]);
    expect(empty.code).toBe(0);
    expect(JSON.parse(empty.stdout).prototypes).toEqual([]);
    expect(JSON.parse(await readFile(path.join(dir, "home/config.json"), "utf8"))).toEqual({
      version: 2,
      sources: [],
    });
    const result = await run(["prototype", "create", "--title", "X"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("project.create");
  });

  test("project, create, variant, update, and list", async () => {
    expect((await run(["project", "create", "--name", "CLI"])).code).toBe(0);
    await writeFile(path.join(dir, "page.html"), "<h1>From file</h1>");
    const created = await run([
      "prototype",
      "create",
      "--title",
      "Home",
      "--html",
      "@page.html",
      "--tags",
      "a",
      "--tags",
      "b",
      "--json",
    ]);
    expect(created.code).toBe(0);
    expect(JSON.parse(created.stdout).prototype).toMatchObject({
      id: "home",
      project: "cli",
      tags: ["a", "b"],
    });
    expect(
      await readFile(path.join(dir, "home/projects/cli/prototypes/home/index.html"), "utf8"),
    ).toBe("<h1>From file</h1>");

    const variant = await run([
      "prototype",
      "create-variant",
      "cli/home",
      "--description",
      "Bigger hero",
      "--json",
    ]);
    // Versions share the family's name; the description says what changed.
    expect(JSON.parse(variant.stdout).prototype).toMatchObject({
      id: "home-v2",
      variantOf: "home",
      title: "Home",
      description: "Bigger hero",
    });

    expect(
      (await run(["prototype.update", "home-v2", "--status", "review", "--group", "null"])).code,
    ).toBe(0);
    const list = await run(["prototype", "list", "--status", "review", "--json"]);
    expect(JSON.parse(list.stdout).prototypes.map((p: { id: string }) => p.id)).toEqual([
      "home-v2",
    ]);

    const read = await run(["prototype", "read-file", "home-v2", "index.html"]);
    expect(read.stdout).toBe("<h1>From file</h1>");
  });

  test("--home picks the workspace; validation errors are reported", async () => {
    const other = path.join(dir, "other");
    expect((await run(["--home", other, "project", "create", "--name", "Elsewhere"])).code).toBe(0);
    expect(
      JSON.parse(await readFile(path.join(other, "projects/elsewhere/project.json"), "utf8")),
    ).toMatchObject({ name: "Elsewhere" });
    const result = await run([
      "--home",
      other,
      "prototype",
      "create",
      "--title",
      "X",
      "--status",
      "bogus",
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("status");
    const unknown = await run(["prototype", "create", "--nope", "1"]);
    expect(unknown.stderr).toContain("--nope");
  });

  test("mcp-config passes --home only for a non-default workspace", async () => {
    const out = await run(["mcp-config", "vscode", "--json"]);
    expect(JSON.parse(out.stdout).launch.args).toEqual(
      expect.arrayContaining(["mcp", "--home", path.join(dir, "home")]),
    );
  });

  test("source commands", async () => {
    expect(
      (await run(["source", "add", "../product", "--notes", "tokens in src/theme"])).stdout,
    ).toContain("Added source product");
    const listed = await run(["source", "list"]);
    expect(listed.stdout).toMatch(/product\s+local/);
  });
});
