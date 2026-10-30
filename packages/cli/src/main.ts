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
  gitCommands,
  reviewCommands,
  systemCommands,
  defaultWorkspaceRoot,
  isCoreError,
  type CommandDescriptor,
} from "@beyland/sprue-core";
import { captureCommands, closeBrowser } from "@beyland/sprue-capture";
import { commandHelp, parseCommandInput } from "./args.ts";
import {
  installCopilotMcpConfig,
  MCP_CLIENTS,
  mcpConfigSnippet,
  stdioLaunch,
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
  ...gitCommands,
  ...reviewCommands,
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
    sandbox ??= import("@beyland/sprue-server").then(({ startSandbox }) => startSandbox({ core }));
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
  home?: string;
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
    else if (arg === "--home") globals.home = argv[++i];
    else if (arg.startsWith("--home=")) globals.home = arg.slice("--home=".length);
    else globals.rest.push(arg);
  }
  return globals;
}

const camel = (token: string) => token.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Accepts `prototype.createVariant`, `prototype createVariant`, `prototype create-variant`, and `project git status`. */
function resolveCommand(
  tokens: string[],
): { descriptor: CommandDescriptor; args: string[] } | undefined {
  const words = tokens.map(camel);
  // Longest match first: `project git status` before `project git`.
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const name = words.slice(0, n).join(".");
    const descriptor = descriptors.get(name);
    if (descriptor) return { descriptor, args: tokens.slice(n) };
  }
  return undefined;
}

/** `--home`, else `$SPRUE_HOME`, else `~/.sprue` (created on first use). */
function resolveWorkspace(globals: Globals, io: CliIO): string {
  return globals.home ? path.resolve(io.cwd, globals.home) : defaultWorkspaceRoot(io.env);
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
  return `Sprue ${VERSION} — design prototyping with agents

Usage: sp <command> [options]

App:
  serve                                Start the app + sandbox servers and open the browser
      --port <n>  --sandbox-port <n>  --host <host>  --strict-port  --no-open  --dev-origin <url>
  mcp                                  Run the MCP server over stdio (for agent configs)
  mcp-config [client] [--install]      Print or install MCP config (${MCP_CLIENTS.join(", ")})
  commands                             List core commands with their JSON input schemas

Core commands (also exposed over MCP and HTTP):
${commandLines.join("\n")}

Global options:
  --home <dir>            Workspace folder (default: $SPRUE_HOME, or ~/.sprue)
  --json                  Print machine-readable JSON
  -h, --help              Show help (also: sp <command> --help)
  -v, --version           Show version

Commands can be dotted, spaced, or kebab-cased: \`sp prototype.createVariant\`, \`sp prototype create-variant\`.`;
}

function serveHelp(): string {
  return `sp serve [options]

Start the self-contained Sprue web app, HTTP API, MCP server, and prototype sandbox.

Options:
  --port <n>             App, API, and MCP port (default: 7420)
  --sandbox-port <n>     Prototype sandbox port (default: 7421)
  --host <host>          Host interface (default: 127.0.0.1)
  --strict-port          Fail instead of trying the next available port
  --no-open              Do not open the app in a browser
  --allowed-host <host>  Additional accepted hostname (repeatable)
  --dev-origin <url>     Additional browser origin for local UI development (repeatable)
  -h, --help             Show this help`;
}

function mcpConfigHelp(): string {
  return `sp mcp-config [client] [options]

Print an MCP configuration snippet, or merge Sprue into the portable Copilot config.

Clients: ${MCP_CLIENTS.join(", ")}

Options:
  --install       Merge into $COPILOT_HOME/mcp-config.json (default: ~/.copilot/mcp-config.json)
  --name <name>   MCP server name (default: sprue)
  --force         Replace a conflicting server with the same name; requires --install
  -h, --help      Show this help`;
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
      case "serve":
        if (globals.help) {
          io.stdout(serveHelp());
          return 0;
        }
        return await runServe(rest, globals, io);
      case "mcp":
        return await runMcp(globals, io);
      case "mcp-config":
        if (globals.help) {
          io.stdout(mcpConfigHelp());
          return 0;
        }
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
        `Unknown command: ${globals.rest.join(" ")}\nRun \`sp help\` to see available commands.`,
      );
      return 1;
    }
    if (globals.help) {
      io.stdout(commandHelp(resolved.descriptor));
      return 0;
    }
    const input = await parseCommandInput(resolved.descriptor, resolved.args, io.cwd);
    const { core, dispose } = await openCore(resolveWorkspace(globals, io));
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

function resolveWebRoot(env: NodeJS.ProcessEnv): string | undefined {
  const candidates = [
    env.SPRUE_WEB_ROOT,
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
  const { startServer } = await import("@beyland/sprue-server");
  const root = resolveWorkspace(globals, io);
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
      "Sprue",
      `  App:       ${server.url}${webRoot ? "" : "  (web UI not built; run `pnpm build` or `pnpm dev`)"}`,
      `  Sandbox:   ${server.sandboxUrl}`,
      `  MCP:       ${server.url}/mcp  (or \`sp mcp\` over stdio)`,
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
  const { serveStdio } = await import("@beyland/sprue-mcp");
  const { core, dispose } = await openCore(resolveWorkspace(globals, io), true);
  try {
    await serveStdio(core);
  } finally {
    await dispose();
  }
  return 0;
}

async function runMcpConfig(args: string[], globals: Globals, io: CliIO): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      install: { type: "boolean" },
      force: { type: "boolean" },
      name: { type: "string" },
    },
  });
  if (positionals.length > 1)
    throw new CoreError("INVALID_INPUT", "mcp-config accepts at most one client name");
  const root = resolveWorkspace(globals, io);
  const launch = stdioLaunch(BIN_PATH, root === defaultWorkspaceRoot({}) ? undefined : root);
  const requested = positionals[0] ?? (values.install ? "vscode" : undefined);
  if (requested && !MCP_CLIENTS.includes(requested as McpClient)) {
    throw new CoreError(
      "INVALID_INPUT",
      `Unknown MCP client ${requested}. Choose one of: ${MCP_CLIENTS.join(", ")}`,
    );
  }
  if (values.force && !values.install)
    throw new CoreError("INVALID_INPUT", "--force requires --install");
  if (values.install) {
    if (requested !== "vscode" && requested !== "copilot-cli")
      throw new CoreError(
        "INVALID_INPUT",
        `--install supports vscode and copilot-cli; ${requested} uses a different config file`,
      );
    const result = await installCopilotMcpConfig(launch, {
      env: io.env,
      name: values.name,
      force: values.force,
    });
    const human =
      result.status === "created"
        ? `Created ${result.file} with MCP server ${JSON.stringify(result.name)}`
        : result.status === "updated"
          ? `Added MCP server ${JSON.stringify(result.name)} to ${result.file}`
          : `MCP server ${JSON.stringify(result.name)} is already configured in ${result.file}`;
    printResult(io, globals, { ...result, launch }, human);
    return 0;
  }
  const clients = requested ? [requested as McpClient] : MCP_CLIENTS;
  printResult(
    io,
    globals,
    { launch, http: "http://127.0.0.1:7420/mcp (while `sp serve` is running)" },
    [
      ...clients.map((c) => mcpConfigSnippet(c, launch)),
      "HTTP alternative (while sp serve is running):\n  <app-url>/mcp",
    ].join("\n\n"),
  );
  return 0;
}
