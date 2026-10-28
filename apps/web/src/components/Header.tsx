import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { connected, projectEntries, projectHref, type ProjectSection } from "../store.ts";
import { ConnectAgentButton } from "./ConnectAgent.tsx";
import { useActiveProject } from "./Sidebar.tsx";

/** Routes that render their own full-width toolbar instead of the app header. */
export function isImmersive(path: string): boolean {
  return path.startsWith("/p/") || path === "/compare";
}

const SECTIONS: { id: ProjectSection; label: string }[] = [
  { id: "prototypes", label: "Prototypes" },
  { id: "systems", label: "Design systems" },
  { id: "feedback", label: "Feedback" },
  { id: "handoff", label: "Handoff" },
];

/** The project section a path belongs to (a design system's pages count as "systems"). */
function sectionOf(path: string): ProjectSection {
  if (path.startsWith("/systems")) return "systems";
  const match = /^\/projects\/[^/]+\/([^/]+)/.exec(path);
  return SECTIONS.find((s) => s.id === match?.[1])?.id ?? "prototypes";
}

export function Header() {
  const { path } = useLocation();
  const active = useActiveProject();
  if (isImmersive(path)) return null;
  // App-level pages (settings) aren't part of a project, so they get no section tabs.
  const project =
    path === "/settings" ? undefined : projectEntries.value.find((p) => p.id === active);
  const current = sectionOf(path);
  return (
    <header class="app-header">
      {project && (
        <nav class="app-nav" aria-label="Sections">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={projectHref(project.id, section.id)}
              class={current === section.id ? "active" : ""}
              aria-current={current === section.id ? "page" : undefined}
            >
              {section.label}
            </a>
          ))}
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
