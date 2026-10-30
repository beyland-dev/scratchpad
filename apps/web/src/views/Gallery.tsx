import { groupFamilies } from "@beyland/sprue-core/family";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { PrototypeDialog } from "../components/Dialogs.tsx";
import { Icon } from "../components/Icon.tsx";
import { PrototypeCard, familyUpdatedAt } from "../components/PrototypeCard.tsx";
import { SearchInput } from "../components/SearchInput.tsx";
import { STATUSES } from "../components/StatusBadge.tsx";
import {
  beginReviewDraft,
  byId,
  familyTitle,
  loadError,
  loaded,
  projectEntries,
  projectIdOf,
  prototypes,
  selection,
} from "../store.ts";
import type { PrototypeStatus, PrototypeWithUrls } from "../types.ts";

export function Gallery() {
  const { params } = useRoute();
  const { route } = useLocation();
  const projectId = params.project ?? "";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PrototypeStatus | "">("");
  const [group, setGroup] = useState("");
  const [creating, setCreating] = useState(false);
  const project = projectEntries.value.find((p) => p.id === projectId);
  const all = useMemo(
    () => prototypes.value.filter((p) => projectIdOf(p) === projectId),
    [prototypes.value, projectId, projectEntries.value],
  );
  const groups = useMemo(
    () => [...new Set(all.flatMap((p) => (p.group ? [p.group] : [])))].sort(),
    [all],
  );
  const allFamilies = useMemo(() => groupFamilies(all), [all]);

  // Filters and the compare selection belong to one project.
  useEffect(() => {
    setSearch("");
    setStatus("");
    setGroup("");
    selection.value = [];
  }, [projectId]);

  // A family matches search/group when any of its versions does; status filters on the latest version (what the card shows).
  const { visible, statusCounts } = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const matchesQuery = (p: PrototypeWithUrls) =>
      (!group || p.group === group) &&
      (!q ||
        [p.localId, p.title, p.description ?? "", p.group ?? "", ...p.tags].some((v) =>
          v.toLowerCase().includes(q),
        ));
    const searched = allFamilies.filter((family) => family.some(matchesQuery));
    const counts = new Map<PrototypeStatus, number>();
    for (const family of searched) {
      const s = family[family.length - 1]!.status;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return {
      statusCounts: counts,
      visible: searched
        .filter((family) => !status || family[family.length - 1]!.status === status)
        .sort((a, b) => familyUpdatedAt(b).localeCompare(familyUpdatedAt(a))),
    };
  }, [allFamilies, search, status, group]);

  if (!loaded.value) return <p class="page-message">Loading…</p>;
  if (loadError.value && !prototypes.value.length)
    return <p class="page-message error">{loadError.value}</p>;
  if (!project)
    return (
      <p class="page-message">
        No project <code>{projectId}</code>. <a href="/">Go to your projects</a>
      </p>
    );
  const dialogs = creating && (
    <PrototypeDialog projectId={projectId} groups={groups} onClose={() => setCreating(false)} />
  );

  const selected = selection.value;
  const filtersActive = Boolean(search || status || group);
  const statusOptions = STATUSES.filter(
    (s) => allFamilies.some((f) => f[f.length - 1]!.status === s) || s === status,
  );
  const clear = () => {
    setSearch("");
    setStatus("");
    setGroup("");
  };

  return (
    <div class={`gallery ${selected.length ? "selecting" : ""}`}>
      <div class="toolbar">
        <SearchInput value={search} onInput={setSearch} placeholder="Search prototypes" />
        {statusOptions.length > 1 && (
          <div class="segmented" role="group" aria-label="Filter by status">
            <button
              type="button"
              class={status === "" ? "active" : ""}
              aria-pressed={status === ""}
              onClick={() => setStatus("")}
            >
              All
            </button>
            {statusOptions.map((s) => (
              <button
                type="button"
                key={s}
                class={`capitalize ${status === s ? "active" : ""}`}
                aria-pressed={status === s}
                onClick={() => setStatus(status === s ? "" : s)}
              >
                {s}
                <span class="count">{statusCounts.get(s) ?? 0}</span>
              </button>
            ))}
          </div>
        )}
        {groups.length > 1 && (
          <select
            class="input"
            value={group}
            onChange={(e) => setGroup(e.currentTarget.value)}
            aria-label="Filter by group"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option value={g} key={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <span class="toolbar-spacer" />
        {filtersActive && (
          <>
            <span class="result-count" role="status">
              {visible.length} of {allFamilies.length}
            </span>
            <button type="button" class="link-button" onClick={clear}>
              Clear
            </button>
          </>
        )}
        <button type="button" class="button primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> New prototype
        </button>
      </div>

      {visible.length === 0 && filtersActive && (
        <p class="page-message">
          Nothing matches.{" "}
          <button type="button" class="link-button" onClick={clear}>
            Clear filters
          </button>
        </p>
      )}

      <div class="grid">
        {visible.map((family) => (
          <PrototypeCard key={family[0]!.id} family={family} groups={groups} />
        ))}
      </div>

      {selected.length > 0 && (
        <div class="selection-bar" role="region" aria-label="Selection">
          <span>
            {selected.length < 2 ? "Select one more to compare" : `${selected.length} selected`}
          </span>
          <button
            type="button"
            class="button"
            title="Package the selected versions as a review to share for feedback"
            onClick={() => {
              const picked = selected
                .map((id) => byId.value.get(id))
                .filter((p) => p !== undefined);
              const first = picked[0];
              const href = beginReviewDraft(
                projectId,
                first ? `${familyTitle(first)} feedback` : "Untitled review",
                picked.map((p) => p.localId),
              );
              selection.value = [];
              route(href);
            }}
          >
            <Icon name="message" size={14} /> Request feedback
          </button>
          <a
            class={`button primary ${selected.length < 2 ? "disabled" : ""}`}
            href={selected.length >= 2 ? `/compare?ids=${selected.join(",")}` : undefined}
            aria-disabled={selected.length < 2}
          >
            Compare
          </a>
          <button
            type="button"
            class="icon-button"
            aria-label="Clear selection"
            onClick={() => (selection.value = [])}
          >
            <Icon name="x" />
          </button>
        </div>
      )}
      {dialogs}
    </div>
  );
}
