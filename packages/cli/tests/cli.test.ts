import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "jsonc-parser";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { main, mcpConfigStatus, stdioLaunch, type CliIO } from "../src/index.ts";

let dir: string;

function io(cwd = dir, exec?: CliIO["exec"]): CliIO & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  // Never the real ~/.sprue.
  const env = {
    HOME: path.join(dir, "user"),
    SPRUE_HOME: path.join(dir, "home"),
  };
  return { out, err, stdout: (t) => out.push(t), stderr: (t) => err.push(t), cwd, env, exec };
}

async function run(args: string[], cwd = dir, exec?: CliIO["exec"]) {
  const ctx = io(cwd, exec);
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
    expect((await run(["mcp-config", "--help"])).stdout).toContain("--install       Add Sprue");
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
    const out = await run(["mcp-config", "copilot", "--json"]);
    const launch = JSON.parse(out.stdout).launch;
    expect(launch.command).toBe(process.execPath);
    expect(launch.args).toEqual(expect.arrayContaining(["mcp", "--home", path.join(dir, "home")]));

    const config = await run(["mcp-config", "copilot"]);
    expect(config.stdout).toMatch(/^GitHub Copilot in VS Code/);
    expect(config.stdout).toContain('"mcpServers"');
    expect(config.stdout).toContain('"tools": [');
    expect(config.stdout).not.toContain('"type": "stdio"');
    expect(config.stdout).not.toContain("// VS Code");
    expect(config.stdout).not.toContain("\n\n\n");
  });

  test("mcp-config --install creates an idempotent Copilot config", async () => {
    const installed = await run(["mcp-config", "copilot", "--install", "--json"]);
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

    const repeated = await run(["mcp-config", "copilot", "--install", "--json"]);
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

    const conflict = await run(["mcp-config", "copilot", "--install"]);
    expect(conflict.code).toBe(1);
    expect(conflict.stderr).toContain("--force");
    expect(await readFile(file, "utf8")).toContain('"command": "old"');

    const replaced = await run(["mcp-config", "copilot", "--install", "--force", "--json"]);
    expect(JSON.parse(replaced.stdout).status).toBe("updated");
    const text = await readFile(file, "utf8");
    const config = parse(text) as {
      mcpServers: Record<string, { command: string }>;
    };
    expect(text).toContain("// Keep this server and comment.");
    expect(config.mcpServers.other).toEqual({ command: "other" });
    expect(config.mcpServers.sprue.command).toBe(process.execPath);
  });

  test("configs launch through the desktop launcher or npx, never npx's cache", () => {
    const cached = "/Users/me/.npm/_npx/1a2b/node_modules/@beyland/sprue/dist/bin.mjs";
    expect(stdioLaunch(cached, "/work", { execPath: "/nonexistent/node" })).toEqual({
      command: "npx",
      args: ["-y", "@beyland/sprue", "mcp", "--home", "/work"],
    });
    expect(stdioLaunch(cached).command).toBe(path.join(path.dirname(process.execPath), "npx"));
    const global = "/usr/local/lib/node_modules/@beyland/sprue/dist/bin.mjs";
    expect(stdioLaunch(global, undefined, { execPath: "/usr/local/bin/node" })).toEqual({
      command: "/usr/local/bin/node",
      args: [global, "mcp"],
    });
    // The desktop app's launcher script wins: it stays valid as the app updates.
    expect(stdioLaunch(cached, undefined, { launcher: "/Applications/Sprue.app/sp" })).toEqual({
      command: "/Applications/Sprue.app/sp",
      args: ["mcp"],
    });
  });

  test("mcpConfigStatus reports whether Sprue is set up, and by this install", async () => {
    const env = { HOME: path.join(dir, "user") };
    const launch = { command: "/bin/sp", args: ["mcp"] };
    expect(await mcpConfigStatus("cursor", launch, { env })).toMatchObject({
      configured: false,
      current: false,
    });
    const file = path.join(dir, "user/.cursor/mcp.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ mcpServers: { sprue: launch } }));
    expect(await mcpConfigStatus("cursor", launch, { env })).toMatchObject({
      file,
      configured: true,
      current: true,
    });
    const other = { command: "/elsewhere/sp", args: ["mcp"] };
    expect(await mcpConfigStatus("cursor", other, { env })).toMatchObject({
      configured: true,
      current: false,
    });
  });

  test("mcp-config accepts copilot, with vscode and copilot-cli as aliases", async () => {
    const copilot = await run(["mcp-config", "copilot"]);
    expect(copilot.stdout).toMatch(
      /^GitHub Copilot in VS Code, the Copilot app, and the Copilot CLI/,
    );
    for (const alias of ["copilot-cli", "vscode"])
      expect((await run(["mcp-config", alias])).stdout).toBe(copilot.stdout);
    const help = (await run(["mcp-config", "--help"])).stdout;
    expect(help).not.toContain("copilot-cli");
    expect(help).not.toMatch(/Clients:.*vscode/);
  });

  test("mcp-config --install merges Cursor, Pi, Antigravity, Muse Code, and OpenCode configs", async () => {
    const user = path.join(dir, "user");
    for (const client of ["cursor", "pi", "antigravity"]) {
      const installed = JSON.parse(
        (await run(["mcp-config", client, "--install", "--json"])).stdout,
      );
      expect(installed).toMatchObject({ client, status: "created" });
      const config = JSON.parse(await readFile(installed.file, "utf8"));
      expect(config.mcpServers.sprue).toEqual({
        command: process.execPath,
        args: expect.arrayContaining(["mcp"]),
      });
      const again = await run(["mcp-config", client, "--install", "--json"]);
      expect(JSON.parse(again.stdout).status).toBe("unchanged");
    }
    expect(JSON.parse(await readFile(path.join(user, ".cursor/mcp.json"), "utf8"))).toBeTruthy();
    expect(JSON.parse(await readFile(path.join(user, ".pi/agent/mcp.json"), "utf8"))).toBeTruthy();

    expect(
      JSON.parse(await readFile(path.join(user, ".gemini/config/mcp_config.json"), "utf8")),
    ).toBeTruthy();

    // Muse Code: a new file declares the schema version it requires.
    const muse = JSON.parse((await run(["mcp-config", "muse", "--install", "--json"])).stdout);
    expect(muse.file).toBe(path.join(user, ".config/muse/settings.json"));
    expect(JSON.parse(await readFile(muse.file, "utf8"))).toEqual({
      schema_version: 1,
      mcp_servers: {
        sprue: {
          transport: "stdio",
          command: process.execPath,
          args: expect.arrayContaining(["mcp"]),
          mode: "optional",
        },
      },
    });

    // OpenCode: prefers an existing opencode.jsonc and keeps its comments.
    const jsonc = path.join(user, ".config/opencode/opencode.jsonc");
    await mkdir(path.dirname(jsonc), { recursive: true });
    await writeFile(jsonc, `{\n  // mine\n  "theme": "dark"\n}\n`);
    const opencode = JSON.parse(
      (await run(["mcp-config", "opencode", "--install", "--json"])).stdout,
    );
    expect(opencode).toMatchObject({ file: jsonc, status: "updated" });
    const text = await readFile(jsonc, "utf8");
    expect(text).toContain("// mine");
    expect((parse(text) as { mcp: Record<string, unknown> }).mcp.sprue).toEqual({
      type: "local",
      command: [process.execPath, expect.any(String), "mcp", "--home", path.join(dir, "home")],
      enabled: true,
    });
  });

  test("mcp-config --install runs the Claude Code and Codex CLIs", async () => {
    const calls: string[][] = [];
    const exec: CliIO["exec"] = (command, args) => {
      calls.push([command, ...args]);
      return { status: 0, stdout: "", stderr: "" };
    };
    const claude = await run(["mcp-config", "claude", "--install", "--json"], dir, exec);
    expect(JSON.parse(claude.stdout)).toMatchObject({ status: "created", via: "claude" });
    expect(calls[0]).toEqual([
      "claude",
      "mcp",
      "add",
      "--scope",
      "user",
      "sprue",
      "--",
      process.execPath,
      expect.any(String),
      "mcp",
      "--home",
      path.join(dir, "home"),
    ]);

    // Already there: no CLI call. Different: needs --force, which removes then adds.
    const launch = calls[0]!.slice(7);
    const claudeFile = path.join(dir, "user/.claude.json");
    await mkdir(path.dirname(claudeFile), { recursive: true });
    await writeFile(
      claudeFile,
      JSON.stringify({
        mcpServers: { sprue: { type: "stdio", command: launch[0], args: launch.slice(1) } },
      }),
    );
    calls.length = 0;
    const same = await run(["mcp-config", "claude", "--install", "--json"], dir, exec);
    expect(JSON.parse(same.stdout).status).toBe("unchanged");
    expect(calls).toEqual([]);
    await writeFile(claudeFile, JSON.stringify({ mcpServers: { sprue: { command: "old" } } }));
    expect((await run(["mcp-config", "claude", "--install"], dir, exec)).stderr).toContain(
      "--force",
    );
    await run(["mcp-config", "claude", "--install", "--force"], dir, exec);
    expect(calls.map((c) => c.slice(1, 3))).toEqual([
      ["mcp", "remove"],
      ["mcp", "add"],
    ]);

    // Codex: reads its TOML to stay idempotent.
    const toml = path.join(dir, "user/.codex/config.toml");
    await mkdir(path.dirname(toml), { recursive: true });
    await writeFile(
      toml,
      `model = "x"\n\n[mcp_servers.sprue]\ncommand = ${JSON.stringify(launch[0])}\nargs = ${JSON.stringify(launch.slice(1))}\n`,
    );
    calls.length = 0;
    const codex = await run(["mcp-config", "codex", "--install", "--json"], dir, exec);
    expect(JSON.parse(codex.stdout)).toMatchObject({ status: "unchanged", via: "codex" });
    expect(calls).toEqual([]);

    // A missing CLI explains how to add Sprue by hand.
    const missing: CliIO["exec"] = () => {
      const error = Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" });
      return { status: null, stdout: "", stderr: "", error };
    };
    await rm(toml);
    const failed = await run(["mcp-config", "codex", "--install"], dir, missing);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain("[mcp_servers.sprue]");
  });

  test("source commands", async () => {
    expect(
      (await run(["source", "add", "../product", "--notes", "tokens in src/theme"])).stdout,
    ).toContain("Added source product");
    const listed = await run(["source", "list"]);
    expect(listed.stdout).toMatch(/product\s+local/);
  });
});
