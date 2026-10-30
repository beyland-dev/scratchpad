import { useState } from "preact/hooks";
import { AgentLogo, type AgentLogoName } from "./AgentLogo.tsx";
import { Code, type CodeLang } from "./Code.tsx";
import { Icon } from "./Icon.tsx";
import { ApiError, call } from "../api.ts";
import { desktopPlatform } from "../icon.ts";
import { workspace } from "../store.ts";

export const AGENT_PROMPT = `Use the Sprue MCP server for this task.
1. Read the sprue://guide resource and call workspace_info to learn the workspace conventions, projects, and reference sources.
2. Look at the registered sources (product codebases) to match the real design system: tokens, components, and copy.
3. Create 3 design variants exploring: <describe the problem or flow>. Put them in the right project and one group, and use prototype_createVariant for alternatives.
4. Share the viewer URLs when you're done.`;

/** Runs the Sprue CLI without installing it globally. */
const SP = "npx -y @beyland/sprue";

type AgentId =
  | "copilot"
  | "antigravity"
  | "muse"
  | "claude"
  | "codex"
  | "cursor"
  | "opencode"
  | "pi"
  | "other";

const AGENTS: { id: AgentId; label: string; logo?: AgentLogoName }[] = [
  { id: "copilot", label: "Copilot", logo: "copilot" },
  { id: "claude", label: "Claude", logo: "claude" },
  { id: "codex", label: "Codex", logo: "codex" },
  { id: "opencode", label: "OpenCode", logo: "opencode" },
  { id: "pi", label: "Pi", logo: "pi" },
  { id: "cursor", label: "Cursor", logo: "cursor" },
  { id: "antigravity", label: "Antigravity", logo: "antigravity" },
  { id: "muse", label: "Muse Code", logo: "muse" },
  { id: "other", label: "Other" },
];

/** What to do after connecting, shown once Sprue is set up. */
const AFTER_CONNECT: Record<Exclude<AgentId, "other">, string> = {
  copilot: "Reload VS Code or start a new Copilot session to use it.",
  claude: "Start a new Claude session to use it.",
  codex: "Start a new Codex session to use it.",
  opencode: "Restart OpenCode to use it.",
  pi: "Run /reload in open Pi sessions to use it.",
  cursor: "Restart Cursor to use it.",
  antigravity: "Refresh Installed MCP Servers in Antigravity to use it.",
  muse: "Start a new Muse Code session to use it.",
};

/** Setup steps per agent: what to run, and what it does. */
function guidance(
  agent: AgentId,
  mcpUrl: string,
): { text: string; code: string; lang: CodeLang }[] {
  const install = (client: string, text: string) => [
    { text, code: `${SP} mcp-config ${client} --install`, lang: "shellscript" as const },
  ];
  switch (agent) {
    case "copilot":
      return install(
        "copilot",
        "Add Sprue for Copilot in VS Code, the Copilot app, and the Copilot CLI. Then reload VS Code or start a new session.",
      );
    case "claude":
      return install(
        "claude",
        "Register Sprue for all your Claude projects (runs claude mcp add for you).",
      );
    case "codex":
      return install(
        "codex",
        "Add Sprue for the Codex CLI and IDE extension (runs codex mcp add for you).",
      );
    case "antigravity":
      return install(
        "antigravity",
        "Add Sprue to ~/.gemini/config/mcp_config.json, shared by Antigravity 2.0, the IDE, and the CLI. Then refresh Installed MCP Servers.",
      );
    case "muse":
      return install(
        "muse",
        "Add Sprue to ~/.config/muse/settings.json, then start a new Muse Code session.",
      );
    case "cursor":
      return install("cursor", "Add Sprue to ~/.cursor/mcp.json, then restart Cursor.");
    case "opencode":
      return install("opencode", "Add Sprue to ~/.config/opencode/opencode.json.");
    case "pi":
      return install(
        "pi",
        "Add Sprue to ~/.pi/agent/mcp.json (Pi 0.99 or later), then /reload open sessions.",
      );
    case "other":
      return [
        {
          text: "Point any MCP client at the HTTP endpoint (available while Sprue is running)…",
          code: mcpUrl,
          lang: "text",
        },
        { text: "…or launch it over stdio.", code: `${SP} mcp`, lang: "shellscript" },
      ];
  }
}

interface AgentStatus {
  file: string;
  configured: boolean;
  current: boolean;
}

type StatusState =
  | { kind: "loading" }
  | { kind: "known"; status: AgentStatus }
  | { kind: "unknown" };

/** "/Users/me/.cursor/mcp.json" → "~/.cursor/mcp.json". */
function tildify(file: string): string {
  return file.replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)/, "~");
}

/** The details for one agent: its connection state, a Connect button (desktop), and the command. */
function AgentPanel({
  agent,
  label,
  state,
  onStatus,
  mcpUrl,
}: {
  agent: AgentId;
  label: string;
  state: StatusState | undefined;
  onStatus: (status: AgentStatus) => void;
  mcpUrl: string;
}) {
  const desktop = Boolean(desktopPlatform());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const steps = guidance(agent, mcpUrl);

  if (agent === "other")
    return (
      <div class="agent-panel" id="agent-panel">
        {steps.map((step) => (
          <div class="agent-step" key={step.code}>
            <p>{step.text}</p>
            <Code code={step.code} lang={step.lang} />
          </div>
        ))}
      </div>
    );

  const connect = async (force = false) => {
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      const result = await call<{ file: string }>("app.connectAgent", { client: agent, force });
      onStatus({ file: result.file, configured: true, current: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "CONFLICT") setConflict(true);
      else setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const status = state?.kind === "known" ? state.status : undefined;
  const terminal = (
    <div class="agent-step">
      <Code code={steps[0]!.code} lang={steps[0]!.lang} />
      <p class="agent-requires">Runs with npx and needs Node.js 22.18 or later.</p>
    </div>
  );

  return (
    <div class="agent-panel" id="agent-panel">
      {state?.kind === "loading" ? (
        <p class="agent-checking">Checking {label}…</p>
      ) : status?.configured ? (
        <>
          <div class={`agent-connected ${status.current ? "" : "stale"}`}>
            <span class="agent-connected-icon" aria-hidden="true">
              <Icon name={status.current ? "check" : "alert"} size={16} />
            </span>
            <div class="agent-connected-text">
              <strong>
                {status.current ? `Connected to ${label}` : `Sprue is set up for ${label}`}
              </strong>
              <span>
                {status.current
                  ? `In ${tildify(status.file)}. ${AFTER_CONNECT[agent]}`
                  : `In ${tildify(status.file)}, launched by another Sprue install or an older version.`}
              </span>
            </div>
            {desktop && !status.current && (
              <button
                type="button"
                class="button small"
                disabled={busy}
                onClick={() => void connect(true)}
              >
                {busy ? "Updating…" : "Use this app"}
              </button>
            )}
          </div>
          <details class="agent-terminal">
            <summary>Set up from a terminal</summary>
            {terminal}
          </details>
        </>
      ) : (
        <>
          <p class="agent-intro">{steps[0]!.text}</p>
          {desktop && (
            <div class="agent-connect">
              <button
                type="button"
                class="button primary small"
                disabled={busy}
                onClick={() => void connect()}
              >
                {busy ? "Connecting…" : `Connect ${label}`}
              </button>
              {conflict && (
                <span class="agent-connect-status" role="status">
                  Sprue is already set up differently for {label}.{" "}
                  <button type="button" class="link-button" onClick={() => void connect(true)}>
                    Replace it
                  </button>
                </span>
              )}
            </div>
          )}
          {desktop ? (
            <details class="agent-terminal">
              <summary>Or set it up from a terminal</summary>
              {terminal}
            </details>
          ) : (
            terminal
          )}
        </>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AgentConnectionGuide({
  agentsOnly = false,
  onConnected,
}: {
  /** Just the agents (the onboarding checklist covers codebases and prompts itself). */
  agentsOnly?: boolean;
  /** Called when an agent turns out to be, or becomes, connected. */
  onConnected?: () => void;
} = {}) {
  const info = workspace.value;
  const mcpUrl = `${info?.urls.app ?? location.origin}/mcp`;
  const [open, setOpen] = useState<AgentId | null>(null);
  const [states, setStates] = useState<Partial<Record<AgentId, StatusState>>>({});
  const setStatus = (id: AgentId, state: StatusState) => {
    setStates((prev) => ({ ...prev, [id]: state }));
    if (state.kind === "known" && state.status.configured) onConnected?.();
  };

  const toggle = (id: AgentId) => {
    const next = open === id ? null : id;
    setOpen(next);
    // Check once, the first time an agent is opened.
    if (!next || next === "other" || states[next]) return;
    setStatus(next, { kind: "loading" });
    call<AgentStatus>("agent.status", { client: next })
      .then((status) => setStatus(next, { kind: "known", status }))
      .catch(() => setStatus(next, { kind: "unknown" }));
  };

  const current = AGENTS.find((a) => a.id === open);
  return (
    <div class="agent-guide">
      <div class="agent-options" aria-label="Agents">
        {AGENTS.map((option) => {
          const state = states[option.id];
          const connected = state?.kind === "known" && state.status.configured;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={open === option.id}
              aria-expanded={open === option.id}
              aria-controls={open === option.id ? "agent-panel" : undefined}
              class={`agent-option ${open === option.id ? "active" : ""}`}
              onClick={() => toggle(option.id)}
            >
              <span class="agent-logo">
                {option.logo ? (
                  <AgentLogo name={option.logo} size={18} />
                ) : (
                  <Icon name="plug" size={18} />
                )}
              </span>
              {option.label}
              {connected && (
                <span class="agent-option-badge" title="Connected">
                  <Icon name="check" size={12} />
                  <span class="visually-hidden">Connected</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current && (
        <AgentPanel
          key={current.id}
          agent={current.id}
          label={current.label}
          state={states[current.id]}
          onStatus={(status) => setStatus(current.id, { kind: "known", status })}
          mcpUrl={mcpUrl}
        />
      )}
      {!agentsOnly && (
        <div class="connection-options">
          <details>
            <summary>Connect a product codebase</summary>
            <div class="connection-detail">
              <p>Create its Sprue project, then register the real codebase as read-only context.</p>
              <Code
                code={`${SP} project create --name "VS Code"
  ${SP} source add ~/Code/vscode --name "VS Code" --notes "Tokens and components live in src/vs"`}
                lang="shellscript"
              />
            </div>
          </details>
          <details>
            <summary>Starter prompt</summary>
            <div class="connection-detail">
              <Code code={AGENT_PROMPT} lang="text" />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
