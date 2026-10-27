import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { connected, projectEntries, projectHref } from "../store.ts";
import { ConnectAgentButton } from "./ConnectAgent.tsx";
import { useActiveProject } from "./Sidebar.tsx";

/** Routes that render their own full-width toolbar instead of the app header. */
export function isImmersive(path: string): boolean {
  return path.startsWith("/p/") || path === "/compare";
}

export function Header() {
  const { path } = useLocation();
  const active = useActiveProject();
  if (isImmersive(path)) return null;
  const project = projectEntries.value.find((p) => p.id === active);
  const inSystems = path.startsWith("/systems") || /^\/projects\/[^/]+\/systems/.test(path);
  return (
    <header class="app-header">
      {project && (
        <nav class="app-nav" aria-label="Sections">
          <a
            href={projectHref(project.id)}
            class={inSystems ? "" : "active"}
            aria-current={inSystems ? undefined : "page"}
          >
            Prototypes
          </a>
          <a
            href={projectHref(project.id, "systems")}
            class={inSystems ? "active" : ""}
            aria-current={inSystems ? "page" : undefined}
          >
            Design systems
          </a>
        </nav>
      )}
      <div class="app-header-end">
        <ConnectAgentButton />
      </div>
    </header>
  );
}

/** Live updates are the default, so only surface the connection when it's lost. */
export function ConnectionToast() {
  const [show, setShow] = useState(false);
  const isConnected = connected.value;
  useEffect(() => {
    if (isConnected) {
      setShow(false);
      return;
    }
    // Grace period: avoids a flash before the first event arrives and during quick reconnects.
    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, [isConnected]);
  if (!show) return null;
  return (
    <div class="connection-toast" role="status">
      Reconnecting to the server… live updates are paused
    </div>
  );
}
