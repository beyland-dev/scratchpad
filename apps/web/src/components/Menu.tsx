import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "./Icon.tsx";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
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
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.current?.contains(target)) return;
      onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onScroll);
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
  return (
    <div
      ref={ref}
      class="menu"
      role="menu"
      aria-label={label}
      style={{
        top: `${Math.min(position.y, innerHeight - 40 * items.length - 16)}px`,
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
      {items.map((item) => (
        <button
          type="button"
          role="menuitem"
          key={item.label}
          class={item.danger ? "danger" : ""}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
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
