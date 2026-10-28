import { Fragment } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "./Icon.tsx";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Secondary text under the label. */
  detail?: string;
  /** Muted text at the end of the row (a time, a shortcut). */
  hint?: string;
  /** Makes it a radio item: the menu shows which option is current. */
  checked?: boolean;
  /** Draw a divider above this item. */
  divider?: boolean;
}

export interface MenuPosition {
  x: number;
  y: number;
  /** Align the menu's right edge to `x` (for buttons at the right of a row). */
  alignRight?: boolean;
}

/** A floating menu at a fixed position (escapes overflow clipping). Arrow keys move, Escape closes. */
export function MenuPopup({
  items,
  position,
  onClose,
  label,
  anchor,
}: {
  items: MenuItem[];
  position: MenuPosition;
  onClose: () => void;
  label: string;
  /** The button that opened it: pressing it again toggles (handled by its click), not "outside". */
  anchor?: { current: HTMLElement | null };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const menu = ref.current;
    (
      menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      menu?.querySelector<HTMLButtonElement>("button")
    )?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.current?.contains(target)) return;
      onClose();
    };
    const onResize = () => onClose();
    // The page scrolling away from the anchor closes it; scrolling a long menu itself doesn't.
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);
  const move = (delta: number) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + delta + buttons.length) % buttons.length]?.focus();
  };
  const left = position.alignRight ? undefined : `${Math.min(position.x, innerWidth - 200)}px`;
  const right = position.alignRight ? `${innerWidth - position.x}px` : undefined;
  const rowHeight = items.some((item) => item.detail) ? 48 : 32;
  return (
    <div
      ref={ref}
      class="menu"
      role="menu"
      aria-label={label}
      style={{
        top: `${Math.max(8, Math.min(position.y, innerHeight - rowHeight * items.length - 16))}px`,
        left,
        right,
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") move(1);
        else if (e.key === "ArrowUp") move(-1);
        else if (e.key === "Escape" || e.key === "Tab") onClose();
        else return;
        e.preventDefault();
      }}
    >
      {items.map((item) => {
        const radio = item.checked !== undefined;
        const rich = radio || item.detail || item.hint;
        return (
          <Fragment key={item.label}>
            {item.divider && <hr class="menu-divider" />}
            <button
              type="button"
              role={radio ? "menuitemradio" : "menuitem"}
              aria-checked={radio ? item.checked : undefined}
              class={[item.danger ? "danger" : "", rich ? "rich" : ""].filter(Boolean).join(" ")}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {rich ? (
                <>
                  {radio && (
                    <span class="menu-check" aria-hidden="true">
                      {item.checked && <Icon name="check" size={14} />}
                    </span>
                  )}
                  <span class="menu-text">
                    <span class="menu-label">{item.label}</span>
                    {item.detail && <span class="menu-detail">{item.detail}</span>}
                  </span>
                  {item.hint && <span class="menu-hint">{item.hint}</span>}
                </>
              ) : (
                item.label
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/** A "⋯" button that opens a menu below it. */
export function MenuButton({
  items,
  label,
  class: className,
}: {
  items: MenuItem[];
  label: string;
  class?: string;
}) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        class={`icon-button menu-button ${position ? "open" : ""} ${className ?? ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        title={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (position) return setPosition(null);
          const rect = e.currentTarget.getBoundingClientRect();
          setPosition({ x: rect.right, y: rect.bottom + 4, alignRight: true });
        }}
      >
        <Icon name="more" />
      </button>
      {position && (
        <MenuPopup
          items={items}
          position={position}
          label={label}
          anchor={button}
          onClose={() => {
            setPosition(null);
            button.current?.focus();
          }}
        />
      )}
    </>
  );
}
