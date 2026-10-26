import { Code, type CodeLang } from "./Code.tsx";
import { useRef, useState } from "preact/hooks";
import { workspace } from "../store.ts";
import { copyText } from "../util.ts";

export const AGENT_PROMPT = `Use the design-tool MCP server for this task.
1. Read the design-tool://guide resource and call workspace_info to learn the workspace conventions and reference sources.
2. Look at the registered sources (product codebases) to match the real design system: tokens, components, and copy.
3. Create 3 prototype variants exploring: <describe the problem or flow>. Put them in one group, and use prototype_createVariant for alternatives.
4. Share the viewer URLs when you're done.`;

function CopyBlock({ text, label, lang }: { text: string; label: string; lang?: CodeLang }) {
  const [copied, setCopied] = useState(false);
  return (
    <div class="copy-block">
      {lang ? <Code code={text} lang={lang} class="copy-code" /> : <pre>{text}</pre>}
      <button
        type="button"
        class="button small"
        onClick={async () => {
          if (await copyText(text)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}

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
            ×
          </button>
        </header>
        <p>
          Any MCP-capable agent can create and iterate on prototypes in this workspace. They appear
          here live.
        </p>
        <h3>Stdio (recommended)</h3>
        <p>Print ready-made config snippets for VS Code, Claude Code, Cursor, and Copilot CLI:</p>
        <CopyBlock
          text={`dt mcp-config${info ? ` -w "${info.root}"` : ""}`}
          label="Copy"
          lang="shellscript"
        />
        <h3>HTTP</h3>
        <p>While this server is running, point HTTP-capable MCP clients at:</p>
        <CopyBlock text={mcpUrl} label="Copy" />
        <h3>Starter prompt</h3>
        <CopyBlock text={AGENT_PROMPT} label="Copy prompt" />
      </dialog>
    </>
  );
}

export { CopyBlock };
