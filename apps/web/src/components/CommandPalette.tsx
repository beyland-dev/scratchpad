import { signal } from "@preact/signals";
import { Fragment, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { AGENT_PROMPT } from "./ConnectAgent.tsx";
import { isImmersive } from "./Header.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { setSidebarExpanded, sidebarExpanded, useActiveProject } from "./Sidebar.tsx";
import { call } from "../api.ts";
import { APP_ICONS, appIcon, desktopPlatform, iconSrc, setAppIcon } from "../icon.ts";
import { bindingParts, keybindings, useShortcuts, type ShortcutId } from "../keybindings.ts";
import { prototypeHref } from "../prototype-theme.ts";
import {
  createRequest,
  families,
  familyTitle,
  homeProjectId,
  projectEntries,
  projectHref,
  projectIdOf,
  systemHref,
  systems,
  workspace,
  type ProjectSection,
} from "../store.ts";
import { THEMES, previewTheme, setThemePreference, themePreference } from "../theme.ts";
import { copyText } from "../util.ts";

type Mode = "root" | "theme" | "icon";

/** The desktop app can link its bundled `sp` into PATH on macOS and Linux. */
const canInstallCli = () => ["darwin", "linux"].includes(desktopPlatform() ?? "");

/** Open state: false, or the list it opens on. */
export const paletteOpen = signal<false | Mode>(false);

interface Item {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  icon?: ComponentChildren;
  shortcut?: ShortcutId;
  /** Return a mode to switch lists instead of closing. */
  run: () => Mode | void;
  /** Called while the item is highlighted (theme preview). */
  preview?: () => void;
}

const SECTION_LABELS: Record<Exclude<ProjectSection, "systems">, string> = {
  prototypes: "Design",
  feedback: "Feedback",
  handoff: "Handoff",
};

const glyph = (name: IconName) => <Icon name={name} size={16} />;

/** Lower is better; null hides the item. Prefix and word matches beat scattered letters. */
function score(item: Item, query: string): number | null {
  if (!query) return 0;
  const text = `${item.label} ${item.keywords ?? ""} ${item.hint ?? ""}`.toLowerCase();
  const q = query.toLowerCase().trim();
  const index = text.indexOf(q);
  if (index === 0) return 0;
  if (index > 0) return text[index - 1] === " " ? 1 : 2;
  let at = 0;
  for (const char of q.replace(/\s+/g, "")) {
    at = text.indexOf(char, at);
    if (at < 0) return null;
    at++;
  }
  return 3;
}

/** Everything the app can do, as commands; also registers the global shortcuts that run them. */
export function CommandPalette() {
  const { route, path } = useLocation();
  const active = useActiveProject();
  const project = path.startsWith("/settings") ? homeProjectId() : (active ?? homeProjectId());
  const go = (href: string) => route(href);

  const actions = {
    newDesign: () => {
      if (!project) return;
      go(projectHref(project));
      createRequest.value = { kind: "design", project };
    },
    newSystem: () => {
      if (!project) return;
      go(projectHref(project));
      createRequest.value = { kind: "system", project };
    },
    newProject: () => {
      // The sidebar owns the dialog, and isn't shown on full-screen pages like the viewer.
      if (isImmersive(path) && project) go(projectHref(project));
      createRequest.value = { kind: "project" };
    },
  };

  useShortcuts({
    palette: () => {
      if (paletteOpen.value) previewTheme(null);
      paletteOpen.value = paletteOpen.value ? false : "root";
    },
    theme: () => {
      paletteOpen.value = "theme";
    },
    "new-design": () => (project ? actions.newDesign() : false),
    "new-system": () => (project ? actions.newSystem() : false),
    "new-project": actions.newProject,
    settings: () => go("/settings"),
    sidebar: () => setSidebarExpanded(!sidebarExpanded.value),
    ...Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [
        `project-${i + 1}`,
        () => {
          const target = projectEntries.value[i];
          // No project there: let the key through (e.g. the browser's own tab switch).
          if (!target) return false;
          go(projectHref(target.id));
        },
      ]),
    ),
  });

  const mode = paletteOpen.value;
  if (!mode) return null;

  const rootItems = (): Item[] => {
    const items: Item[] = [];
    const entry = projectEntries.value.find((p) => p.id === project);
    if (entry)
      for (const [section, label] of Object.entries(SECTION_LABELS))
        items.push({
          id: `section-${section}`,
          label: `Go to ${label}`,
          group: "Navigate",
          hint: entry.name,
          icon: glyph("chevron-right"),
          run: () => go(projectHref(entry.id, section as ProjectSection)),
        });
    items.push({
      id: "settings",
      label: "Open Settings",
      group: "Navigate",
      keywords: "preferences",
      icon: glyph("settings"),
      shortcut: "settings",
      run: () => go("/settings"),
    });
    projectEntries.value.forEach((p, index) =>
      items.push({
        id: `project-${p.id}`,
        label: p.name,
        group: "Projects",
        hint: "Project",
        keywords: "open switch project",
        icon: glyph("columns"),
        shortcut: index < 9 ? (`project-${index + 1}` as ShortcutId) : undefined,
        run: () => go(projectHref(p.id)),
      }),
    );
    for (const s of systems.value)
      items.push({
        id: `system-${s.id}`,
        label: s.name,
        group: "Design systems",
        hint: projectEntries.value.find((p) => p.id === projectIdOf(s))?.name,
        keywords: "design system components tokens",
        icon: glyph("components"),
        run: () => go(systemHref(s.id)),
      });
    for (const family of families.value) {
      const latest = family[family.length - 1]!;
      items.push({
        id: `design-${latest.id}`,
        label: familyTitle(latest),
        group: "Designs",
        hint: projectEntries.value.find((p) => p.id === latest.project)?.name,
        keywords: `design prototype ${latest.group ?? ""} ${latest.tags.join(" ")}`,
        icon: glyph("monitor"),
        run: () => go(prototypeHref(latest.id)),
      });
    }
    if (project)
      items.push(
        {
          id: "new-design",
          label: "New design…",
          group: "Create",
          keywords: "create prototype",
          icon: glyph("plus"),
          shortcut: "new-design",
          run: actions.newDesign,
        },
        {
          id: "new-system",
          label: "New design system…",
          group: "Create",
          keywords: "create",
          icon: glyph("plus"),
          shortcut: "new-system",
          run: actions.newSystem,
        },
      );
    items.push(
      {
        id: "new-project",
        label: "New project…",
        group: "Create",
        keywords: "create",
        icon: glyph("plus"),
        shortcut: "new-project",
        run: actions.newProject,
      },
      {
        id: "theme",
        label: "Change theme…",
        group: "Preferences",
        keywords: "appearance color dark light mode",
        icon: glyph("sun"),
        shortcut: "theme",
        run: () => "theme",
      },
      {
        id: "icon",
        label: "Change app icon…",
        group: "Preferences",
        keywords: "dock favicon",
        icon: glyph("components"),
        run: () => "icon",
      },
      {
        id: "sidebar",
        label: sidebarExpanded.value ? "Collapse sidebar" : "Expand sidebar",
        group: "Preferences",
        icon: glyph(sidebarExpanded.value ? "sidebar-filled" : "sidebar"),
        shortcut: "sidebar",
        run: () => setSidebarExpanded(!sidebarExpanded.value),
      },
      {
        id: "shortcuts",
        label: "Customize keyboard shortcuts",
        group: "Preferences",
        keywords: "keybindings keys hotkeys",
        icon: glyph("settings"),
        run: () => go("/settings/shortcuts"),
      },
      {
        id: "connect",
        label: "Connect an agent",
        group: "Agents",
        keywords: "mcp copilot vscode claude codex antigravity muse cursor opencode pi",
        icon: glyph("plug"),
        run: () => go("/settings#connections"),
      },
      {
        id: "copy-mcp",
        label: "Copy MCP endpoint URL",
        group: "Agents",
        icon: glyph("share"),
        run: () => void copyText(`${workspace.value?.urls.app ?? location.origin}/mcp`),
      },
      {
        id: "copy-prompt",
        label: "Copy starter prompt",
        group: "Agents",
        icon: glyph("message"),
        run: () => void copyText(AGENT_PROMPT),
      },
      ...(canInstallCli()
        ? [
            {
              id: "install-cli",
              label: "Install 'sp' command in PATH",
              group: "Shell",
              keywords: "cli terminal shell path command line",
              icon: glyph("upload"),
              run: () => void call("app.installCli").catch(() => {}),
            },
            {
              id: "uninstall-cli",
              label: "Uninstall 'sp' command from PATH",
              group: "Shell",
              keywords: "cli terminal shell path command line remove",
              icon: glyph("trash"),
              run: () => void call("app.uninstallCli").catch(() => {}),
            },
          ]
        : []),
      {
        id: "trash",
        label: "Open trash",
        group: "Storage",
        keywords: "deleted restore",
        icon: glyph("trash"),
        run: () => go("/settings#trash"),
      },
      {
        id: "workspace",
        label: "Change workspace folder",
        group: "Storage",
        keywords: "location path",
        icon: glyph("upload"),
        run: () => go("/settings#storage"),
      },
    );
    return items;
  };

  const themeItems = (): Item[] =>
    [{ id: "system" as const, label: "System", scheme: "" }, ...THEMES].map((theme) => ({
      id: theme.id,
      label: theme.label,
      group:
        "contrast" in theme
          ? "High contrast"
          : theme.scheme === "light"
            ? "Light"
            : theme.scheme === "dark"
              ? "Dark"
              : "Mode",
      hint: themePreference.value === theme.id ? "Current" : undefined,
      icon:
        theme.id === "system" ? (
          <span class="palette-swatch theme-dot-fill split" aria-hidden="true">
            <span data-theme="light" />
            <span data-theme="dark" />
          </span>
        ) : (
          <span class="palette-swatch theme-dot-fill" data-theme={theme.id} aria-hidden="true" />
        ),
      preview: () => previewTheme(theme.id),
      run: () => setThemePreference(theme.id),
    }));

  const iconItems = (): Item[] =>
    APP_ICONS.map((icon) => ({
      id: icon.id,
      label: icon.label,
      group: "App icon",
      hint: appIcon.value === icon.id ? "Current" : undefined,
      icon: <img class="palette-app-icon" src={iconSrc(icon.id)} alt="" />,
      run: () => void setAppIcon(icon.id).catch(() => {}),
    }));

  const items = mode === "theme" ? themeItems() : mode === "icon" ? iconItems() : rootItems();
  const initial =
    mode === "theme" ? themePreference.value : mode === "icon" ? appIcon.value : undefined;
  return (
    <PaletteDialog
      key={mode}
      mode={mode}
      items={items}
      initial={initial}
      placeholder={
        mode === "theme"
          ? "Pick a theme…"
          : mode === "icon"
            ? "Pick an app icon…"
            : "Type a command or search…"
      }
    />
  );
}

function PaletteDialog({
  mode,
  items,
  initial,
  placeholder,
}: {
  mode: Mode;
  items: Item[];
  initial?: string;
  placeholder: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const ranked = items
      .map((item, order) => ({ item, order, rank: score(item, query) }))
      .filter((r): r is { item: Item; order: number; rank: number } => r.rank !== null);
    if (query) ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
    return ranked.map((r) => r.item);
  }, [items, query]);
  const [activeId, setActiveId] = useState<string | undefined>(initial);
  const activeIndex = Math.max(
    0,
    visible.findIndex((item) => item.id === activeId),
  );
  const current = visible[activeIndex];

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  useEffect(() => {
    current?.preview?.();
    list.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  const close = (keepPreview = false) => {
    if (!keepPreview) previewTheme(null);
    paletteOpen.value = false;
  };
  const run = (item: Item | undefined) => {
    if (!item) return;
    const next = item.run();
    if (next) {
      paletteOpen.value = next;
      return;
    }
    close(true);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const move = (step: number) => {
      event.preventDefault();
      if (!visible.length) return;
      setActiveId(visible[(activeIndex + step + visible.length) % visible.length]!.id);
    };
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter") {
      event.preventDefault();
      run(current);
    } else if (event.key === "Backspace" && !query && mode !== "root") {
      event.preventDefault();
      back();
    }
  };
  const back = () => {
    previewTheme(null);
    paletteOpen.value = "root";
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      class="palette"
      aria-label="Command palette"
      onCancel={(event) => {
        // Escape: from a sub-list back to all commands, else close.
        event.preventDefault();
        if (mode === "root") close();
        else back();
      }}
      onClick={(event) => event.target === dialog.current && close()}
    >
      <div class="palette-search">
        {mode !== "root" ? (
          <button
            type="button"
            class="icon-button palette-back"
            aria-label="Back to all commands"
            onClick={back}
          >
            <Icon name="chevron-left" size={16} />
          </button>
        ) : (
          <Icon name="search" size={16} />
        )}
        <input
          class="palette-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={current ? `palette-${current.id}` : undefined}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          autoFocus
          spellcheck={false}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setActiveId(undefined);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div class="palette-list" id="palette-list" role="listbox" ref={list}>
        {visible.length === 0 && <p class="palette-empty">No matches</p>}
        {visible.map((item, index) => {
          const heading = !query && item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const binding = item.shortcut ? keybindings.value[item.shortcut] : "";
          return (
            <Fragment key={item.id}>
              {heading && (
                <div class="palette-group" role="presentation">
                  {heading}
                </div>
              )}
              <div
                id={`palette-${item.id}`}
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                class={`palette-item ${index === activeIndex ? "active" : ""}`}
                onMouseMove={() => item.id !== current?.id && setActiveId(item.id)}
                onClick={() => run(item)}
              >
                <span class="palette-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span class="palette-item-label">{item.label}</span>
                {item.hint && <span class="palette-item-hint">{item.hint}</span>}
                {binding && (
                  <span class="palette-keys" aria-hidden="true">
                    {bindingParts(binding).map((part) => (
                      <kbd key={part}>{part}</kbd>
                    ))}
                  </span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
      <footer class="palette-footer" aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>↵</kbd> to {mode === "root" ? "run" : "choose"}
        </span>
        <span>
          <kbd>esc</kbd> {mode === "root" ? "to close" : "to go back"}
        </span>
      </footer>
    </dialog>
  );
}
