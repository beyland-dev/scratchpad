import { Code } from "./Code.tsx";
import { workspace } from "../store.ts";

export const AGENT_PROMPT = `Use the Scratchpad MCP server for this task.
1. Read the scratchpad://guide resource and call workspace_info to learn the workspace conventions, projects, and reference sources.
2. Look at the registered sources (product codebases) to match the real design system: tokens, components, and copy.
3. Create 3 prototype variants exploring: <describe the problem or flow>. Put them in the right project and one group, and use prototype_createVariant for alternatives.
4. Share the viewer URLs when you're done.`;

export function AgentConnectionGuide() {
  const info = workspace.value;
  const mcpUrl = `${info?.urls.app ?? location.origin}/mcp`;
  return (
    <div class="agent-guide">
      <p>
        Any MCP-capable agent can create and iterate on prototypes here. Everything lives in{" "}
        <code>{info?.root ?? "~/.scratchpad"}</code>.
      </p>
      <h3>Connect VS Code</h3>
      <p>Install Scratchpad in the portable Copilot MCP configuration:</p>
      <Code code="sp mcp-config vscode --install" lang="shellscript" />
      <h3>Connect a product codebase</h3>
      <p>Create its Scratchpad project, then register the real codebase as read-only context:</p>
      <Code
        code={`sp project create --name "VS Code"
sp source add ~/Code/vscode --name "VS Code" --notes "Tokens and components live in src/vs"`}
        lang="shellscript"
      />
      <h3>Other MCP clients</h3>
      <p>Print configuration for Claude Code, Cursor, or Copilot CLI:</p>
      <Code
        code={`sp mcp-config claude
sp mcp-config cursor
sp mcp-config copilot-cli`}
        lang="shellscript"
      />
      <h3>HTTP</h3>
      <p>While this app is running, HTTP-capable clients can connect to:</p>
      <Code code={mcpUrl} lang="text" />
      <h3>Starter prompt</h3>
      <Code code={AGENT_PROMPT} lang="text" />
    </div>
  );
}
