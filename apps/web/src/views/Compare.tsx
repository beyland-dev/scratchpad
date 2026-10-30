import { useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { Icon } from "../components/Icon.tsx";
import { PrototypeFrame } from "../components/PrototypeFrame.tsx";
import { ThemePicker } from "../components/ThemePicker.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import {
  byId,
  familyTitle,
  homeProjectId,
  loaded,
  projectHref,
  prototypes,
  revisionOf,
  splitRef,
  versionLabelOf,
} from "../store.ts";
import type { PrototypeWithUrls } from "../types.ts";
import { prototypeHref, themeOptions, type ThemeReady } from "../prototype-theme.ts";
import { DEFAULT_DEVICE, DEVICES, deviceById, useElementSize } from "../util.ts";

/** Prototypes sit in a grid this many columns wide; more rows scroll. */
const COLUMNS = 2;
const GAP = 16;
const HEADER_HEIGHT = 40;

/** "Inbox One · V2": versions share their family's name. */
function nameOf(proto: PrototypeWithUrls): string {
  const version = versionLabelOf(proto);
  return version ? `${familyTitle(proto)} · ${version}` : familyTitle(proto);
}

export function Compare() {
  const { query } = useRoute();
  const { route } = useLocation();
  const ids = (query.ids ?? "").split(",").filter(Boolean);
  const device = deviceById(query.device);
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const theme = query.theme;
  // What each frame's design system runtime reported, by prototype id.
  const [ready, setReady] = useState<Record<string, ThemeReady>>({});

  const update = (nextIds: string[], deviceId = device.id, nextTheme = theme) => {
    const params = new URLSearchParams({ ids: nextIds.join(",") });
    if (deviceId !== DEFAULT_DEVICE.id) params.set("device", deviceId);
    if (nextTheme) params.set("theme", nextTheme);
    route(`/compare?${params.toString().replaceAll("%2C", ",").replaceAll("%2F", "/")}`, true);
  };

  if (!loaded.value) return <p class="page-message">Loading…</p>;

  const columns = ids.map((id) => ({ id, proto: byId.value.get(id) }));
  // One control for every frame: the themes of the first themable prototype. Frames of other
  // systems ignore theme ids they don't know.
  const themes = columns
    .map(({ id, proto }) => themeOptions(proto?.resolvedSystem, ready[id]))
    .find(Boolean);
  // Compare within the project of the first column.
  const project = ids[0] ? splitRef(ids[0]).project : undefined;
  const candidates = prototypes.value.filter(
    (p) => !ids.includes(p.id) && (!project || p.project === project),
  );
  const columnCount = Math.min(COLUMNS, Math.max(1, columns.length));
  const cellWidth = (area.width - GAP * (columnCount - 1)) / columnCount;
  // Each prototype fits its cell's width and the visible height, so one row is always fully in
  // view; further rows scroll.
  const scale = Math.max(
    0,
    Math.min(1, cellWidth / device.width, Math.max(area.height - HEADER_HEIGHT, 0) / device.height),
  );

  return (
    <div class="compare">
      <div class="viewer-bar">
        <a
          href={projectHref(ids[0] ? splitRef(ids[0]).project : (homeProjectId() ?? ""))}
          class="button ghost icon-only"
          aria-label="Back to design"
          title="Back"
        >
          <Icon name="arrow-left" />
        </a>
        <h1 class="viewer-title">Compare</h1>
        <span class="toolbar-spacer" />
        {candidates.length > 0 && (
          <select
            class="input add-select"
            aria-label="Add a design"
            value=""
            onChange={(e) => e.currentTarget.value && update([...ids, e.currentTarget.value])}
          >
            <option value="">Add design…</option>
            {candidates.map((p) => (
              <option value={p.id} key={p.id}>
                {nameOf(p)}
              </option>
            ))}
          </select>
        )}
        {themes && (
          <ThemePicker
            themes={themes}
            theme={theme ?? columns.map(({ id }) => ready[id]?.theme).find(Boolean) ?? ""}
            onChange={(t) => update(ids, device.id, t)}
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
              onClick={() => update(ids, d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {ids.length === 0 && (
        <p class="page-message">
          Pick prototypes to compare from the <a href="/">gallery</a>, or add one above.
        </p>
      )}

      <div
        class="compare-area"
        ref={areaRef}
        style={{ gap: `${GAP}px`, gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {area.width > 0 &&
          columns.map(({ id, proto }) => (
            <section class="compare-column" key={id}>
              <header class="compare-header">
                {proto ? (
                  <>
                    <a
                      href={prototypeHref(id, { device: device.id, theme })}
                      class="compare-title"
                      title={proto.description ?? nameOf(proto)}
                    >
                      {nameOf(proto)}
                    </a>
                    {proto.status !== "draft" && <StatusBadge status={proto.status} />}
                  </>
                ) : (
                  <span class="compare-title muted">Missing: {splitRef(id).id}</span>
                )}
                <button
                  type="button"
                  class="icon-button"
                  aria-label={`Remove ${proto ? nameOf(proto) : id}`}
                  title="Remove"
                  onClick={() => update(ids.filter((x) => x !== id))}
                >
                  <Icon name="x" size={14} />
                </button>
              </header>
              {proto && (
                <PrototypeFrame
                  src={proto.urls.raw}
                  theme={theme}
                  onThemeReady={(r) => setReady((prev) => ({ ...prev, [id]: r }))}
                  title={proto.title}
                  width={device.width}
                  height={device.height}
                  scale={scale}
                  revision={revisionOf(id)}
                  class="framed"
                />
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
