import { useLocation, useRoute } from "preact-iso";
import { Frame } from "../components/Frame.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { byId, loaded, prototypes, revisionOf } from "../store.ts";
import { DEVICES, deviceById, useElementSize } from "../util.ts";

const MAX_COLUMNS = 4;
const GAP = 16;
const HEADER_HEIGHT = 44;

export function Compare() {
  const { query } = useRoute();
  const { route } = useLocation();
  const ids = (query.ids ?? "").split(",").filter(Boolean).slice(0, MAX_COLUMNS);
  const device = deviceById(query.device) ?? DEVICES[2]!;
  const [areaRef, area] = useElementSize<HTMLDivElement>();

  const update = (nextIds: string[], deviceId = device.id) => {
    const params = new URLSearchParams({ ids: nextIds.join(","), device: deviceId });
    route(`/compare?${params.toString().replaceAll("%2C", ",")}`, true);
  };

  if (!loaded.value) return <p class="page-message">Loading…</p>;

  const columns = ids.map((id) => ({ id, proto: byId.value.get(id) }));
  const candidates = prototypes.value.filter((p) => !ids.includes(p.id));
  const columnWidth = columns.length
    ? (area.width - GAP * (columns.length - 1)) / columns.length
    : 0;
  const scale = Math.min(
    1,
    columnWidth / device.width,
    Math.max(area.height - HEADER_HEIGHT, 0) / device.height,
  );

  return (
    <div class="compare">
      <div class="viewer-bar">
        <a href="/" class="button ghost" aria-label="Back to prototypes">
          ←
        </a>
        <h1 class="viewer-title">Compare</h1>
        <span class="toolbar-spacer" />
        {ids.length < MAX_COLUMNS && candidates.length > 0 && (
          <select
            class="input"
            aria-label="Add a prototype"
            value=""
            onChange={(e) => e.currentTarget.value && update([...ids, e.currentTarget.value])}
          >
            <option value="">+ Add prototype</option>
            {candidates.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <div class="segmented" aria-label="Viewport">
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

      <div class="compare-area" ref={areaRef} style={{ gap: `${GAP}px` }}>
        {area.width > 0 &&
          columns.map(({ id, proto }) => (
            <section class="compare-column" key={id} style={{ width: `${columnWidth}px` }}>
              <header class="compare-header">
                {proto ? (
                  <>
                    <a
                      href={`/p/${encodeURIComponent(id)}?device=${device.id}`}
                      class="compare-title"
                      title={proto.title}
                    >
                      {proto.title}
                    </a>
                    <StatusBadge status={proto.status} />
                  </>
                ) : (
                  <span class="muted">Missing: {id}</span>
                )}
                <button
                  type="button"
                  class="icon-button"
                  aria-label={`Remove ${proto?.title ?? id}`}
                  onClick={() => update(ids.filter((x) => x !== id))}
                >
                  ×
                </button>
              </header>
              {proto && (
                <Frame
                  src={proto.urls.raw}
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
