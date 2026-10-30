import { useState } from "preact/hooks";
import { prototypeHref } from "../prototype-theme.ts";
import { revisionOf, selection } from "../store.ts";
import type { PrototypeWithUrls } from "../types.ts";
import { editedAgo, useElementSize } from "../util.ts";
import { DeletePrototypeDialog, PrototypeDialog } from "./Dialogs.tsx";
import { Frame } from "./Frame.tsx";
import { Icon } from "./Icon.tsx";
import { MenuButton } from "./Menu.tsx";
import { openNewVariant } from "./NewVariant.tsx";

const THUMB_WIDTH = 1280;
const THUMB_HEIGHT = 800;

/** Most recent update across a family, used for sorting and the card timestamp. */
export function familyUpdatedAt(family: PrototypeWithUrls[]): string {
  return family.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), "");
}

/** One card per variant family. Single prototypes show one thumbnail; families show a folder of their newest versions. */
export function PrototypeCard({
  family,
  groups,
}: {
  family: PrototypeWithUrls[];
  groups: string[];
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const latest = family[family.length - 1]!;
  // Versions share the family's name (the original's).
  const title = family[0]!.title;
  const isFamily = family.length > 1;
  const selected = selection.value.includes(latest.id);
  const updatedAt = familyUpdatedAt(family);
  const issues = family.flatMap((p) => p.issues ?? []);
  const href = prototypeHref(latest.id);
  const toggle = () => {
    selection.value = selected
      ? selection.value.filter((id) => id !== latest.id)
      : [...selection.value, latest.id];
  };

  return (
    <article class={`card ${selected ? "selected" : ""} ${isFamily ? "family" : ""}`}>
      <div class="card-thumb-wrap">
        {isFamily ? (
          <FamilyFolder family={family} />
        ) : (
          <PrototypeThumb
            proto={latest}
            class="card-thumb"
            title={latest.description}
            href={thumbHref(latest)}
          />
        )}
        <label class="card-select" title="Select to compare">
          <input type="checkbox" checked={selected} onChange={toggle} />
          <span class="visually-hidden">Select {title} to compare</span>
        </label>
        <MenuButton
          class="card-menu"
          label={`${title} options`}
          items={[
            { label: "New variant…", onSelect: () => openNewVariant(latest.id) },
            { label: "Edit details…", onSelect: () => setDialog("edit") },
            {
              label: isFamily ? "Delete latest version…" : "Delete…",
              danger: true,
              onSelect: () => setDialog("delete"),
            },
          ]}
        />
      </div>
      <div class="card-body">
        <a href={href} class="card-title" title={title}>
          {title}
        </a>
        {issues.length ? (
          <span
            class="card-issues"
            title={issues.join("\n")}
            aria-label={`${issues.length} issues`}
          >
            <Icon name="alert" size={13} />
          </span>
        ) : null}
        <time class="card-time" dateTime={updatedAt} title={new Date(updatedAt).toLocaleString()}>
          {editedAgo(updatedAt)}
        </time>
      </div>
      {dialog === "edit" && (
        <PrototypeDialog proto={latest} groups={groups} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeletePrototypeDialog
          proto={latest}
          versions={family.length}
          onClose={() => setDialog(null)}
        />
      )}
    </article>
  );
}

/** A decorative, scaled-down render of a prototype; a link to it when `href` is given. */
export function PrototypeThumb({
  proto,
  class: className,
  title,
  href,
}: {
  proto: PrototypeWithUrls;
  class: string;
  title?: string;
  href?: string;
}) {
  const [ref, size] = useElementSize<HTMLElement>();
  const scale = size.width ? size.width / THUMB_WIDTH : 0;
  const frame = scale > 0 && (
    <Frame
      src={proto.urls.raw}
      title={`${proto.title} preview`}
      width={THUMB_WIDTH}
      height={THUMB_HEIGHT}
      scale={scale}
      revision={revisionOf(proto.id)}
      interactive={false}
      lazy
    />
  );
  if (!href)
    return (
      <span class={className} ref={ref} aria-hidden="true">
        {frame}
      </span>
    );
  return (
    <a href={href} class={className} ref={ref} tabIndex={-1} aria-hidden="true" title={title}>
      {frame}
    </a>
  );
}

const thumbHref = (proto: PrototypeWithUrls) => prototypeHref(proto.id);

const FOLDER_SLOTS = 4;

/** Folder-style preview of a variant family: its newest versions in a 2×2 grid, each opening that version. */
function FamilyFolder({ family }: { family: PrototypeWithUrls[] }) {
  const newestFirst = family
    .map((p, i) => ({ proto: p, version: i + 1, latest: i === family.length - 1 }))
    .reverse();
  const hidden = Math.max(0, family.length - FOLDER_SLOTS);
  return (
    <div class="card-folder">
      {Array.from({ length: FOLDER_SLOTS }, (_, i) => {
        const item = newestFirst[i];
        if (!item) return <span class="folder-cell empty" key={i} />;
        const isLast = i === FOLDER_SLOTS - 1 && hidden > 0;
        return (
          <div class="folder-cell" key={item.proto.id}>
            <PrototypeThumb
              proto={item.proto}
              class="folder-thumb"
              href={thumbHref(item.proto)}
              title={`V${item.version}${item.proto.description ? `: ${item.proto.description}` : ""}`}
            />
            <span class="folder-version">{item.latest ? "Latest" : `V${item.version}`}</span>
            {isLast && <span class="folder-more">+{hidden + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}
