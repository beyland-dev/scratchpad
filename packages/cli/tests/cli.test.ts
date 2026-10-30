import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "jsonc-parser";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { main, type CliIO } from "../src/index.ts";

let dir: string;

function io(cwd = dir): CliIO & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  // Never the real ~/.sprue.
  const env = {
    HOME: path.join(dir, "user"),
    SPRUE_HOME: path.join(dir, "home"),
  };
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
    expect((await run(["serve", "--help"])).stdout).toContain(
      "Start the self-contained Sprue web app",
    );
    expect((await run(["mcp-config", "--help"])).stdout).toContain("--install       Merge into");
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

  test("three-word commands resolve (project git status)", async () => {
    await run(["project", "create", "--name", "Repo"]);
    const status = await run(["project", "git", "status", "repo", "--json"]);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ project: "repo", repo: false });
  });

  test("mcp-config passes --home only for a non-default workspace", async () => {
    const out = await run(["mcp-config", "vscode", "--json"]);
    const launch = JSON.parse(out.stdout).launch;
    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual(expect.arrayContaining(["mcp", "--home", path.join(dir, "home")]));

    const config = await run(["mcp-config", "vscode"]);
    expect(config.stdout).toMatch(/^VS Code Copilot harness/);
    expect(config.stdout).toContain('"mcpServers"');
    expect(config.stdout).toContain('"tools": [');
    expect(config.stdout).not.toContain('"type": "stdio"');
    expect(config.stdout).not.toContain("// VS Code");
    expect(config.stdout).not.toContain("\n\n\n");
  });

  test("mcp-config --install creates an idempotent Copilot config", async () => {
    const installed = await run(["mcp-config", "vscode", "--install", "--json"]);
    expect(installed.code).toBe(0);
    expect(JSON.parse(installed.stdout)).toMatchObject({
      name: "sprue",
      status: "created",
    });
    const file = path.join(dir, "user/.copilot/mcp-config.json");
    const config = JSON.parse(await readFile(file, "utf8"));
    expect(config.mcpServers.sprue).toMatchObject({
      command: process.execPath,
      tools: ["*"],
    });

    const repeated = await run(["mcp-config", "vscode", "--install", "--json"]);
    expect(JSON.parse(repeated.stdout).status).toBe("unchanged");
  });

  test("mcp-config --install preserves peers and requires force for conflicts", async () => {
    const file = path.join(dir, "user/.copilot/mcp-config.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `{
  // Keep this server and comment.
  "mcpServers": {
    "other": { "command": "other" },
    "sprue": { "command": "old" }
  }
}
`,
    );

    const conflict = await run(["mcp-config", "vscode", "--install"]);
    expect(conflict.code).toBe(1);
    expect(conflict.stderr).toContain("--force");
    expect(await readFile(file, "utf8")).toContain('"command": "old"');

    const replaced = await run(["mcp-config", "vscode", "--install", "--force", "--json"]);
    expect(JSON.parse(replaced.stdout).status).toBe("updated");
    const text = await readFile(file, "utf8");
    const config = parse(text) as {
      mcpServers: Record<string, { command: string }>;
    };
    expect(text).toContain("// Keep this server and comment.");
    expect(config.mcpServers.other).toEqual({ command: "other" });
    expect(config.mcpServers.sprue.command).toBe(process.execPath);
  });

  test("source commands", async () => {
    expect(
      (await run(["source", "add", "../product", "--notes", "tokens in src/theme"])).stdout,
    ).toContain("Added source product");
    const listed = await run(["source", "list"]);
    expect(listed.stdout).toMatch(/product\s+local/);
  });
});
