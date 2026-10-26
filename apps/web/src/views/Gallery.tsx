import { useMemo, useState } from "preact/hooks";
import { EmptyState } from "../components/EmptyState.tsx";
import { PrototypeCard, familyUpdatedAt } from "../components/PrototypeCard.tsx";
import { STATUSES } from "../components/StatusBadge.tsx";
import { families, loadError, loaded, prototypes, selection, workspace } from "../store.ts";
import type { PrototypeStatus, PrototypeWithUrls } from "../types.ts";

export function Gallery() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PrototypeStatus | "">("");
  const [tag, setTag] = useState("");
  const [group, setGroup] = useState("");
  const all = prototypes.value;
  const info = workspace.value;

  const allFamilies = families.value;

  // A family is shown when any of its versions matches; the card always previews the latest one.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (p: PrototypeWithUrls) =>
      (!status || p.status === status) &&
      (!tag || p.tags.includes(tag)) &&
      (!group || p.group === group) &&
      (!q ||
        [p.id, p.title, p.description ?? "", p.group ?? "", ...p.tags].some((v) =>
          v.toLowerCase().includes(q),
        ));
    return allFamilies
      .filter((family) => family.some(matches))
      .sort((a, b) => familyUpdatedAt(b).localeCompare(familyUpdatedAt(a)));
  }, [allFamilies, search, status, tag, group]);

  if (!loaded.value) return <p class="page-message">Loading…</p>;
  if (loadError.value && !all.length) return <p class="page-message error">{loadError.value}</p>;
  if (!all.length) return <EmptyState />;

  const selected = selection.value;
  const filtersActive = Boolean(search || status || tag || group);

  return (
    <div class="gallery">
      <div class="toolbar">
        <input
          type="search"
          class="input"
          placeholder="Search prototypes"
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
          aria-label="Search prototypes"
        />
        <select
          class="input"
          value={status}
          onChange={(e) => setStatus(e.currentTarget.value as PrototypeStatus | "")}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option value={s} key={s}>
              {s}
            </option>
          ))}
        </select>
        {info && info.groups.length > 0 && (
          <select
            class="input"
            value={group}
            onChange={(e) => setGroup(e.currentTarget.value)}
            aria-label="Group"
          >
            <option value="">All groups</option>
            {info.groups.map((g) => (
              <option value={g} key={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        {info && info.tags.length > 0 && (
          <select
            class="input"
            value={tag}
            onChange={(e) => setTag(e.currentTarget.value)}
            aria-label="Tag"
          >
            <option value="">All tags</option>
            {info.tags.map((t) => (
              <option value={t} key={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
        {filtersActive && (
          <button
            type="button"
            class="button ghost"
            onClick={() => {
              setSearch("");
              setStatus("");
              setTag("");
              setGroup("");
            }}
          >
            Clear filters
          </button>
        )}
        <span class="toolbar-spacer" />
        <span class="muted">
          {visible.length} of {allFamilies.length}
        </span>
      </div>

      {visible.length === 0 && <p class="page-message">No prototypes match these filters.</p>}

      <div class="grid">
        {visible.map((family) => (
          <PrototypeCard key={family[0]!.id} family={family} />
        ))}
      </div>

      {selected.length > 0 && (
        <div class="selection-bar" role="region" aria-label="Selection">
          <span>{selected.length} selected</span>
          <a
            class={`button primary ${selected.length < 2 ? "disabled" : ""}`}
            href={
              selected.length >= 2
                ? `/compare?ids=${selected.map(encodeURIComponent).join(",")}`
                : undefined
            }
            aria-disabled={selected.length < 2}
          >
            Compare{selected.length < 2 ? " (pick 2+)" : ""}
          </a>
          <button type="button" class="button ghost" onClick={() => (selection.value = [])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
