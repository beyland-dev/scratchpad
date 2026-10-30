import { versionLabel } from "@beyland/sprue-core/family";
import { useRef, useState } from "preact/hooks";
import type { PrototypeWithUrls } from "../types.ts";
import { relativeTime } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { MenuPopup, type MenuPosition } from "./Menu.tsx";

/** Families up to this size get one tab per version; larger ones only get the compact stepper. */
const MAX_TABS = 5;

/**
 * Switches between the versions of a variant family. Small families get tabs (V1, V2, Latest); large
 * families, and narrow windows, get a stepper: ‹ V3 · 3/9 › whose label opens a list of every version.
 */
export function VersionSwitcher({
  family,
  currentId,
  onSelect,
}: {
  family: PrototypeWithUrls[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  if (family.length < 2) return null;
  const tabs = family.length <= MAX_TABS;
  return (
    <>
      {tabs && (
        <div class="segmented version-tabs" role="tablist" aria-label="Versions (← → or 1–9)">
          {family.map((member, i) => (
            <button
              type="button"
              role="tab"
              key={member.id}
              aria-selected={member.id === currentId}
              class={member.id === currentId ? "active" : ""}
              title={[member.description, i < 9 ? `Press ${i + 1}` : ""].filter(Boolean).join("\n")}
              onClick={() => onSelect(member.id)}
            >
              {versionLabel(i, family.length)}
            </button>
          ))}
        </div>
      )}
      <VersionStepper family={family} currentId={currentId} onSelect={onSelect} responsive={tabs} />
    </>
  );
}

function VersionStepper({
  family,
  currentId,
  onSelect,
  responsive,
}: {
  family: PrototypeWithUrls[];
  currentId: string;
  onSelect: (id: string) => void;
  /** Only shown when the tabs don't fit (CSS swaps them). */
  responsive: boolean;
}) {
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const index = Math.max(
    0,
    family.findIndex((p) => p.id === currentId),
  );
  const prev = family[index - 1];
  const next = family[index + 1];
  return (
    <div
      class={`segmented version-stepper ${responsive ? "responsive" : ""}`}
      role="group"
      aria-label="Versions (← → or 1–9)"
    >
      <button
        type="button"
        class="stepper-arrow"
        aria-label="Previous version"
        title="Previous version (←)"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.id)}
      >
        <Icon name="chevron-left" size={14} />
      </button>
      <button
        ref={button}
        type="button"
        class={`stepper-current ${menu ? "active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        title="All versions"
        onClick={(e) => {
          if (menu) return setMenu(null);
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.right, y: rect.bottom + 6, alignRight: true });
        }}
      >
        {versionLabel(index, family.length)}
        <span class="count">
          {index + 1}/{family.length}
        </span>
        <Icon name="chevron-down" size={12} />
      </button>
      <button
        type="button"
        class="stepper-arrow"
        aria-label="Next version"
        title="Next version (→)"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
      >
        <Icon name="chevron-right" size={14} />
      </button>
      {menu && (
        <MenuPopup
          label="Versions"
          position={menu}
          anchor={button}
          onClose={() => {
            setMenu(null);
            button.current?.focus();
          }}
          // Newest first, like a history.
          items={family
            .map((member, i) => ({
              label: versionLabel(i, family.length),
              detail: member.description,
              hint: relativeTime(member.updatedAt),
              checked: member.id === currentId,
              onSelect: () => onSelect(member.id),
            }))
            .reverse()}
        />
      )}
    </div>
  );
}
