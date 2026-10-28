import { Code } from "./Code.tsx";
import { useRef } from "preact/hooks";
import { workspace } from "../store.ts";
import { Icon } from "./Icon.tsx";

export const AGENT_PROMPT = `Use the Scratchpad MCP server for this task.
1. Read the scratchpad://guide resource and call workspace_info to learn the workspace conventions, projects, and reference sources.
2. Look at the registered sources (product codebases) to match the real design system: tokens, components, and copy.
3. Create 3 prototype variants exploring: <describe the problem or flow>. Put them in the right project and one group, and use prototype_createVariant for alternatives.
4. Share the viewer URLs when you're done.`;

export function ConnectAgentButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const info = workspace.value;
  const mcpUrl = `${info?.urls.app ?? location.origin}/mcp`;
  return (
    <>
      <button type="button" class="button" onClick={() => dialog.current?.showModal()}>
        Connect an agent
      </button>
      <dialog
        ref={dialog}
        class="dialog"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <header class="dialog-header">
          <h2>Connect an agent</h2>
          <button
            type="button"
            class="icon-button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="x" />
          </button>
        </header>
        <p>
          Any MCP-capable agent can create and iterate on prototypes here. They appear in the
          gallery as the agent writes them.
        </p>
        <h3>Stdio (recommended)</h3>
        <p>
          Prints user-level config snippets for VS Code, Claude Code, Cursor, and Copilot CLI. They
          work from any folder, since everything lives in{" "}
          <code>{info?.root ?? "~/.scratchpad"}</code>:
        </p>
        <Code code="sp mcp-config" lang="shellscript" />
        <h3>HTTP</h3>
        <p>While this server is running, point HTTP-capable MCP clients at:</p>
        <Code code={mcpUrl} lang="text" />
        <h3>Starter prompt</h3>
        <Code code={AGENT_PROMPT} lang="text" />
      </dialog>
    </>
  );
}
