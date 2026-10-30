import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import {
  homeProjectId,
  projectEntries,
  projectHref,
  rememberProject,
  type ProjectEntry,
} from "../store.ts";
import { DeleteProjectDialog, ProjectDialog } from "./Dialogs.tsx";
import { isTypingTarget } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { MenuButton, MenuPopup, type MenuItem } from "./Menu.tsx";
import { ProjectIcon } from "./ProjectIcon.tsx";

const SIDEBAR_KEY = "sprue.sidebar";

export const sidebarExpanded = signal(localStorage.getItem(SIDEBAR_KEY) !== "collapsed");

function setExpanded(expanded: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, expanded ? "expanded" : "collapsed");
  sidebarExpanded.value = expanded;
}

/** The project the current page belongs to (remembered as "home" for next time). */
export function useActiveProject(): string | undefined {
  const { path } = useLocation();
  const project = /^\/projects\/([^/]+)/.exec(path);
  const active = project ? decodeURIComponent(project[1]!) : undefined;
  useEffect(() => {
    if (active) rememberProject(active);
  }, [active]);
  return active ?? homeProjectId();
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

interface Tip {
  text: string;
  sub?: string;
  top: number;
  left: number;
}

export function Sidebar() {
  const { path } = useLocation();
  const onSettings = path === "/settings";
  const activeProject = useActiveProject();
  // Settings isn't part of a project, so no project is highlighted there.
  const active = onSettings ? undefined : activeProject;
  const expanded = sidebarExpanded.value;
  const entries = projectEntries.value;
  const [tip, setTip] = useState<Tip | null>(null);
  const [menu, setMenu] = useState<{ project: ProjectEntry; x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<
    { kind: "new" } | { kind: "edit" | "delete"; project: ProjectEntry } | null
  >(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setTip(null);
      setExpanded(!sidebarExpanded.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Collapsed: name + counts for every icon. Expanded: names are visible, so just the counts.
  const tipHandlers = (text: string, sub?: string) => ({
    onMouseEnter: (e: MouseEvent) => showTip(e.currentTarget as HTMLElement, text, sub),
    onFocus: (e: FocusEvent) => showTip(e.currentTarget as HTMLElement, text, sub),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });
  const showTip = (el: HTMLElement, text: string, sub?: string) => {
    const rect = el.getBoundingClientRect();
    setTip({ text, sub, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const menuItems = (p: ProjectEntry): MenuItem[] => [
    { label: "Edit project…", onSelect: () => setDialog({ kind: "edit", project: p }) },
    {
      label: "Delete project…",
      danger: true,
      onSelect: () => setDialog({ kind: "delete", project: p }),
    },
  ];

  return (
    <nav class={`sidebar ${expanded ? "expanded" : "collapsed"}`} aria-label="Projects">
      <ul class="project-list">
        {entries.map((p) => {
          const counts = [
            plural(p.prototypes, "prototype"),
            ...(p.systems ? [plural(p.systems, "system")] : []),
          ].join(" · ");
          const isActive = p.id === active;
          return (
            <li key={p.id} class="project-item">
              <a
                href={projectHref(p.id)}
                class={`project-link ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${p.name}, ${counts}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTip(null);
                  setMenu({ project: p, x: e.clientX, y: e.clientY });
                }}
                {...(expanded ? tipHandlers(counts) : tipHandlers(p.name, counts))}
              >
                <ProjectIcon project={p} size={expanded ? 22 : 36} />
                {expanded && <span class="project-name">{p.name}</span>}
              </a>
              {expanded && (
                <MenuButton class="project-menu" label={`${p.name} options`} items={menuItems(p)} />
              )}
            </li>
          );
        })}
        <li>
          <button
            type="button"
            class="project-link new-project"
            aria-label="New project"
            onClick={() => {
              setTip(null);
              setDialog({ kind: "new" });
            }}
            {...(expanded ? {} : tipHandlers("New project"))}
          >
            <span class="new-project-icon" aria-hidden="true">
              <Icon name="plus" size={expanded ? 14 : 18} />
            </span>
            {expanded && <span class="project-name">New project</span>}
          </button>
        </li>
      </ul>

      <div class="sidebar-foot">
        <a
          href="/settings"
          class={`sidebar-toggle sidebar-settings ${onSettings ? "active" : ""}`}
          aria-label="Settings"
          aria-current={onSettings ? "page" : undefined}
          onClick={() => setTip(null)}
          {...(expanded ? {} : tipHandlers("Settings"))}
        >
          <Icon name="settings" />
          {expanded && <span>Settings</span>}
        </a>
        <button
          type="button"
          class="sidebar-toggle"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          onClick={() => {
            setTip(null);
            setExpanded(!expanded);
          }}
          {...(expanded ? {} : tipHandlers("Expand sidebar", "["))}
        >
          <Icon name="sidebar" />
          {expanded && (
            <>
              <span>Collapse</span>
              <kbd>[</kbd>
            </>
          )}
        </button>
      </div>

      {tip && (
        <div
          class={`sidebar-tooltip ${tip.sub ? "" : "single"}`}
          role="tooltip"
          style={{ top: `${tip.top}px`, left: `${tip.left}px` }}
        >
          <strong>{tip.text}</strong>
          {tip.sub && <span>{tip.sub}</span>}
        </div>
      )}
      {menu && (
        <MenuPopup
          label={`${menu.project.name} options`}
          items={menuItems(menu.project)}
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
        />
      )}
      {dialog?.kind === "new" && <ProjectDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && (
        <ProjectDialog project={dialog.project} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && (
        <DeleteProjectDialog project={dialog.project} onClose={() => setDialog(null)} />
      )}
    </nav>
  );
}
