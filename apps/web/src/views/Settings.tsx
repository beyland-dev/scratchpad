import { useState } from "preact/hooks";
import { call } from "../api.ts";
import { AgentConnectionGuide } from "../components/ConnectAgent.tsx";
import { Icon, type IconName } from "../components/Icon.tsx";
import { ConfirmDialog } from "../components/Modal.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { refresh } from "../store.ts";
import { setThemePreference, themePreference, type ThemePreference } from "../theme.ts";
import type { TrashEntry } from "../types.ts";
import { relativeTime } from "../util.ts";

const THEMES: { id: ThemePreference; label: string; icon: IconName; hint: string }[] = [
  { id: "system", label: "System", icon: "monitor", hint: "Match your OS" },
  { id: "light", label: "Light", icon: "sun", hint: "Always light" },
  { id: "dark", label: "Dark", icon: "moon", hint: "Always dark" },
];

export function Settings() {
  const current = themePreference.value;
  return (
    <div class="page settings">
      <div class="page-head">
        <h1>Settings</h1>
        <p class="muted">Preferences for Scratchpad in this browser.</p>
      </div>

      <section class="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-label" id="theme-label">
              Theme
            </span>
            <span class="settings-hint">The app's colors. Prototypes keep their own styles.</span>
          </div>
          <div class="theme-options" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((theme) => (
              <button
                type="button"
                role="radio"
                key={theme.id}
                aria-checked={current === theme.id}
                class={`theme-option ${current === theme.id ? "active" : ""}`}
                onClick={() => setThemePreference(theme.id)}
              >
                <ThemePreview theme={theme.id} />
                <span class="theme-option-label">
                  <Icon name={theme.icon} size={14} />
                  {theme.label}
                </span>
                <span class="theme-option-hint">{theme.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="agents-heading">
        <h2 id="agents-heading">Agents and product context</h2>
        <AgentConnectionGuide />
      </section>

      <TrashSettings />
    </div>
  );
}

function TrashSettings() {
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TrashEntry | null>(null);
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
    <section class="settings-section" aria-labelledby="trash-heading">
      <h2 id="trash-heading">Trash</h2>
      <p class="settings-section-intro">
        Deleted content stays recoverable until you permanently remove it.
      </p>
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
    </section>
  );
}

function trashKindLabel(kind: TrashEntry["kind"]): string {
  return (
    {
      project: "Project",
      prototype: "Prototype",
      system: "Design system",
      review: "Review",
      component: "Component",
      unknown: "Unknown item",
    } satisfies Record<TrashEntry["kind"], string>
  )[kind];
}

/** A miniature app window in fixed light or dark colors; System shows both, split diagonally. */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  const mini = (scheme: "light" | "dark") => (
    <span class={`theme-window ${scheme}`}>
      <span class="tw-sidebar">
        <span class="tw-dot" />
        <span class="tw-dot" />
        <span class="tw-dot" />
      </span>
      <span class="tw-main">
        <span class="tw-bar" />
        <span class="tw-cards">
          <span class="tw-card" />
          <span class="tw-card accent" />
          <span class="tw-card" />
        </span>
      </span>
    </span>
  );
  return (
    <span class={`theme-preview ${theme}`} aria-hidden="true">
      {theme === "dark" ? mini("dark") : mini("light")}
      {theme === "system" && <span class="theme-preview-half">{mini("dark")}</span>}
    </span>
  );
}
