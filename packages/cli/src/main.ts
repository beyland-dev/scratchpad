import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  CommandRegistry,
  Core,
  CoreError,
  builtinCommands,
  systemCommands,
  findWorkspaceRoot,
  initWorkspace,
  isCoreError,
  type CommandDescriptor,
} from "@design-tool/core";
import { captureCommands, closeBrowser } from "@design-tool/capture";
import { commandHelp, parseCommandInput } from "./args.ts";
import {
  MCP_CLIENTS,
  mcpConfigSnippet,
  stdioLaunch,
  writeMcpConfig,
  type McpClient,
} from "./mcp-config.ts";

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

const defaultIO: CliIO = {
  stdout: (text) => process.stdout.write(text.endsWith("\n") ? text : `${text}\n`),
  stderr: (text) => process.stderr.write(text.endsWith("\n") ? text : `${text}\n`),
  cwd: process.cwd(),
  env: process.env,
};

const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

/** Path to the executable entry, used when generating MCP client configs. */
export const BIN_PATH = fileURLToPath(
  new URL(import.meta.url.endsWith(".ts") ? "./bin.ts" : "./bin.mjs", import.meta.url),
);

const registry = new CommandRegistry().register(
  ...builtinCommands,
  ...systemCommands,
  ...captureCommands,
);

/** Open the workspace with capture commands, and a private sandbox started only when a command needs one. */
async function openCore(
  root: string,
  watch = false,
): Promise<{ core: Core; dispose: () => Promise<void> }> {
  const core = await Core.open({ root, watch, commands: captureCommands });
  let sandbox: Promise<{ url: string; close(): Promise<void> }> | undefined;
  core.setSandboxProvider(async () => {
    sandbox ??= import("@design-tool/server").then(({ startSandbox }) => startSandbox({ core }));
    return (await sandbox).url;
  });
  const dispose = async () => {
    await closeBrowser();
    if (sandbox) await (await sandbox).close();
    await core.close();
  };
  return { core, dispose };
}
const descriptors = new Map(registry.describe().map((d) => [d.name, d]));

interface Globals {
  workspace?: string;
  json: boolean;
  help: boolean;
  version: boolean;
  rest: string[];
}

function extractGlobals(argv: string[]): Globals {
  const globals: Globals = { json: false, help: false, version: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") {
      globals.rest.push(...argv.slice(i));
      break;
    }
    if (arg === "--json") globals.json = true;
    else if (arg === "-h" || arg === "--help") globals.help = true;
    else if (arg === "-v" || arg === "--version") globals.version = true;
    else if (arg === "-w" || arg === "--workspace") globals.workspace = argv[++i];
    else if (arg.startsWith("--workspace=")) globals.workspace = arg.slice("--workspace=".length);
    else globals.rest.push(arg);
  }
  return globals;
}

const camel = (token: string) => token.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Accepts `prototype.createVariant`, `prototype createVariant`, and `prototype create-variant`. */
function resolveCommand(
  tokens: string[],
): { descriptor: CommandDescriptor; args: string[] } | undefined {
  const [first, second] = tokens.map(camel);
  if (first && descriptors.has(first))
    return { descriptor: descriptors.get(first)!, args: tokens.slice(1) };
  if (first && second && descriptors.has(`${first}.${second}`)) {
    return { descriptor: descriptors.get(`${first}.${second}`)!, args: tokens.slice(2) };
  }
  return undefined;
}

async function resolveWorkspace(globals: Globals, io: CliIO): Promise<string> {
  const explicit = globals.workspace ?? io.env.DT_WORKSPACE;
  if (explicit) return path.resolve(io.cwd, explicit);
  const found = await findWorkspaceRoot(io.cwd);
  if (!found) {
    throw new CoreError(
      "NO_WORKSPACE",
      `No design workspace found in ${io.cwd} or its parents. Run \`dt init\` or pass --workspace <dir>.`,
    );
  }
  return found;
}

function mainHelp(): string {
  const groups = new Map<string, CommandDescriptor[]>();
  for (const d of descriptors.values()) {
    const group = d.name.split(".")[0]!;
    groups.set(group, [...(groups.get(group) ?? []), d]);
  }
  const commandLines = [...groups.values()].flat().map((d) => {
    const usage = `${d.name}${d.positional.length ? ` ${d.positional.map((p) => `<${p}>`).join(" ")}` : ""}`;
    return `  ${usage.padEnd(36)} ${d.title}`;
  });
  return `dt ${VERSION} — design-tool command line

Usage: dt <command> [options]

Workspace:
  init [dir]                           Create a design workspace (.design/) in dir (default: cwd)
      --name <name>  --no-example  --mcp <${MCP_CLIENTS.filter((c) => c !== "copilot-cli").join(",")}>
  serve                                Start the app + sandbox servers and open the browser
      --port <n>  --sandbox-port <n>  --host <host>  --strict-port  --no-open  --dev-origin <url>
  mcp                                  Run the MCP server over stdio (for agent configs)
  mcp-config [client]                  Print MCP config snippets (${MCP_CLIENTS.join(", ")})
  commands                             List core commands with their JSON input schemas

Core commands (also exposed over MCP and HTTP):
${commandLines.join("\n")}

Global options:
  -w, --workspace <dir>   Workspace root (default: nearest folder with .design/, or $DT_WORKSPACE)
  --json                  Print machine-readable JSON
  -h, --help              Show help (also: dt <command> --help)
  -v, --version           Show version

Commands can be dotted, spaced, or kebab-cased: \`dt prototype.createVariant\`, \`dt prototype create-variant\`.`;
}

function printResult(io: CliIO, globals: Globals, value: unknown, human?: string): void {
  io.stdout(
    globals.json ? JSON.stringify(value, null, 2) : (human ?? JSON.stringify(value, null, 2)),
  );
}

export async function main(argv: string[], io: CliIO = defaultIO): Promise<number> {
  const globals = extractGlobals(argv);
  const [name, ...rest] = globals.rest;
  try {
    if (globals.version) {
      io.stdout(VERSION);
      return 0;
    }
    if (!name || name === "help") {
      const target = rest.length ? resolveCommand(rest) : undefined;
      io.stdout(target ? commandHelp(target.descriptor) : mainHelp());
      return 0;
    }

    switch (name) {
      case "init":
        return await runInit(rest, globals, io);
      case "serve":
        return await runServe(rest, globals, io);
      case "mcp":
        return await runMcp(globals, io);
      case "mcp-config":
        return await runMcpConfig(rest, globals, io);
      case "commands":
        printResult(
          io,
          globals,
          [...descriptors.values()],
          [...descriptors.values()]
            .map((d) => `${d.name.padEnd(26)} ${d.kind.padEnd(9)} ${d.description}`)
            .join("\n"),
        );
        return 0;
    }

    const resolved = resolveCommand(globals.rest);
    if (!resolved) {
      io.stderr(
        `Unknown command: ${globals.rest.join(" ")}\nRun \`dt help\` to see available commands.`,
      );
      return 1;
    }
    if (globals.help) {
      io.stdout(commandHelp(resolved.descriptor));
      return 0;
    }
    const input = await parseCommandInput(resolved.descriptor, resolved.args, io.cwd);
    const { core, dispose } = await openCore(await resolveWorkspace(globals, io));
    try {
      const command = core.registry.get(resolved.descriptor.name)!;
      const result = await core.run(command.name, input);
      printResult(io, globals, result, command.format?.(result));
      return 0;
    } finally {
      await dispose();
    }
  } catch (error) {
    if (globals.json) {
      const payload = isCoreError(error)
        ? { ok: false, error: { code: error.code, message: error.message } }
        : { ok: false, error: { code: "INTERNAL", message: (error as Error).message } };
      io.stderr(JSON.stringify(payload, null, 2));
    } else {
      io.stderr(`error: ${(error as Error).message}`);
    }
    return 1;
  }
}

async function runInit(args: string[], globals: Globals, io: CliIO): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    allowNegative: true,
    options: {
      name: { type: "string" },
      description: { type: "string" },
      example: { type: "boolean", default: true },
      mcp: { type: "string" },
    },
  });
  const dir = path.resolve(io.cwd, positionals[0] ?? globals.workspace ?? ".");
  const result = await initWorkspace(dir, {
    name: values.name,
    description: values.description,
    example: values.example,
  });
  const written: string[] = [];
  const clients = (values.mcp ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  for (const client of clients) {
    if (!MCP_CLIENTS.includes(client as McpClient))
      throw new CoreError("INVALID_INPUT", `Unknown MCP client ${client}`);
    const file = await writeMcpConfig(
      client as McpClient,
      result.root,
      stdioLaunch(result.root, BIN_PATH),
    );
    if (file) written.push(path.relative(result.root, file));
  }
  printResult(
    io,
    globals,
    { ...result, mcpConfigs: written },
    [
      `Created design workspace in ${result.root}`,
      ...result.created.map((f) => `  + ${f}`),
      ...written.map((f) => `  + ${f}`),
      "",
      "Next steps:",
      `  dt serve${positionals[0] ? ` -w ${positionals[0]}` : ""}            # open the app`,
      "  dt source add ../my-product   # register a product codebase as a reference",
      clients.length ? "" : "  dt mcp-config                 # connect your agent over MCP",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );
  return 0;
}

function resolveWebRoot(env: NodeJS.ProcessEnv): string | undefined {
  const candidates = [
    env.DT_WEB_ROOT,
    fileURLToPath(new URL("./web", import.meta.url)),
    fileURLToPath(new URL("../../../apps/web/dist", import.meta.url)),
  ].filter((c): c is string => Boolean(c));
  return candidates.find((c) => existsSync(path.join(c, "index.html")));
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command as string, args as string[], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Opening a browser is best-effort.
  }
}

async function runServe(args: string[], globals: Globals, io: CliIO): Promise<number> {
  const { values } = parseArgs({
    args,
    allowNegative: true,
    options: {
      port: { type: "string" },
      "sandbox-port": { type: "string" },
      host: { type: "string" },
      "strict-port": { type: "boolean" },
      open: { type: "boolean", default: true },
      "dev-origin": { type: "string", multiple: true },
      "allowed-host": { type: "string", multiple: true },
    },
  });
  const { startServer } = await import("@design-tool/server");
  const root = await resolveWorkspace(globals, io);
  const core = await Core.open({ root, watch: true, commands: captureCommands });
  const webRoot = resolveWebRoot(io.env);
  const server = await startServer({
    core,
    host: values.host,
    port: values.port ? Number(values.port) : undefined,
    sandboxPort: values["sandbox-port"] ? Number(values["sandbox-port"]) : undefined,
    strictPort: values["strict-port"],
    webRoot,
    extraOrigins: values["dev-origin"],
    allowedHosts: values["allowed-host"],
  });

  printResult(
    io,
    globals,
    {
      url: server.url,
      sandboxUrl: server.sandboxUrl,
      mcpUrl: `${server.url}/mcp`,
      root,
      webRoot: webRoot ?? null,
    },
    [
      `design-tool — ${core.workspace.config.name}`,
      `  App:       ${server.url}${webRoot ? "" : "  (web UI not built; run `pnpm build` or `pnpm dev`)"}`,
      `  Sandbox:   ${server.sandboxUrl}`,
      `  MCP:       ${server.url}/mcp  (or \`dt mcp\` over stdio)`,
      `  Workspace: ${root}`,
      "",
      "Watching for changes. Press Ctrl+C to stop.",
    ].join("\n"),
  );
  if (values.open && webRoot) openBrowser(server.url);

  await new Promise<void>((resolve) => {
    const stop = () => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await server.close();
  await closeBrowser();
  await core.close();
  return 0;
}

async function runMcp(globals: Globals, io: CliIO): Promise<number> {
  const { serveStdio } = await import("@design-tool/mcp");
  const { core, dispose } = await openCore(await resolveWorkspace(globals, io), true);
  try {
    await serveStdio(core);
  } finally {
    await dispose();
  }
  return 0;
}

async function runMcpConfig(args: string[], globals: Globals, io: CliIO): Promise<number> {
  const root = await resolveWorkspace(globals, io);
  const launch = stdioLaunch(root, BIN_PATH);
  const requested = args[0];
  if (requested && !MCP_CLIENTS.includes(requested as McpClient)) {
    throw new CoreError(
      "INVALID_INPUT",
      `Unknown MCP client ${requested}. Choose one of: ${MCP_CLIENTS.join(", ")}`,
    );
  }
  const clients = requested ? [requested as McpClient] : MCP_CLIENTS;
  printResult(
    io,
    globals,
    { launch, http: "http://127.0.0.1:7420/mcp (while `dt serve` is running)" },
    [
      ...clients.map((c) => mcpConfigSnippet(c, launch)),
      "",
      "Alternatively, while `dt serve` is running, point HTTP-capable clients at <app url>/mcp.",
    ].join("\n\n"),
  );
  return 0;
}
