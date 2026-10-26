import { revisionOf, selection } from "../store.ts";
import type { PrototypeWithUrls } from "../types.ts";
import { relativeTime, useElementSize } from "../util.ts";
import { Frame } from "./Frame.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

const THUMB_WIDTH = 1280;
const THUMB_HEIGHT = 800;

/** Most recent update across a family, used for sorting and the card timestamp. */
export function familyUpdatedAt(family: PrototypeWithUrls[]): string {
  return family.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), "");
}

/** One card per variant family. It previews and opens the latest version. */
export function PrototypeCard({ family }: { family: PrototypeWithUrls[] }) {
  const latest = family[family.length - 1]!;
  const [thumbRef, size] = useElementSize<HTMLAnchorElement>();
  const scale = size.width ? size.width / THUMB_WIDTH : 0;
  const selected = selection.value.includes(latest.id);
  const updatedAt = familyUpdatedAt(family);
  const issues = family.flatMap((p) => p.issues ?? []);
  const href = `/p/${encodeURIComponent(latest.id)}`;
  const toggle = () => {
    selection.value = selected
      ? selection.value.filter((id) => id !== latest.id)
      : [...selection.value, latest.id];
  };

  return (
    <article class={`card ${selected ? "selected" : ""} ${family.length > 1 ? "stacked" : ""}`}>
      <a href={href} class="card-thumb" ref={thumbRef} aria-label={`Open ${latest.title}`}>
        {scale > 0 && (
          <Frame
            src={latest.urls.raw}
            title={`${latest.title} preview`}
            width={THUMB_WIDTH}
            height={THUMB_HEIGHT}
            scale={scale}
            revision={revisionOf(latest.id)}
            interactive={false}
            lazy
          />
        )}
      </a>
      <div class="card-body">
        <div class="card-title-row">
          <a href={href} class="card-title">
            {latest.title}
          </a>
          <label class="select-toggle" title="Select for comparison">
            <input type="checkbox" checked={selected} onChange={toggle} />
            <span class="visually-hidden">Select {latest.title} for comparison</span>
          </label>
        </div>
        <div class="card-meta">
          <StatusBadge status={latest.status} />
          {family.length > 1 && (
            <span class="chip" title={family.map((p) => p.title).join("\n")}>
              {family.length} versions
            </span>
          )}
          {latest.group && <span class="chip muted">{latest.group}</span>}
          {latest.tags.map((t) => (
            <span class="chip muted" key={t}>
              #{t}
            </span>
          ))}
          {issues.length ? (
            <span class="chip warn" title={issues.join("\n")}>
              ⚠ {issues.length}
            </span>
          ) : null}
        </div>
        <div class="card-footer">
          <span>{latest.createdBy?.name ?? latest.createdBy?.kind ?? ""}</span>
          <time dateTime={updatedAt} title={new Date(updatedAt).toLocaleString()}>
            {relativeTime(updatedAt)}
          </time>
        </div>
      </div>
    </article>
  );
}
