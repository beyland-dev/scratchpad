import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { CoreError } from "@beyland/scratchpad-core";
import { applyEdits, modify, parse, type FormattingOptions, type ParseError } from "jsonc-parser";

export type McpClient = "vscode" | "claude" | "cursor" | "copilot-cli";

export const MCP_CLIENTS: McpClient[] = ["vscode", "claude", "cursor", "copilot-cli"];

export interface StdioLaunch {
  command: string;
  args: string[];
}

export interface McpConfigInstallResult {
  file: string;
  name: string;
  status: "created" | "updated" | "unchanged";
}

/** How to launch `scratchpad mcp` from an MCP client config (`--home` only for a non-default workspace). */
export function stdioLaunch(binPath: string, home?: string): StdioLaunch {
  return {
    command: process.execPath,
    args: [binPath, "mcp", ...(home ? ["--home", home] : [])],
  };
}

interface ClientConfigTarget {
  key: "servers" | "mcpServers";
  entry: (launch: StdioLaunch) => Record<string, unknown>;
  note: string;
}

export const portableMcpEntry = (launch: StdioLaunch): Record<string, unknown> => ({
  command: launch.command,
  args: launch.args,
  tools: ["*"],
});

const TARGETS: Record<McpClient, ClientConfigTarget> = {
  vscode: {
    key: "mcpServers",
    entry: portableMcpEntry,
    note: "VS Code Copilot harness (~/.copilot/mcp-config.json, or $COPILOT_HOME/mcp-config.json)",
  },
  claude: {
    key: "mcpServers",
    entry: (l) => ({ command: l.command, args: l.args }),
    note: "Claude Code (~/.claude.json, or `claude mcp add --scope user`)",
  },
  cursor: {
    key: "mcpServers",
    entry: (l) => ({ command: l.command, args: l.args }),
    note: "Cursor (~/.cursor/mcp.json)",
  },
  "copilot-cli": {
    key: "mcpServers",
    entry: portableMcpEntry,
    note: "GitHub Copilot CLI (~/.copilot/mcp-config.json)",
  },
};

export function mcpConfigSnippet(client: McpClient, launch: StdioLaunch): string {
  const target = TARGETS[client];
  return `${target.note}\n\n${JSON.stringify({ [target.key]: { scratchpad: target.entry(launch) } }, null, 2)}`;
}

export function copilotMcpConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const root =
    env.COPILOT_HOME ??
    (env.HOME ? path.join(env.HOME, ".copilot") : path.join(homedir(), ".copilot"));
  return path.join(root, "mcp-config.json");
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

/** Merge a portable Scratchpad server into the user's Copilot MCP config without replacing peers. */
export async function installCopilotMcpConfig(
  launch: StdioLaunch,
  options: {
    env?: NodeJS.ProcessEnv;
    name?: string;
    force?: boolean;
  } = {},
): Promise<McpConfigInstallResult> {
  const file = copilotMcpConfigPath(options.env);
  const name = options.name?.trim() || "scratchpad";
  let exists = true;
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    exists = false;
    text = "{}\n";
  }

  const errors: ParseError[] = [];
  const config = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;
  if (errors.length || !isRecord(config))
    throw new CoreError(
      "INVALID_INPUT",
      `${file} is not a valid JSON object. Fix it before installing the Scratchpad MCP server.`,
    );
  const servers = config.mcpServers;
  if (servers !== undefined && !isRecord(servers))
    throw new CoreError(
      "INVALID_INPUT",
      `${file} has an invalid mcpServers value; expected an object.`,
    );

  const entry = portableMcpEntry(launch);
  const current = isRecord(servers) ? servers[name] : undefined;
  if (current !== undefined) {
    if (isDeepStrictEqual(current, entry)) return { file, name, status: "unchanged" };
    if (!options.force)
      throw new CoreError(
        "CONFLICT",
        `MCP server ${JSON.stringify(name)} already exists in ${file}. Re-run with --force to replace only that entry.`,
      );
  }

  const format = formattingOptions(text);
  const next = applyEdits(
    text,
    modify(text, ["mcpServers", name], entry, { formattingOptions: format }),
  );
  const eol = format.eol ?? "\n";
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, next.endsWith(eol) ? next : `${next}${eol}`, "utf8");
  return { file, name, status: exists ? "updated" : "created" };
}
