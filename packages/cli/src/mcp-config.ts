import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type McpClient = "vscode" | "claude" | "cursor" | "copilot-cli";

export const MCP_CLIENTS: McpClient[] = ["vscode", "claude", "cursor", "copilot-cli"];

export interface StdioLaunch {
  command: string;
  args: string[];
}

/** How to launch `dt mcp` for this workspace from an MCP client config. */
export function stdioLaunch(workspaceRoot: string, binPath: string): StdioLaunch {
  return { command: "node", args: [binPath, "mcp", "--workspace", workspaceRoot] };
}

interface ClientConfigTarget {
  /** Path relative to the workspace root, or undefined for user-level configs we only print. */
  file?: string;
  key: "servers" | "mcpServers";
  entry: (launch: StdioLaunch) => Record<string, unknown>;
  note: string;
}

const TARGETS: Record<McpClient, ClientConfigTarget> = {
  vscode: {
    file: ".vscode/mcp.json",
    key: "servers",
    entry: (l) => ({ type: "stdio", command: l.command, args: l.args }),
    note: "VS Code / GitHub Copilot (.vscode/mcp.json)",
  },
  claude: {
    file: ".mcp.json",
    key: "mcpServers",
    entry: (l) => ({ command: l.command, args: l.args }),
    note: "Claude Code (.mcp.json)",
  },
  cursor: {
    file: ".cursor/mcp.json",
    key: "mcpServers",
    entry: (l) => ({ command: l.command, args: l.args }),
    note: "Cursor (.cursor/mcp.json)",
  },
  "copilot-cli": {
    key: "mcpServers",
    entry: (l) => ({ type: "local", command: l.command, args: l.args, tools: ["*"] }),
    note: "GitHub Copilot CLI (~/.copilot/mcp-config.json)",
  },
};

export function mcpConfigSnippet(client: McpClient, launch: StdioLaunch): string {
  const target = TARGETS[client];
  return `// ${target.note}\n${JSON.stringify({ [target.key]: { "design-tool": target.entry(launch) } }, null, 2)}`;
}

/** Merge a design-tool entry into a client's project-level MCP config. Returns the written path, or undefined if skipped. */
export async function writeMcpConfig(
  client: McpClient,
  workspaceRoot: string,
  launch: StdioLaunch,
): Promise<string | undefined> {
  const target = TARGETS[client];
  if (!target.file) return undefined;
  const file = path.join(workspaceRoot, target.file);
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Could not update ${file}: it exists but isn't valid JSON`, { cause: error });
    }
  }
  const servers = (existing[target.key] as Record<string, unknown> | undefined) ?? {};
  const next = { ...existing, [target.key]: { ...servers, "design-tool": target.entry(launch) } };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
  return file;
}
