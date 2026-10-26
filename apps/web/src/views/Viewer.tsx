import { versionLabel } from "@design-tool/core/family";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { call } from "../api.ts";
import { Frame } from "../components/Frame.tsx";
import { STATUSES, StatusBadge } from "../components/StatusBadge.tsx";
import { byId, familyOf, loaded, revisionOf, sandboxUrlFor, workspace } from "../store.ts";
import type { PrototypeDetails, PrototypeStatus, PrototypeWithUrls } from "../types.ts";
import {
  DEVICES,
  FIT_DEVICE,
  deviceById,
  isTypingTarget,
  relativeTime,
  useElementSize,
} from "../util.ts";

const STAGE_PADDING = 32;

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

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
  const [panelOpen, setPanelOpen] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  const deviceId = query.device ?? FIT_DEVICE;
  const device = deviceById(deviceId);
  const page = query.page;
  const family = proto ? familyOf(proto.id) : [];
  const familyIndex = family.findIndex((p) => p.id === id);

  const go = (nextId: string, extra: Record<string, string | undefined> = {}) =>
    route(withQuery(`/p/${encodeURIComponent(nextId)}`, { device: query.device, ...extra }), true);

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
      <p class="page-message">
        No prototype <code>{id}</code>. <a href="/">Back to prototypes</a>
      </p>
    );
  }

  const pages = (details?.files ?? []).filter((f) => /\.html?$/i.test(f.path)).map((f) => f.path);
  const src = sandboxUrlFor(proto, page);
  const availableW = Math.max(stage.width - STAGE_PADDING * 2, 0);
  const availableH = Math.max(stage.height - STAGE_PADDING * 2, 0);
  const frameW = device?.width ?? availableW;
  const frameH = device?.height ?? availableH;
  const scale = device ? Math.min(1, availableW / device.width, availableH / device.height) : 1;

  return (
    <div class={`viewer ${panelOpen ? "panel-open" : ""}`}>
      <div class="viewer-bar">
        <a href="/" class="button ghost" aria-label="Back to prototypes">
          ←
        </a>
        <h1 class="viewer-title">{proto.title}</h1>
        <StatusBadge status={proto.status} />

        {family.length > 1 && (
          <div class="segmented" role="tablist" aria-label="Versions (← → or 1–9)">
            {family.map((member, i) => (
              <button
                type="button"
                role="tab"
                key={member.id}
                aria-selected={member.id === id}
                class={member.id === id ? "active" : ""}
                title={`${member.title}${i < 9 ? ` (${i + 1})` : ""}`}
                onClick={() => go(member.id)}
              >
                {versionLabel(i, family.length)}
              </button>
            ))}
          </div>
        )}

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
        <div class="segmented" aria-label="Viewport">
          {[{ id: FIT_DEVICE, label: "Fit" }, ...DEVICES].map((d) => (
            <button
              type="button"
              key={d.id}
              class={deviceId === d.id ? "active" : ""}
              aria-pressed={deviceId === d.id}
              title={"width" in d ? `${d.width}×${d.height}` : "Fill the available space"}
              onClick={() =>
                route(
                  withQuery(`/p/${encodeURIComponent(id)}`, {
                    device: d.id === FIT_DEVICE ? undefined : d.id,
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
        <button
          type="button"
          class="button ghost"
          title="Reload"
          onClick={() => setReloadNonce((n) => n + 1)}
        >
          ↻
        </button>
        <a
          class="button ghost"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in a new tab"
        >
          ↗
        </a>
        {family.length > 1 && (
          <a
            class="button ghost"
            href={`/compare?ids=${family.map((p) => encodeURIComponent(p.id)).join(",")}`}
          >
            Compare versions
          </a>
        )}
        <button
          type="button"
          class="button ghost"
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          Details
        </button>
      </div>

      <div class="viewer-body">
        <div class={`stage ${device ? "device" : "fit"}`} ref={stageRef}>
          {stage.width > 0 && (
            <Frame
              src={src}
              title={proto.title}
              width={frameW}
              height={frameH}
              scale={scale}
              revision={revision * 1000 + reloadNonce}
              class={device ? "framed" : "full"}
            />
          )}
          {device && scale < 1 && <span class="scale-note">{Math.round(scale * 100)}%</span>}
        </div>
        {panelOpen && <DetailsPanel proto={proto} details={details} error={error} />}
      </div>
    </div>
  );
}

function DetailsPanel({
  proto,
  details,
  error,
}: {
  proto: PrototypeWithUrls;
  details: PrototypeDetails | null;
  error: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sources = workspace.value?.sources ?? [];
  const parent = proto.variantOf ? byId.value.get(proto.variantOf) : undefined;

  const setStatus = async (status: PrototypeStatus) => {
    setSaving(true);
    setSaveError(null);
    try {
      await call("prototype.update", { id: proto.id, status });
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside class="panel" aria-label="Prototype details">
      {proto.description && <p class="panel-description">{proto.description}</p>}
      <dl class="meta">
        <dt>Status</dt>
        <dd>
          <select
            class="input"
            value={proto.status}
            disabled={saving}
            onChange={(e) => void setStatus(e.currentTarget.value as PrototypeStatus)}
          >
            {STATUSES.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
          {saveError && <span class="error">{saveError}</span>}
        </dd>
        <dt>Id</dt>
        <dd>
          <code>{proto.id}</code>
        </dd>
        {proto.group && (
          <>
            <dt>Group</dt>
            <dd>{proto.group}</dd>
          </>
        )}
        {proto.variantOf && (
          <>
            <dt>Variant of</dt>
            <dd>
              {parent ? (
                <a href={`/p/${encodeURIComponent(parent.id)}`}>{parent.title}</a>
              ) : (
                <code>{proto.variantOf}</code>
              )}
            </dd>
          </>
        )}
        {proto.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>{proto.tags.map((t) => `#${t}`).join(" ")}</dd>
          </>
        )}
        {proto.createdBy && (
          <>
            <dt>Created by</dt>
            <dd>
              {proto.createdBy.name ?? "unknown"}{" "}
              <span class="muted">({proto.createdBy.kind})</span>
            </dd>
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
        <dt>Updated</dt>
        <dd title={new Date(proto.updatedAt).toLocaleString()}>{relativeTime(proto.updatedAt)}</dd>
        <dt>Created</dt>
        <dd title={new Date(proto.createdAt).toLocaleString()}>{relativeTime(proto.createdAt)}</dd>
      </dl>

      {proto.issues?.length ? (
        <div class="issues">
          <h3>Issues</h3>
          <ul>
            {proto.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3>Files</h3>
      {error && <p class="error">{error}</p>}
      <ul class="files">
        {(details?.files ?? []).map((f) => (
          <li key={f.path}>
            <a href={sandboxUrlFor(proto, f.path)} target="_blank" rel="noopener noreferrer">
              {f.path}
            </a>
            <span class="muted">{formatBytes(f.size)}</span>
          </li>
        ))}
      </ul>
      <p class="muted small">
        Folder: <code>.design/prototypes/{proto.id}/</code>
      </p>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
