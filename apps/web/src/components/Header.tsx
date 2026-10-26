import { useLocation } from "preact-iso";
import { connected, workspace } from "../store.ts";
import { ConnectAgentButton } from "./ConnectAgent.tsx";

export function Header() {
  const info = workspace.value;
  const { path } = useLocation();
  const inSystems = path.startsWith("/systems");
  return (
    <header class="app-header">
      <a href="/" class="brand">
        <img src="/favicon.svg" alt="" width={22} height={22} />
        <span>{info?.name ?? "design-tool"}</span>
      </a>
      <nav class="app-nav">
        <a href="/" class={inSystems ? "" : "active"}>
          Prototypes
        </a>
        <a href="/systems" class={inSystems ? "active" : ""}>
          Design systems
        </a>
      </nav>
      <div class="app-header-end">
        <span
          class={`live-dot ${connected.value ? "on" : "off"}`}
          title={
            connected.value
              ? "Live: changes appear automatically"
              : "Disconnected from server, retrying…"
          }
        >
          {connected.value ? "Live" : "Offline"}
        </span>
        <ConnectAgentButton />
      </div>
    </header>
  );
}
