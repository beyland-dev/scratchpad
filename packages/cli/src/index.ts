export { main, BIN_PATH, type CliIO } from "./main.ts";
export { parseCommandInput, flagsFor, commandHelp } from "./args.ts";
export {
  copilotMcpConfigPath,
  installCopilotMcpConfig,
  installMcpConfig,
  mcpConfigStatus,
  mcpConfigSnippet,
  portableMcpEntry,
  stdioLaunch,
  isNpxInstall,
  CLI_PACKAGE,
  MCP_CLIENTS,
  resolveMcpClient,
  type McpClient,
  type McpConfigInstallResult,
  type McpConfigStatus,
  type Exec,
  type InstallOptions,
} from "./mcp-config.ts";
export { agentCommands } from "./agent-commands.ts";
