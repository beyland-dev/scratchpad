import { z } from "zod";
import {
  AGENTS_GUIDE_RESOURCE,
  AUDIT_SKILL,
  isCoreError,
  renderAgentsGuide,
  type AnyCommand,
  type Core,
} from "@beyland/scratchpad-core";
import { createMcpHandler, McpServer, type McpHttpHandler } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

export const AUDIT_SKILL_RESOURCE = "scratchpad://skills/design-system-audit";

export const MCP_SERVER_NAME = "scratchpad";
export const MCP_SERVER_VERSION = "0.0.0";

/** MCP tool names can't contain dots in many clients, so `prototype.create` becomes `prototype_create`. */
export function toolNameFor(commandName: string): string {
  return commandName.replaceAll(".", "_");
}

const DESTRUCTIVE = new Set([
  "prototype.delete",
  "source.remove",
  "project.delete",
  "system.delete",
  "component.remove",
  "review.delete",
]);

const INSTRUCTIONS = `Scratchpad manages projects of design prototypes (self-contained HTML folders) and design systems, plus read-only reference sources (product codebases).
Start with workspace_info, and read the ${AGENTS_GUIDE_RESOURCE} resource for conventions. Ids are unique within a project: pass project/id when several projects have the same id.
Create alternatives with prototype_createVariant instead of overwriting, and share the returned viewer URL with the user.`;

function toolResult(value: unknown) {
  // Commands can return `images: [{ mimeType, data }]` (base64), which become MCP image content.
  let images: { mimeType: string; data: string }[] = [];
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { images?: unknown }).images)
  ) {
    const { images: list, ...rest } = value as { images: { mimeType: string; data: string }[] };
    images = list;
    value = rest;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const structured =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  return {
    content: [
      { type: "text" as const, text },
      ...images.map((image) => ({
        type: "image" as const,
        mimeType: image.mimeType,
        data: image.data,
      })),
    ],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

function errorResult(error: unknown) {
  const message = isCoreError(error)
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function registerCommand(server: McpServer, core: Core, command: AnyCommand): void {
  server.registerTool(
    toolNameFor(command.name),
    {
      title: command.title,
      description: command.description,
      inputSchema: command.input,
      annotations: {
        title: command.title,
        readOnlyHint: command.kind === "query",
        destructiveHint: DESTRUCTIVE.has(command.name),
        openWorldHint: false,
      },
    },
    async (args: unknown) => {
      try {
        return toolResult(await core.run(command.name, args ?? {}));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

/** Build an MCP server exposing every registered core command as a tool, plus the workspace guide as a resource. */
export function createMcpServer(core: Core): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );
  for (const command of core.registry.list()) registerCommand(server, core, command);
  server.registerResource(
    "guide",
    AGENTS_GUIDE_RESOURCE,
    {
      title: "Scratchpad guide",
      description: "Conventions for creating and iterating on prototypes in Scratchpad.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: renderAgentsGuide(),
        },
      ],
    }),
  );
  server.registerResource(
    "design-system-audit",
    AUDIT_SKILL_RESOURCE,
    {
      title: "Design system audit skill",
      description: "How to audit a codebase into a verified design-system library with Scratchpad.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: AUDIT_SKILL }],
    }),
  );
  server.registerPrompt(
    "audit_design_system",
    {
      title: "Audit a codebase into a design system",
      description:
        "Start (or continue) auditing a registered source codebase into a Scratchpad design system.",
      argsSchema: z.object({
        source: z.string().optional().describe("Workspace source id of the codebase"),
        system: z.string().optional().describe("Design system id to create or continue"),
        scope: z
          .string()
          .optional()
          .describe("What to cover, e.g. 'foundations + buttons + inputs'"),
      }),
    },
    ({ source, system, scope }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${AUDIT_SKILL.replace(/^---[\s\S]*?---\n/, "")}\n\n---\n\nAudit ${source ? `source \`${source}\`` : "the registered source codebase"} into the design system \`${system ?? "(choose an id)"}\`.${scope ? ` Scope: ${scope}.` : ""} Follow the procedure above, verify every component, and finish with system_build, system_coverage and system_exportSkill.`,
          },
        },
      ],
    }),
  );
  return server;
}

/** Serve MCP over stdio (for `sp mcp`). Resolves when the transport closes. */
export async function serveStdio(core: Core): Promise<void> {
  const server = createMcpServer(core);
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
  await server.connect(transport);
  await closed;
}

/** Streamable HTTP handler (web-standard `fetch`) for mounting in the app server. */
export function createMcpHttpHandler(core: Core): McpHttpHandler {
  return createMcpHandler(() => createMcpServer(core));
}
