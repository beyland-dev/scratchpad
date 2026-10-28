import { versionLabel } from "@design-tool/core/family";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { call } from "../api.ts";
import { PrototypeFrame } from "../components/PrototypeFrame.tsx";
import { ThemePicker } from "../components/ThemePicker.tsx";
import { DeletePrototypeDialog, PrototypeDialog } from "../components/Dialogs.tsx";
import { Icon } from "../components/Icon.tsx";
import { openNewVariant } from "../components/NewVariant.tsx";
import { StatusSelect } from "../components/StatusBadge.tsx";
import { VersionSwitcher } from "../components/VersionSwitcher.tsx";
import {
  byId,
  familyOf,
  loaded,
  projectHref,
  projectIdOf,
  prototypes,
  revisionOf,
  sandboxUrlFor,
  systems,
  workspace,
} from "../store.ts";
import { prototypeHref, themeOptions, withTheme, type ThemeReady } from "../prototype-theme.ts";
import type { PrototypeDetails, PrototypeWithUrls } from "../types.ts";
import {
  DEFAULT_DEVICE,
  DEVICES,
  copyText,
  deviceById,
  isTypingTarget,
  relativeTime,
  useElementSize,
} from "../util.ts";

const STAGE_PADDING = 32;
const PANEL_KEY = "dt.viewer.details";

function useDetails(id: string, revision: number) {
  const [details, setDetails] = useState<PrototypeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    call<PrototypeDetails>("prototype.get", { id })
      .then((d) => !cancelled && (setDetails(d), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id, revision]);
  return { details, error };
}

export function Viewer() {
  const { params, query } = useRoute();
  const { route } = useLocation();
  const id = params.id ?? "";
  const proto = byId.value.get(id);
  const revision = revisionOf(id);
  const { details, error } = useDetails(id, revision);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem(PANEL_KEY) === "open");
  const togglePanel = (open: boolean) => {
    localStorage.setItem(PANEL_KEY, open ? "open" : "closed");
    setPanelOpen(open);
  };
  const [reloadNonce, setReloadNonce] = useState(0);

  const device = deviceById(query.device);
  const page = query.page;
  const family = proto ? familyOf(proto.id) : [];
  const familyIndex = family.findIndex((p) => p.id === id);

  // What the prototype's design system runtime reported (its themes), if it has one.
  const [themeReady, setThemeReady] = useState<ThemeReady | null>(null);
  const theme = query.theme;

  /** Another version or page, keeping the viewport and theme. */
  const go = (nextId: string, extra: { page?: string } = {}) =>
    route(prototypeHref(nextId, { device: query.device, theme, ...extra }), true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        isTypingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        family.length < 2
      )
        return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next = family[(familyIndex + delta + family.length) % family.length];
        if (next) go(next.id);
        event.preventDefault();
      } else if (/^[1-9]$/.test(event.key)) {
        const next = family[Number(event.key) - 1];
        if (next) go(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!proto) {
    if (!loaded.value) return <p class="page-message">Loading…</p>;
    return (
      <div class="viewer">
        <p class="page-message">
          No prototype <code>{id}</code>. <a href="/">Back to prototypes</a>
        </p>
      </div>
    );
  }

  const pages = (details?.files ?? []).filter((f) => /\.html?$/i.test(f.path)).map((f) => f.path);
  const src = sandboxUrlFor(proto, page);
  const themes = themeOptions(proto.resolvedSystem, themeReady);
  const availableW = Math.max(stage.width - STAGE_PADDING * 2, 0);
  const availableH = Math.max(stage.height - STAGE_PADDING * 2, 0);
  const scale = Math.min(1, availableW / device.width, availableH / device.height);
  const hasIssues = Boolean(proto.issues?.length);

  return (
    <div class={`viewer ${panelOpen ? "panel-open" : ""}`}>
      <div class="viewer-bar">
        <a
          href={projectHref(projectIdOf(proto))}
          class="button ghost icon-only"
          aria-label="Back to prototypes"
          title="Back"
        >
          <Icon name="arrow-left" />
        </a>
        <h1 class="viewer-title" title={proto.description ?? proto.title}>
          {family[0]?.title ?? proto.title}
        </h1>

        <span class="toolbar-spacer" />

        {pages.length > 1 && (
          <select
            class="input"
            aria-label="Page"
            value={page ?? proto.entry}
            onChange={(e) =>
              go(id, {
                page: e.currentTarget.value === proto.entry ? undefined : e.currentTarget.value,
              })
            }
          >
            {pages.map((p) => (
              <option value={p} key={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <VersionSwitcher family={family} currentId={id} onSelect={(next) => go(next)} />
        <button
          type="button"
          class="button ghost new-variant"
          aria-label="New variant"
          title={
            family.length > 1
              ? `New variant: fork ${versionLabel(familyIndex, family.length)} or another version`
              : "New variant: fork this prototype"
          }
          onClick={() => openNewVariant(id)}
        >
          <Icon name="fork" />
          <span class="new-variant-label">New variant</span>
        </button>
        <span class="bar-divider" />
        {themes && (
          <ThemePicker
            themes={themes}
            theme={theme ?? themeReady?.theme ?? ""}
            onChange={(t) =>
              route(prototypeHref(id, { device: query.device, theme: t, page }), true)
            }
          />
        )}
        <div class="segmented" role="group" aria-label="Viewport">
          {DEVICES.map((d) => (
            <button
              type="button"
              key={d.id}
              class={device.id === d.id ? "active" : ""}
              aria-pressed={device.id === d.id}
              title={`${d.width}×${d.height}`}
              onClick={() =>
                route(
                  prototypeHref(id, {
                    device: d.id === DEFAULT_DEVICE.id ? undefined : d.id,
                    theme,
                    page,
                  }),
                  true,
                )
              }
            >
              {d.label}
            </button>
          ))}
        </div>
        <span class="bar-divider" />
        <button
          type="button"
          class="button ghost icon-only"
          title="Reload"
          aria-label="Reload"
          onClick={() => setReloadNonce((n) => n + 1)}
        >
          <Icon name="refresh" />
        </button>
        <a
          class="button ghost icon-only"
          href={withTheme(src, theme)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in a new tab"
          aria-label="Open in a new tab"
        >
          <Icon name="external" />
        </a>
        {family.length > 1 && (
          <a
            class="button ghost icon-only"
            href={`/compare?ids=${family.map((p) => encodeURIComponent(p.id)).join(",")}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`}
            title="Compare versions side by side"
            aria-label="Compare versions"
          >
            <Icon name="columns" />
          </a>
        )}
        <button
          type="button"
          class="button ghost icon-only has-dot"
          aria-pressed={panelOpen}
          aria-label={hasIssues ? "Details (has issues)" : "Details"}
          title="Details"
          onClick={() => togglePanel(!panelOpen)}
        >
          <Icon name="panel" />
          {hasIssues && !panelOpen && <span class="dot warn" />}
        </button>
      </div>

      <div class="viewer-body">
        <div class="stage" ref={stageRef}>
          {stage.width > 0 && (
            <PrototypeFrame
              src={src}
              theme={theme}
              onThemeReady={setThemeReady}
              title={proto.title}
              width={device.width}
              height={device.height}
              scale={scale}
              revision={revision * 1000 + reloadNonce}
              class="framed"
            />
          )}
          {scale < 1 && <span class="scale-note">{Math.round(scale * 100)}%</span>}
        </div>
        {panelOpen && (
          <DetailsPanel
            proto={proto}
            details={details}
            error={error}
            versions={family.length}
            onDeleted={() => route(projectHref(projectIdOf(proto)), true)}
          />
        )}
      </div>
    </div>
  );
}

function DetailsPanel({
  proto,
  details,
  error,
  versions,
  onDeleted,
}: {
  proto: PrototypeWithUrls;
  details: PrototypeDetails | null;
  error: string | null;
  versions: number;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const groups = [
    ...new Set(
      prototypes.value
        .filter((p) => projectIdOf(p) === projectIdOf(proto) && p.group)
        .map((p) => p.group!),
    ),
  ].sort();
  const sources = workspace.value?.sources ?? [];
  const files = details?.files ?? [];
  const folder = `.design/prototypes/${proto.id}/`;
  const [copied, setCopied] = useState(false);

  return (
    <aside class="panel" aria-label="Prototype details">
      {proto.description && <p class="panel-description">{proto.description}</p>}

      {proto.issues?.length ? (
        <div class="issues" role="alert">
          <h3>
            <Icon name="alert" size={14} /> {proto.issues.length === 1 ? "Issue" : "Issues"}
          </h3>
          <ul>
            {proto.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl class="meta">
        <dt>Status</dt>
        <dd>
          <StatusSelect id={proto.id} status={proto.status} />
        </dd>
        {proto.framework && (
          <>
            <dt>Built with</dt>
            <dd>
              React
              {proto.system && (
                <>
                  {" · "}
                  <a href={`/systems/${encodeURIComponent(proto.system)}`}>
                    {systems.value.find((s) => s.id === proto.system)?.name ?? proto.system}
                  </a>
                </>
              )}
            </dd>
          </>
        )}
        {proto.group && (
          <>
            <dt>Group</dt>
            <dd>{proto.group}</dd>
          </>
        )}
        {proto.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>{proto.tags.map((t) => `#${t}`).join(" ")}</dd>
          </>
        )}
        {proto.sourceRefs.length > 0 && (
          <>
            <dt>Sources</dt>
            <dd>
              {proto.sourceRefs
                .map((ref) => sources.find((s) => s.id === ref)?.name ?? ref)
                .join(", ")}
            </dd>
          </>
        )}
        <dt>Edited</dt>
        <dd title={new Date(proto.updatedAt).toLocaleString()}>
          {relativeTime(proto.updatedAt)}
          {proto.createdBy?.name && <span class="muted"> · by {proto.createdBy.name}</span>}
        </dd>
        <dt>Folder</dt>
        <dd>
          <button
            type="button"
            class="copy-path"
            title="Copy path"
            onClick={async () => {
              if (await copyText(folder)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }
            }}
          >
            {copied ? "Copied" : folder}
          </button>
        </dd>
      </dl>

      {error && <p class="error">{error}</p>}
      {files.length > 1 && (
        <>
          <h3>Files</h3>
          <ul class="files">
            {files.map((f) => (
              <li key={f.path}>
                <a href={sandboxUrlFor(proto, f.path)} target="_blank" rel="noopener noreferrer">
                  {f.path}
                </a>
                <span class="muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div class="panel-actions">
        <button type="button" class="button small" onClick={() => setDialog("edit")}>
          Edit details
        </button>
        <button
          type="button"
          class="button small ghost danger-text"
          onClick={() => setDialog("delete")}
        >
          Delete…
        </button>
      </div>
      {dialog === "edit" && (
        <PrototypeDialog proto={proto} groups={groups} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeletePrototypeDialog
          proto={proto}
          versions={versions}
          onDeleted={onDeleted}
          onClose={() => setDialog(null)}
        />
      )}
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
