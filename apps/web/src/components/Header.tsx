import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { connected, projectEntries, projectHref, type ProjectSection } from "../store.ts";
import { Icon } from "./Icon.tsx";
import { shortcutLabel } from "../keybindings.ts";
import { ProjectGitControl } from "./GitControl.tsx";
import { setSidebarExpanded, sidebarExpanded, useActiveProject } from "./Sidebar.tsx";

/** Routes that render their own full-width toolbar instead of the app header. */
export function isImmersive(path: string): boolean {
  return /^\/projects\/[^/]+\/p\//.test(path) || path === "/compare";
}

const SECTIONS: { id: ProjectSection; label: string }[] = [
  { id: "prototypes", label: "Design" },
  { id: "feedback", label: "Feedback" },
  { id: "handoff", label: "Handoff" },
];

/** The project section a path belongs to (a design system's pages count as "systems"). */
function sectionOf(path: string): ProjectSection {
  const match = /^\/projects\/[^/]+\/([^/]+)/.exec(path);
  return SECTIONS.find((s) => s.id === match?.[1])?.id ?? "prototypes";
}

export function Header({
  desktop,
  platform,
}: {
  desktop?: boolean;
  platform?: string;
} = {}) {
  const { path } = useLocation();
  const active = useActiveProject();
  if (!desktop && isImmersive(path)) return null;
  // App-level pages (settings) aren't part of a project, so they get no section tabs.
  const project = path.startsWith("/settings")
    ? undefined
    : projectEntries.value.find((p) => p.id === active);
  const current = sectionOf(path);
  return (
    <header class={`app-header ${desktop ? `desktop-titlebar ${platform ?? ""}` : ""}`}>
      <div class="app-header-start">
        <button
          type="button"
          class="icon-button"
          aria-label={sidebarExpanded.value ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarExpanded.value}
          title={`${sidebarExpanded.value ? "Collapse" : "Expand"} sidebar ${shortcutLabel("sidebar")}`.trim()}
          onClick={() => setSidebarExpanded(!sidebarExpanded.value)}
        >
          <Icon name={sidebarExpanded.value ? "sidebar-filled" : "sidebar"} size={18} />
        </button>
      </div>
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
        {project && <ProjectGitControl key={project.id} project={project.id} />}
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
