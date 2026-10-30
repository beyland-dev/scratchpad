import { defineCommand } from "@beyland/sprue-core";
import { z } from "zod";
import { MCP_CLIENTS, mcpConfigStatus, type McpClient, type StdioLaunch } from "./mcp-config.ts";

/**
 * App-only commands about connecting agents (hidden from MCP). `launch` is how this install
 * would start `sp mcp`, to tell "set up by this app" from "set up some other way".
 */
export function agentCommands(launch: () => StdioLaunch | Promise<StdioLaunch>) {
  return [
    defineCommand({
      name: "agent.status",
      title: "Agent connection status",
      description: "Whether Sprue is already in an agent's MCP config.",
      kind: "query",
      internal: true,
      input: z.object({ client: z.enum(MCP_CLIENTS as [McpClient, ...McpClient[]]) }),
      handler: async ({ client }) => mcpConfigStatus(client, await launch()),
    }),
    defineCommand({
      name: "agent.statusAll",
      title: "All agent connection statuses",
      description: "Whether Sprue is in each supported agent's MCP config.",
      kind: "query",
      internal: true,
      input: z.object({}),
      handler: async () => {
        const current = await launch();
        return {
          agents: await Promise.all(MCP_CLIENTS.map((client) => mcpConfigStatus(client, current))),
        };
      },
    }),
  ];
}
