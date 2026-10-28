export type McpClient = "vscode" | "claude" | "cursor" | "copilot-cli";

export const MCP_CLIENTS: McpClient[] = ["vscode", "claude", "cursor", "copilot-cli"];

export interface StdioLaunch {
  command: string;
  args: string[];
}

/** How to launch `scratchpad mcp` from an MCP client config (`--home` only for a non-default workspace). */
export function stdioLaunch(binPath: string, home?: string): StdioLaunch {
  return { command: "node", args: [binPath, "mcp", ...(home ? ["--home", home] : [])] };
}

interface ClientConfigTarget {
  key: "servers" | "mcpServers";
  entry: (launch: StdioLaunch) => Record<string, unknown>;
  note: string;
}

const TARGETS: Record<McpClient, ClientConfigTarget> = {
  vscode: {
    key: "servers",
    entry: (l) => ({ type: "stdio", command: l.command, args: l.args }),
    note: "VS Code / GitHub Copilot (user mcp.json: run “MCP: Open User Configuration”)",
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
    entry: (l) => ({ type: "local", command: l.command, args: l.args, tools: ["*"] }),
    note: "GitHub Copilot CLI (~/.copilot/mcp-config.json)",
  },
};

export function mcpConfigSnippet(client: McpClient, launch: StdioLaunch): string {
  const target = TARGETS[client];
  return `// ${target.note}\n${JSON.stringify({ [target.key]: { scratchpad: target.entry(launch) } }, null, 2)}`;
}
