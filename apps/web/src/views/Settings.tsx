import { useEffect, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { call } from "../api.ts";
import { AgentConnectionGuide } from "../components/ConnectAgent.tsx";
import { Icon } from "../components/Icon.tsx";
import { ConfirmDialog, useSubmit } from "../components/Modal.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { refresh } from "../store.ts";
import {
  isContrastTheme,
  setThemePreference,
  THEMES,
  themePreference,
  type ThemePreference,
} from "../theme.ts";
import {
  APP_ICONS,
  appIcon,
  desktopPlatform,
  iconSrc,
  setAppIcon,
  type AppIconId,
} from "../icon.ts";
import {
  SHORTCUTS,
  bindingOf,
  bindingParts,
  keybindingOverrides,
  keybindings,
  recordingShortcut,
  resetAllKeybindings,
  resetKeybinding,
  setKeybinding,
  type ShortcutId,
} from "../keybindings.ts";
import type { TrashEntry } from "../types.ts";
import { relativeTime } from "../util.ts";

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "system", label: "System" },
  ...THEMES,
];

export function Settings() {
  const { url } = useLocation();
  // Deep links like /settings#trash (e.g. from the command palette).
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [url]);
  return (
    <div class="page settings">
      <div class="page-head">
        <h1>Settings</h1>
        <p class="muted">Appearance, shortcuts, connections, and local storage.</p>
      </div>

      <div class="settings-stack">
        <section class="settings-card" id="appearance" aria-labelledby="appearance-heading">
          <header class="settings-card-head">
            <div>
              <h2 id="appearance-heading">Appearance</h2>
              <p>Choose how Sprue looks. Designs keep their own styles.</p>
            </div>
          </header>
          <ThemeDots />
        </section>

        <AppIconSettings />

        <ShortcutsSummary />

        <section class="settings-card" id="connections" aria-labelledby="agents-heading">
          <header class="settings-card-head">
            <div>
              <h2 id="agents-heading">Connections</h2>
              <p>Connect an agent and give it product context.</p>
            </div>
          </header>
          <AgentConnectionGuide />
        </section>

        <StorageSettings />
      </div>
    </div>
  );
}

/** Settings list item: a summary, and the way into the full editor. */
function ShortcutsSummary() {
  const customized = Object.keys(keybindingOverrides.value).length;
  const palette = keybindings.value.palette;
  return (
    <section class="settings-card" id="shortcuts" aria-labelledby="shortcuts-heading">
      <header class="settings-card-head compact">
        <div>
          <h2 id="shortcuts-heading">Keyboard shortcuts</h2>
          <p>
            {palette ? (
              <>
                Press{" "}
                {bindingParts(palette).map((part) => (
                  <kbd class="inline-kbd" key={part}>
                    {part}
                  </kbd>
                ))}{" "}
                for the command palette.
              </>
            ) : (
              "Navigate and create without leaving the keyboard."
            )}
            {customized > 0 && ` ${customized} customized.`}
          </p>
        </div>
        <a class="button small" href="/settings/shortcuts">
          Customize
          <Icon name="chevron-right" size={14} />
        </a>
      </header>
    </section>
  );
}

/** /settings/shortcuts: every shortcut, rebindable. */
export function ShortcutsSettings() {
  const customized = Object.keys(keybindingOverrides.value).length > 0;
  return (
    <div class="page settings">
      <div class="page-head">
        <a class="settings-back" href="/settings">
          <Icon name="chevron-left" size={14} />
          Settings
        </a>
        <div class="settings-subhead">
          <div>
            <h1>Keyboard shortcuts</h1>
            <p class="muted">
              Click a shortcut, then press new keys. Backspace clears it, Esc cancels.
            </p>
          </div>
          {customized && (
            <button type="button" class="button small ghost" onClick={resetAllKeybindings}>
              Reset all
            </button>
          )}
        </div>
      </div>
      <ShortcutEditor />
    </div>
  );
}

function ShortcutEditor() {
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const overrides = keybindingOverrides.value;
  const labelOf = (id: ShortcutId) => SHORTCUTS.find((s) => s.id === id)!.label;

  useEffect(() => {
    recordingShortcut.value = recording !== null;
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const bare = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (event.key === "Escape" && bare) {
        setRecording(null);
        return;
      }
      const binding =
        bare && (event.key === "Backspace" || event.key === "Delete") ? "" : bindingOf(event);
      if (binding === null) return;
      const taken = setKeybinding(recording, binding);
      setNote(
        taken.length
          ? `Removed it from ${taken.map((id) => `“${labelOf(id)}”`).join(" and ")}.`
          : null,
      );
      setRecording(null);
    };
    // Capture, so the keys never reach the app's own shortcuts.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      recordingShortcut.value = false;
    };
  }, [recording]);

  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <section class="settings-card" aria-label="Keyboard shortcuts">
      {note && (
        <p class="settings-note" role="status">
          {note}
        </p>
      )}
      <div class="shortcut-groups">
        {groups.map((group) => (
          <div class="shortcut-group" key={group} role="group" aria-label={group}>
            <h3>{group}</h3>
            {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => {
              const binding = keybindings.value[shortcut.id];
              const isRecording = recording === shortcut.id;
              return (
                <div class="shortcut-row" key={shortcut.id}>
                  <span>{shortcut.label}</span>
                  {shortcut.id in overrides && !isRecording && (
                    <button
                      type="button"
                      class="link-button shortcut-reset"
                      onClick={() => resetKeybinding(shortcut.id)}
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    class={`shortcut-keys ${isRecording ? "recording" : ""}`}
                    aria-label={`${shortcut.label}: ${
                      isRecording
                        ? "press new keys"
                        : binding
                          ? bindingParts(binding).join(" ")
                          : "not set"
                    }. Change shortcut`}
                    onClick={() => {
                      setNote(null);
                      setRecording(isRecording ? null : shortcut.id);
                    }}
                    onBlur={() => isRecording && setRecording(null)}
                  >
                    {isRecording ? (
                      <span class="shortcut-prompt">Press keys…</span>
                    ) : binding ? (
                      bindingParts(binding).map((part) => <kbd key={part}>{part}</kbd>)
                    ) : (
                      <span class="shortcut-empty">Not set</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

interface WorkspaceLocation {
  current: string;
  next: string;
  builtin: string;
  configured: string | null;
  env: string | null;
  restartRequired: boolean;
}

const isDesktop = () => Boolean(desktopPlatform());

function StorageSettings() {
  return (
    <section class="settings-card" id="storage" aria-labelledby="storage-heading">
      <header class="settings-card-head">
        <div>
          <h2 id="storage-heading">Storage</h2>
          <p>Where Sprue keeps your work, and what you've deleted.</p>
        </div>
      </header>
      <WorkspaceFolder />
      <TrashSettings />
    </section>
  );
}

function WorkspaceFolder() {
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);
  const result = useCommand<WorkspaceLocation>("workspace.location", {}, [revision]);
  const location = result.data;
  const value = draft ?? location?.next ?? "";
  const dirty = draft !== null && draft.trim() !== location?.next;
  const { busy, error, submit } = useSubmit(async () => {
    if (!location || !dirty) return;
    const folder = value.trim();
    await call("workspace.setLocation", { path: folder === location.builtin ? null : folder });
    setDraft(null);
    setRevision((n) => n + 1);
  });
  const restart = async () => {
    setRestartError(null);
    try {
      await call("app.relaunch");
    } catch (caught) {
      setRestartError((caught as Error).message);
    }
  };
  return (
    <div class="settings-group">
      <div class="settings-row">
        <div class="settings-row-text">
          <h3>
            <label for="workspace-folder">Workspace folder</label>
          </h3>
          <p id="workspace-folder-hint">
            {location?.env ? (
              <>
                Set by <code>${location.env}</code>.
              </>
            ) : (
              "A new or empty folder, or an existing Sprue workspace. Files aren't moved."
            )}
          </p>
        </div>
        <form class="settings-inline-form" onSubmit={submit}>
          <input
            id="workspace-folder"
            class="input mono"
            type="text"
            spellcheck={false}
            value={value}
            disabled={!location || Boolean(location.env) || busy}
            aria-describedby="workspace-folder-hint"
            onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
            onKeyDown={(event) => event.key === "Escape" && setDraft(null)}
          />
          {dirty && (
            <>
              <button type="button" class="button small ghost" onClick={() => setDraft(null)}>
                Reset
              </button>
              <button type="submit" class="button small primary" disabled={busy || !value.trim()}>
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </form>
      </div>
      {location?.restartRequired && !location.env && !dirty && (
        <div class="settings-notice" role="status">
          <span>
            Sprue will use <code>{location.next}</code> after a restart.
            {!isDesktop() && (
              <>
                {" "}
                Restart <code>sp serve</code> to switch.
              </>
            )}
          </span>
          {isDesktop() && (
            <button type="button" class="button small primary" onClick={() => void restart()}>
              Restart now
            </button>
          )}
        </div>
      )}
      {(result.error || error || restartError) && (
        <p class="error" role="alert">
          {error ?? restartError ?? result.error}
        </p>
      )}
    </div>
  );
}

function TrashSettings() {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TrashEntry | null>(null);
  const [emptying, setEmptying] = useState(false);
  const result = useCommand<{ entries: TrashEntry[] }>("trash.list", {}, [revision]);
  const entries = result.data?.entries ?? [];
  const restore = async (entry: TrashEntry) => {
    setBusy(entry.id);
    setError(null);
    try {
      await call("trash.restore", { id: entry.id });
      await refresh();
      setRevision((value) => value + 1);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div class="settings-group" id="trash" aria-labelledby="trash-heading" role="group">
      <div class="settings-row">
        <div class="settings-row-text">
          <h3 id="trash-heading">Trash</h3>
          <p>Restore deleted items or remove them permanently.</p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            class="button small ghost danger-text"
            onClick={() => setEmptying(true)}
          >
            Empty trash…
          </button>
        )}
      </div>
      {(result.error || error) && (
        <p class="error" role="alert">
          {error ?? result.error}
        </p>
      )}
      {result.loading && !result.data ? (
        <p class="muted">Loading trash…</p>
      ) : entries.length ? (
        <div class="trash-list">
          {entries.map((entry) => (
            <div class="trash-row" key={entry.id}>
              <span class="trash-icon" aria-hidden="true">
                <Icon name="trash" size={14} />
              </span>
              <span class="trash-details">
                <strong>{entry.label}</strong>
                <span>
                  {trashKindLabel(entry.kind)}
                  {entry.project ? ` · ${entry.project}` : ""}
                  {` · Deleted ${relativeTime(entry.deletedAt)}`}
                </span>
                {entry.issue && <span class="warn">{entry.issue}</span>}
              </span>
              <button
                type="button"
                class="button small"
                disabled={!entry.restorable || busy !== null}
                title={entry.restorable ? "Restore to its original location" : entry.reason}
                onClick={() => void restore(entry)}
              >
                {busy === entry.id ? "Restoring…" : "Restore"}
              </button>
              <button
                type="button"
                class="button small danger"
                disabled={busy !== null}
                onClick={() => setDeleting(entry)}
              >
                Delete permanently
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p class="muted">Trash is empty.</p>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Permanently delete “${deleting.label}”?`}
          confirmLabel="Delete permanently"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await call("trash.delete", { id: deleting.id });
            setDeleting(null);
            setRevision((value) => value + 1);
          }}
        >
          <p>This removes the {trashKindLabel(deleting.kind).toLowerCase()} forever.</p>
          <p>
            <strong>This cannot be undone.</strong>
          </p>
        </ConfirmDialog>
      )}
      {emptying && (
        <ConfirmDialog
          title="Empty trash?"
          confirmLabel="Delete everything permanently"
          onClose={() => setEmptying(false)}
          onConfirm={async () => {
            await call("trash.empty");
            setEmptying(false);
            setRevision((value) => value + 1);
          }}
        >
          <p>
            This permanently deletes all {entries.length} trashed item
            {entries.length === 1 ? "" : "s"}.
          </p>
          <p>
            <strong>This cannot be undone.</strong>
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function trashKindLabel(kind: TrashEntry["kind"]): string {
  return (
    {
      project: "Project",
      prototype: "Design",
      system: "Design system",
      review: "Review",
      component: "Component",
      unknown: "Unknown item",
    } satisfies Record<TrashEntry["kind"], string>
  )[kind];
}

/** One dot per theme: its background and accent split diagonally (System: Light | Dark). */
const ICON_PLACES: Record<string, string> = {
  darwin: "Shown in the Dock while Sprue is open, and as the tab icon.",
  win32: "Shown in the taskbar and window, and as the tab icon.",
  linux: "Shown in the window and taskbar, and as the tab icon.",
};

function AppIconSettings() {
  const current = appIcon.value;
  const [error, setError] = useState<string | null>(null);
  const platform = desktopPlatform();
  const choose = (id: AppIconId) => {
    setError(null);
    setAppIcon(id).catch((caught: Error) => setError(caught.message));
  };
  const move = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = APP_ICONS.findIndex((icon) => icon.id === current);
    const next = APP_ICONS[(index + step + APP_ICONS.length) % APP_ICONS.length]!;
    choose(next.id);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`[data-option="${next.id}"]`)
      ?.focus();
  };
  return (
    <section class="settings-card" id="app-icon" aria-labelledby="icon-heading">
      <header class="settings-card-head">
        <div>
          <h2 id="icon-heading">App icon</h2>
          <p>{(platform && ICON_PLACES[platform]) ?? "Shown as the browser tab icon."}</p>
        </div>
      </header>
      <div class="icon-options" role="radiogroup" aria-labelledby="icon-heading" onKeyDown={move}>
        {APP_ICONS.map((icon) => (
          <button
            type="button"
            role="radio"
            key={icon.id}
            data-option={icon.id}
            aria-checked={current === icon.id}
            tabIndex={current === icon.id ? 0 : -1}
            class={`icon-option ${current === icon.id ? "active" : ""}`}
            onClick={() => choose(icon.id)}
          >
            <img src={iconSrc(icon.id)} alt="" width={48} height={48} draggable={false} />
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

type Theme = (typeof THEMES)[number];

const THEME_ROWS: { label: string; match: (theme: Theme) => boolean }[] = [
  { label: "Light", match: (t) => t.scheme === "light" && !isContrastTheme(t) },
  { label: "Dark", match: (t) => t.scheme === "dark" && !isContrastTheme(t) },
  { label: "Contrast", match: isContrastTheme },
];

function ThemeDots() {
  const current = themePreference.value;
  const [hovered, setHovered] = useState<ThemePreference | null>(null);
  const shown = THEME_OPTIONS.find((t) => t.id === (hovered ?? current));
  const move = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = THEME_OPTIONS.findIndex((t) => t.id === current);
    const next = THEME_OPTIONS[(index + step + THEME_OPTIONS.length) % THEME_OPTIONS.length]!;
    setThemePreference(next.id);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`[data-option="${next.id}"]`)
      ?.focus();
  };
  const dot = (theme: { id: ThemePreference; label: string }) => (
    <button
      type="button"
      role="radio"
      key={theme.id}
      data-option={theme.id}
      aria-checked={current === theme.id}
      aria-label={theme.label}
      tabIndex={current === theme.id ? 0 : -1}
      class={`theme-dot ${current === theme.id ? "active" : ""}`}
      onClick={() => setThemePreference(theme.id)}
      onMouseEnter={() => setHovered(theme.id)}
      onFocus={() => setHovered(null)}
    >
      {theme.id === "system" ? (
        <span class="theme-dot-fill split" aria-hidden="true">
          <span data-theme="light" />
          <span data-theme="dark" />
        </span>
      ) : (
        <span class="theme-dot-fill" data-theme={theme.id} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <div
      class="theme-picker"
      role="radiogroup"
      aria-labelledby="appearance-heading"
      onKeyDown={move}
      onMouseLeave={() => setHovered(null)}
    >
      <div class="theme-row">
        <span class="theme-row-label">Mode</span>
        <div class="theme-dots">{dot(THEME_OPTIONS[0]!)}</div>
        <span class="theme-dot-label" aria-hidden="true">
          {shown?.label}
        </span>
      </div>
      {THEME_ROWS.map((row) => (
        <div class="theme-row" key={row.label}>
          <span class="theme-row-label">{row.label}</span>
          <div class="theme-dots">{THEMES.filter(row.match).map(dot)}</div>
        </div>
      ))}
    </div>
  );
}
