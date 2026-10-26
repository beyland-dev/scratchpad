import { workspace } from "../store.ts";
import { AGENT_PROMPT, CopyBlock } from "./ConnectAgent.tsx";

export function EmptyState() {
  const root = workspace.value?.root;
  return (
    <section class="empty">
      <h1>No prototypes yet</h1>
      <p>
        Prototypes are folders of HTML in <code>.design/prototypes/</code>. Ask an agent to make
        some, or create one from the CLI.
      </p>
      <div class="empty-grid">
        <div>
          <h2>With an agent</h2>
          <CopyBlock text={AGENT_PROMPT} label="Copy prompt" />
        </div>
        <div>
          <h2>From the CLI</h2>
          <CopyBlock
            text={`dt prototype create --title "My first idea" --html @./index.html${root ? ` -w "${root}"` : ""}`}
            label="Copy"
          />
        </div>
      </div>
    </section>
  );
}
