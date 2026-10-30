import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CoreError } from "@beyland/sprue-core";
import { applyEdits, modify, parse, type FormattingOptions, type ParseError } from "jsonc-parser";

export type McpClient =
  | "copilot"
  | "claude"
  | "codex"
  | "antigravity"
  | "muse"
  | "cursor"
  | "opencode"
  | "pi";

export const MCP_CLIENTS: McpClient[] = [
  "copilot",
  "claude",
  "codex",
  "antigravity",
  "muse",
  "cursor",
  "opencode",
  "pi",
];

/** Older client names that still work (not listed in help). */
const CLIENT_ALIASES: Record<string, McpClient> = { vscode: "copilot", "copilot-cli": "copilot" };

/** The client a name refers to, including aliases; undefined for unknown names. */
export function resolveMcpClient(name: string): McpClient | undefined {
  return MCP_CLIENTS.includes(name as McpClient) ? (name as McpClient) : CLIENT_ALIASES[name];
}

export interface StdioLaunch {
  command: string;
  args: string[];
}

export interface McpConfigInstallResult {
  client: McpClient;
  file: string;
  name: string;
  status: "created" | "updated" | "unchanged";
  /** Set when the client's own CLI wrote its config (e.g. `claude mcp add`). */
  via?: string;
}

/** Runs another program synchronously (the client CLIs that own their config files). */
export type Exec = (
  command: string,
  args: string[],
) => { status: number | null; stdout: string; stderr: string; error?: Error };

export interface InstallOptions {
  env?: NodeJS.ProcessEnv;
  name?: string;
  force?: boolean;
  exec?: Exec;
}

/** The npm package that provides `sp`. */
export const CLI_PACKAGE = "@beyland/sprue";

/** True when `sp` runs from npx's cache, which npm may clear at any time. */
export function isNpxInstall(binPath: string): boolean {
  return /[\\/]_npx[\\/]/.test(binPath);
}

/**
 * How to launch `sp mcp` from an MCP client config (`--home` only for a non-default workspace).
 * Absolute paths, since clients started from the Dock don't get the shell's PATH. The desktop
 * app's bundled `sp` passes its launcher script; when run via npx, launch through npx again
 * (next to this Node) instead of pointing into its cache.
 */
export function stdioLaunch(
  binPath: string,
  home?: string,
  { execPath = process.execPath, launcher }: { execPath?: string; launcher?: string } = {},
): StdioLaunch {
  const homeArgs = home ? ["--home", home] : [];
  if (launcher) return { command: launcher, args: ["mcp", ...homeArgs] };
  if (isNpxInstall(binPath)) {
    const npx = path.join(path.dirname(execPath), process.platform === "win32" ? "npx.cmd" : "npx");
    return {
      command: existsSync(npx) ? npx : "npx",
      args: ["-y", CLI_PACKAGE, "mcp", ...homeArgs],
    };
  }
  return { command: execPath, args: [binPath, "mcp", ...homeArgs] };
}

export const portableMcpEntry = (launch: StdioLaunch): Record<string, unknown> => ({
  command: launch.command,
  args: launch.args,
  tools: ["*"],
});

const stdioEntry = (launch: StdioLaunch) => ({ command: launch.command, args: launch.args });

function homeOf(env: NodeJS.ProcessEnv): string {
  return env.HOME ?? homedir();
}

export function copilotMcpConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(env.COPILOT_HOME ?? path.join(homeOf(env), ".copilot"), "mcp-config.json");
}

/** OpenCode reads opencode.jsonc or opencode.json from its config folder; use whichever exists. */
function opencodeConfigPath(env: NodeJS.ProcessEnv): string {
  const dir = path.join(env.XDG_CONFIG_HOME ?? path.join(homeOf(env), ".config"), "opencode");
  const jsonc = path.join(dir, "opencode.jsonc");
  return existsSync(jsonc) ? jsonc : path.join(dir, "opencode.json");
}

/** A client whose config is a JSON(C) file we merge into. */
interface JsonTarget {
  kind: "json";
  note: string;
  file: (env: NodeJS.ProcessEnv) => string;
  /** Where the server entry goes, e.g. ["mcpServers", name]. */
  key: (name: string) => string[];
  entry: (launch: StdioLaunch) => Record<string, unknown>;
  /** Top-level fields for a new file. */
  init?: Record<string, unknown>;
}

/** A client that owns its config (a format we don't edit), so its CLI adds the server. */
interface CliTarget {
  kind: "cli";
  note: string;
  bin: string;
  file: (env: NodeJS.ProcessEnv) => string;
  /** The current entry for `name`, or undefined (read-only; the CLI does the writing). */
  current: (text: string, name: string) => StdioLaunch | undefined;
  add: (name: string, launch: StdioLaunch) => string[];
  remove: (name: string) => string[];
  snippet: (name: string, launch: StdioLaunch) => string;
}

const TARGETS: Record<McpClient, JsonTarget | CliTarget> = {
  copilot: {
    kind: "json",
    note: "GitHub Copilot in VS Code, the Copilot app, and the Copilot CLI (~/.copilot/mcp-config.json, or $COPILOT_HOME/mcp-config.json)",
    file: copilotMcpConfigPath,
    key: (name) => ["mcpServers", name],
    entry: portableMcpEntry,
  },
  cursor: {
    kind: "json",
    note: "Cursor (~/.cursor/mcp.json)",
    file: (env) => path.join(homeOf(env), ".cursor", "mcp.json"),
    key: (name) => ["mcpServers", name],
    entry: stdioEntry,
  },
  antigravity: {
    kind: "json",
    note: "Google Antigravity 2.0, IDE, and CLI (~/.gemini/config/mcp_config.json)",
    file: (env) => path.join(homeOf(env), ".gemini", "config", "mcp_config.json"),
    key: (name) => ["mcpServers", name],
    entry: stdioEntry,
  },
  muse: {
    kind: "json",
    note: "Muse Code (~/.config/muse/settings.json)",
    file: (env) =>
      path.join(env.XDG_CONFIG_HOME ?? path.join(homeOf(env), ".config"), "muse", "settings.json"),
    key: (name) => ["mcp_servers", name],
    // "optional": Muse Code aborts a run when a required server can't start.
    entry: (l) => ({ transport: "stdio", command: l.command, args: l.args, mode: "optional" }),
    // Muse Code refuses to start without a schema version.
    init: { schema_version: 1 },
  },
  pi: {
    kind: "json",
    note: "Pi 0.99+ (~/.pi/agent/mcp.json; run /reload in open sessions)",
    file: (env) => path.join(homeOf(env), ".pi", "agent", "mcp.json"),
    key: (name) => ["mcpServers", name],
    entry: stdioEntry,
  },
  opencode: {
    kind: "json",
    note: "OpenCode (~/.config/opencode/opencode.json)",
    file: opencodeConfigPath,
    key: (name) => ["mcp", name],
    entry: (l) => ({ type: "local", command: [l.command, ...l.args], enabled: true }),
    init: { $schema: "https://opencode.ai/config.json" },
  },
  claude: {
    kind: "cli",
    note: "Claude Code (user scope, via `claude mcp add`)",
    bin: "claude",
    file: (env) => path.join(env.CLAUDE_CONFIG_DIR ?? homeOf(env), ".claude.json"),
    current: (text, name) => {
      const servers = (parse(text) as { mcpServers?: Record<string, unknown> } | undefined)
        ?.mcpServers;
      const entry = isRecord(servers) ? servers[name] : undefined;
      return isRecord(entry) && typeof entry.command === "string"
        ? { command: entry.command, args: Array.isArray(entry.args) ? entry.args.map(String) : [] }
        : undefined;
    },
    add: (name, l) => ["mcp", "add", "--scope", "user", name, "--", l.command, ...l.args],
    remove: (name) => ["mcp", "remove", "--scope", "user", name],
    snippet: (name, l) =>
      ["claude", "mcp", "add", "--scope", "user", name, "--", l.command, ...l.args]
        .map(shellQuote)
        .join(" "),
  },
  codex: {
    kind: "cli",
    note: "Codex CLI and IDE extension (~/.codex/config.toml, via `codex mcp add`)",
    bin: "codex",
    file: (env) => path.join(env.CODEX_HOME ?? path.join(homeOf(env), ".codex"), "config.toml"),
    current: (text, name) => {
      const section = tomlSection(text, `mcp_servers.${name}`);
      if (section === undefined) return undefined;
      const command = /^\s*command\s*=\s*("(?:[^"\\]|\\.)*")/m.exec(section)?.[1];
      const args = /^\s*args\s*=\s*(\[[^\]]*\])/m.exec(section)?.[1];
      try {
        return {
          command: command ? (JSON.parse(command) as string) : "",
          args: args ? (JSON.parse(args) as string[]) : [],
        };
      } catch {
        return { command: "", args: [] };
      }
    },
    add: (name, l) => ["mcp", "add", name, "--", l.command, ...l.args],
    remove: (name) => ["mcp", "remove", name],
    snippet: (name, l) =>
      `[mcp_servers.${name}]\ncommand = ${JSON.stringify(l.command)}\nargs = ${JSON.stringify(l.args)}`,
  },
};

/** The body of `[header]` in a TOML file (up to the next table header), or undefined. */
function tomlSection(text: string, header: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `[${header}]`);
  if (start < 0) return undefined;
  const end = lines.findIndex((line, i) => i > start && /^\s*\[/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

export function mcpConfigSnippet(client: McpClient, launch: StdioLaunch, name = "sprue"): string {
  const target = TARGETS[client];
  if (target.kind === "cli") return `${target.note}\n\n${target.snippet(name, launch)}`;
  let value: unknown = target.entry(launch);
  for (const key of target.key(name).toReversed()) value = { [key]: value };
  return `${target.note}\n\n${JSON.stringify(value, null, 2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formattingOptions(text: string): FormattingOptions {
  const indent = /(?:^|\r?\n)([ \t]+)"/.exec(text)?.[1];
  return {
    insertSpaces: !indent?.includes("\t"),
    tabSize: indent && !indent.includes("\t") ? indent.length : 2,
    eol: text.includes("\r\n") ? "\r\n" : "\n",
  };
}

/** Merge the Sprue server into a JSON(C) config without touching other servers or comments. */
async function installJson(
  client: McpClient,
  target: JsonTarget,
  launch: StdioLaunch,
  options: InstallOptions,
): Promise<McpConfigInstallResult> {
  const file = target.file(options.env ?? process.env);
  const name = options.name?.trim() || "sprue";
  let exists = true;
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    exists = false;
    text = target.init ? `${JSON.stringify(target.init, null, 2)}\n` : "{}\n";
  }

  const errors: ParseError[] = [];
  const config = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;
  if (errors.length || !isRecord(config))
    throw new CoreError(
      "INVALID_INPUT",
      `${file} is not a valid JSON object. Fix it before installing the Sprue MCP server.`,
    );
  const [parentKey] = target.key(name);
  const parent = config[parentKey!];
  if (parent !== undefined && !isRecord(parent))
    throw new CoreError(
      "INVALID_INPUT",
      `${file} has an invalid ${parentKey} value; expected an object.`,
    );

  const entry = target.entry(launch);
  const current = isRecord(parent) ? parent[name] : undefined;
  if (current !== undefined) {
    if (isDeepStrictEqual(current, entry)) return { client, file, name, status: "unchanged" };
    if (!options.force)
      throw new CoreError(
        "CONFLICT",
        `MCP server ${JSON.stringify(name)} already exists in ${file}. Re-run with --force to replace only that entry.`,
      );
  }

  const format = formattingOptions(text);
  const next = applyEdits(
    text,
    modify(text, target.key(name), entry, { formattingOptions: format }),
  );
  const eol = format.eol ?? "\n";
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, next.endsWith(eol) ? next : `${next}${eol}`, "utf8");
  return { client, file, name, status: exists ? "updated" : "created" };
}

/** Let the client's own CLI add the server, after checking what's there already. */
async function installViaCli(
  client: McpClient,
  target: CliTarget,
  launch: StdioLaunch,
  options: InstallOptions,
): Promise<McpConfigInstallResult> {
  const env = options.env ?? process.env;
  const file = target.file(env);
  const name = options.name?.trim() || "sprue";
  const exec = options.exec;
  if (!exec) throw new Error("installViaCli needs exec");
  const text = await readFile(file, "utf8").catch(() => "");
  const current = text ? target.current(text, name) : undefined;
  if (current) {
    if (isDeepStrictEqual(current, launch))
      return { client, file, name, status: "unchanged", via: target.bin };
    if (!options.force)
      throw new CoreError(
        "CONFLICT",
        `MCP server ${JSON.stringify(name)} already exists in ${file}. Re-run with --force to replace it.`,
      );
  }
  const run = (args: string[]) => {
    const result = exec(target.bin, args);
    if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT")
      throw new CoreError(
        "NOT_FOUND",
        `Couldn't find the ${target.bin} command. Install it, or add Sprue yourself:\n\n${target.snippet(name, launch)}`,
      );
    if (result.status !== 0)
      throw new CoreError(
        "INVALID_INPUT",
        `${target.bin} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`,
      );
  };
  if (current) run(target.remove(name));
  run(target.add(name, launch));
  return { client, file, name, status: current ? "updated" : "created", via: target.bin };
}

/** Add Sprue to a client's user-level MCP config (idempotent; --force replaces a different entry). */
export async function installMcpConfig(
  client: McpClient,
  launch: StdioLaunch,
  options: InstallOptions = {},
): Promise<McpConfigInstallResult> {
  const target = TARGETS[client];
  return target.kind === "json"
    ? installJson(client, target, launch, options)
    : installViaCli(client, target, launch, options);
}

/** Merge a portable Sprue server into the user's Copilot MCP config without replacing peers. */
export function installCopilotMcpConfig(
  launch: StdioLaunch,
  options: Omit<InstallOptions, "exec"> = {},
): Promise<McpConfigInstallResult> {
  return installMcpConfig("copilot", launch, options);
}

export interface McpConfigStatus {
  client: McpClient;
  file: string;
  /** Sprue (`name`) is in the client's config. */
  configured: boolean;
  /** …and launches the way `launch` would (false: another install, or an older path). */
  current: boolean;
}

/** Read-only: is Sprue already set up for this client? Unreadable configs count as not set up. */
export async function mcpConfigStatus(
  client: McpClient,
  launch: StdioLaunch,
  options: { env?: NodeJS.ProcessEnv; name?: string } = {},
): Promise<McpConfigStatus> {
  const target = TARGETS[client];
  const file = target.file(options.env ?? process.env);
  const name = options.name?.trim() || "sprue";
  const text = await readFile(file, "utf8").catch(() => "");
  if (!text) return { client, file, configured: false, current: false };
  if (target.kind === "cli") {
    const current = target.current(text, name);
    return {
      client,
      file,
      configured: Boolean(current),
      current: Boolean(current && isDeepStrictEqual(current, launch)),
    };
  }
  let value: unknown = parse(text, [], { allowTrailingComma: true, disallowComments: false });
  for (const key of target.key(name)) value = isRecord(value) ? value[key] : undefined;
  return {
    client,
    file,
    configured: value !== undefined,
    current: value !== undefined && isDeepStrictEqual(value, target.entry(launch)),
  };
}
