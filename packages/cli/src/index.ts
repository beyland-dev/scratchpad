export { main, BIN_PATH, type CliIO } from "./main.ts";
export { parseCommandInput, flagsFor, commandHelp } from "./args.ts";
export {
  copilotMcpConfigPath,
  installCopilotMcpConfig,
  mcpConfigSnippet,
  portableMcpEntry,
  stdioLaunch,
  MCP_CLIENTS,
  type McpClient,
  type McpConfigInstallResult,
} from "./mcp-config.ts";
