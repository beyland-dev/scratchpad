import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { main, type CliIO } from "../src/index.ts";

let dir: string;

function io(cwd = dir): CliIO & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (t) => out.push(t), stderr: (t) => err.push(t), cwd, env: {} };
}

async function run(args: string[], cwd = dir) {
  const ctx = io(cwd);
  const code = await main(args, ctx);
  return { code, stdout: ctx.out.join("\n"), stderr: ctx.err.join("\n") };
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dt-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("dt", () => {
  test("help and version work without a workspace", async () => {
    const help = await run(["help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("prototype.createVariant");
    expect((await run(["--version"])).stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect((await run(["prototype", "create", "--help"])).stdout).toContain(
      "--title <value> (required)",
    );
  });

  test("errors clearly when no workspace exists", async () => {
    const result = await run(["prototype", "list"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("dt init");
  });

  test("init, create, variant, update, and list", async () => {
    expect(
      (await run(["init", "--name", "CLI", "--no-example", "--mcp", "vscode,claude"])).code,
    ).toBe(0);
    const vscode = JSON.parse(await readFile(path.join(dir, ".vscode/mcp.json"), "utf8"));
    expect(vscode.servers["design-tool"]).toMatchObject({ type: "stdio", command: "node" });
    expect(vscode.servers["design-tool"].args).toEqual(
      expect.arrayContaining(["mcp", "--workspace", dir]),
    );
    const claude = JSON.parse(await readFile(path.join(dir, ".mcp.json"), "utf8"));
    expect(claude.mcpServers["design-tool"].args).toContain("mcp");

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
    expect(JSON.parse(created.stdout).prototype).toMatchObject({ id: "home", tags: ["a", "b"] });
    expect(await readFile(path.join(dir, ".design/prototypes/home/index.html"), "utf8")).toBe(
      "<h1>From file</h1>",
    );

    const variant = await run(["prototype", "create-variant", "home", "--title", "Home B"]);
    expect(variant.stdout).toContain("Created variant home-v2 of home");

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

  test("finds the workspace from a nested directory and reports validation errors", async () => {
    await run(["init", "--no-example"]);
    const nested = path.join(dir, ".design");
    const result = await run(["prototype", "create", "--title", "X", "--status", "bogus"], nested);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("status");
    const unknown = await run(["prototype", "create", "--nope", "1"]);
    expect(unknown.stderr).toContain("--nope");
  });

  test("source commands", async () => {
    await run(["init", "--no-example"]);
    expect(
      (await run(["source", "add", "../product", "--notes", "tokens in src/theme"])).stdout,
    ).toContain("Added source product");
    const listed = await run(["source", "list"]);
    expect(listed.stdout).toMatch(/product\s+local/);
  });
});
