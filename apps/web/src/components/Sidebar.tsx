import { signal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import {
  createRequest,
  homeProjectId,
  projectEntries,
  projectHref,
  rememberProject,
  type ProjectEntry,
} from "../store.ts";
import { DeleteProjectDialog, ProjectDialog } from "./Dialogs.tsx";
import { ariaKeyshortcuts, shortcutLabel, type ShortcutId } from "../keybindings.ts";
import { Icon } from "./Icon.tsx";
import { MenuButton, MenuPopup, type MenuItem } from "./Menu.tsx";
import { ProjectIcon } from "./ProjectIcon.tsx";

const SIDEBAR_KEY = "sprue.sidebar";
const SIDEBAR_WIDTH_KEY = "sprue.sidebar.width";
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 420;

/** Collapsed until someone expands it. */
export const sidebarExpanded = signal(localStorage.getItem(SIDEBAR_KEY) === "expanded");
export const sidebarWidth = signal(
  Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 248),
  ),
);

export function setSidebarExpanded(expanded: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, expanded ? "expanded" : "collapsed");
  sidebarExpanded.value = expanded;
}

function setSidebarWidth(width: number): void {
  const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
  sidebarWidth.value = next;
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
  const onSettings = path.startsWith("/settings");
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

  // "New project…" from the command palette (or its shortcut).
  const request = createRequest.value;
  useEffect(() => {
    if (request?.kind !== "project") return;
    createRequest.value = null;
    setTip(null);
    setDialog({ kind: "new" });
  }, [request]);

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
  const startResize = (event: PointerEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = sidebarWidth.value;
    document.body.classList.add("sidebar-resizing");
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => setSidebarWidth(startWidth + next.clientX - startX);
    const stop = () => {
      document.body.classList.remove("sidebar-resizing");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  return (
    <nav
      class={`sidebar ${expanded ? "expanded" : "collapsed"}`}
      aria-label="Projects"
      style={expanded ? `--sidebar-width:${sidebarWidth.value}px` : undefined}
    >
      <ul class="project-list">
        {entries.map((p, index) => {
          const counts = [
            plural(p.prototypes, "design"),
            ...(p.systems ? [plural(p.systems, "system")] : []),
          ].join(" · ");
          const shortcutId = index < 9 ? (`project-${index + 1}` as ShortcutId) : undefined;
          const shortcut = shortcutId && shortcutLabel(shortcutId);
          const tipSub = shortcut ? `${counts} · ${shortcut}` : counts;
          const isActive = p.id === active;
          return (
            <li key={p.id} class="project-item">
              <a
                href={projectHref(p.id)}
                class={`project-link ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${p.name}, ${counts}`}
                aria-keyshortcuts={shortcutId && ariaKeyshortcuts(shortcutId)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTip(null);
                  setMenu({ project: p, x: e.clientX, y: e.clientY });
                }}
                {...(expanded ? tipHandlers(tipSub) : tipHandlers(p.name, tipSub))}
              >
                <ProjectIcon project={p} size={expanded ? 22 : 32} />
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
              <Icon name="plus" size={14} />
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
          aria-keyshortcuts={ariaKeyshortcuts("settings")}
          aria-current={onSettings ? "page" : undefined}
          onClick={() => setTip(null)}
          {...(expanded
            ? tipHandlers(shortcutLabel("settings"))
            : tipHandlers("Settings", shortcutLabel("settings") || undefined))}
        >
          <Icon name="settings" />
          {expanded && <span>Settings</span>}
        </a>
      </div>
      {expanded && (
        <div
          class="sidebar-resizer"
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth.value}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setSidebarWidth(sidebarWidth.value + (event.key === "ArrowRight" ? 10 : -10));
          }}
        />
      )}

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
