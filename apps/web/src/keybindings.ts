import { computed, signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { isTypingTarget } from "./util.ts";

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * App-wide keyboard shortcuts. A binding is "Mod+K" style: modifiers (Mod = ⌘ on macOS, Ctrl
 * elsewhere; Ctrl, Alt, Shift) then a key. Users can rebind them in Settings.
 */
export const SHORTCUTS = [
  { id: "palette", label: "Open command palette", group: "General", default: "Mod+K" },
  { id: "settings", label: "Open Settings", group: "General", default: "Mod+," },
  { id: "sidebar", label: "Toggle sidebar", group: "General", default: "[" },
  { id: "search", label: "Search designs", group: "General", default: "/" },
  { id: "theme", label: "Change theme", group: "General", default: "" },
  { id: "new-design", label: "New design", group: "Create", default: "" },
  { id: "new-system", label: "New design system", group: "Create", default: "" },
  { id: "new-project", label: "New project", group: "Create", default: "" },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `project-${i + 1}`,
    label: `Go to project ${i + 1}`,
    group: "Projects",
    default: `Mod+${i + 1}`,
  })),
] as const;

export type ShortcutId = (typeof SHORTCUTS)[number]["id"];

const KEY = "sprue.keybindings";
const MODIFIERS = ["Mod", "Ctrl", "Alt", "Shift"] as const;

function readOverrides(): Partial<Record<ShortcutId, string>> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" ? (value as Partial<Record<ShortcutId, string>>) : {};
  } catch {
    return {};
  }
}

/** User overrides; "" unbinds a shortcut. */
export const keybindingOverrides = signal(readOverrides());

export const keybindings = computed(() => {
  const overrides = keybindingOverrides.value;
  return Object.fromEntries(SHORTCUTS.map((s) => [s.id, overrides[s.id] ?? s.default])) as Record<
    ShortcutId,
    string
  >;
});

function save(overrides: Partial<Record<ShortcutId, string>>): void {
  keybindingOverrides.value = overrides;
  if (Object.keys(overrides).length) localStorage.setItem(KEY, JSON.stringify(overrides));
  else localStorage.removeItem(KEY);
}

/** Bind `id` to `binding` ("" to unbind); any other shortcut using it is unbound. Returns those. */
export function setKeybinding(id: ShortcutId, binding: string): ShortcutId[] {
  const next = { ...keybindingOverrides.value };
  const taken = binding
    ? SHORTCUTS.filter((s) => s.id !== id && keybindings.value[s.id] === binding).map((s) => s.id)
    : [];
  for (const other of taken) next[other] = "";
  const fallback = SHORTCUTS.find((s) => s.id === id)!.default;
  if (binding === fallback) delete next[id];
  else next[id] = binding;
  save(next);
  return taken;
}

export function resetKeybinding(id: ShortcutId): void {
  const next = { ...keybindingOverrides.value };
  delete next[id];
  save(next);
}

export function resetAllKeybindings(): void {
  save({});
}

function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

/** The binding a keydown would trigger, or null for a bare modifier press. */
export function bindingOf(event: KeyboardEvent): string | null {
  if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return null;
  const parts: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) parts.push("Mod");
  if (isMac && event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  // Shift is part of the key for symbols ("?" vs "/"), so only record it for letters, digits, and named keys.
  const key = event.code.startsWith("Digit")
    ? event.code.slice(5)
    : event.code.startsWith("Key")
      ? event.code.slice(3)
      : normalizeKey(event.key);
  if (event.shiftKey && /^[A-Z0-9]$|^[A-Z][a-z]+/.test(key)) parts.push("Shift");
  return [...parts, key].join("+");
}

const SYMBOLS: Record<string, string> = isMac
  ? { Mod: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" }
  : { Mod: "Ctrl", Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift" };

const KEY_NAMES: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Enter: "↵",
  Backspace: "⌫",
};

/** Display parts for a binding, e.g. ["⌘", "K"] or ["Ctrl", "K"]. */
export function bindingParts(binding: string): string[] {
  if (!binding) return [];
  const parts = binding.split("+");
  const key = parts.pop() || "+";
  return [
    ...parts.filter((p) => (MODIFIERS as readonly string[]).includes(p)).map((p) => SYMBOLS[p]!),
    KEY_NAMES[key] ?? key,
  ];
}

export function formatBinding(binding: string): string {
  return bindingParts(binding).join(isMac ? "" : "+");
}

export function shortcutLabel(id: ShortcutId): string {
  return formatBinding(keybindings.value[id]);
}

/** For aria-keyshortcuts: "Meta+K" / "Control+K". */
export function ariaKeyshortcuts(id: ShortcutId): string | undefined {
  const binding = keybindings.value[id];
  if (!binding) return undefined;
  return binding
    .split("+")
    .map((p) => (p === "Mod" ? (isMac ? "Meta" : "Control") : p === "Ctrl" ? "Control" : p))
    .join("+");
}

/** Bindings with a modifier work while typing; plain keys ("/", "[") only outside text fields. */
function allowedWhileTyping(binding: string): boolean {
  return /^(Mod|Ctrl|Alt)\+/.test(binding);
}

type ShortcutHandler = (event: KeyboardEvent) => boolean | void;

/** Run handlers when their shortcuts are pressed. A handler returning false lets the event through. */
export function useShortcuts(handlers: Partial<Record<ShortcutId, ShortcutHandler>>): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || recordingShortcut.value) return;
      const pressed = bindingOf(event);
      if (!pressed) return;
      for (const [id, handler] of Object.entries(ref.current) as [ShortcutId, ShortcutHandler][]) {
        if (keybindings.value[id] !== pressed) continue;
        if (!allowedWhileTyping(pressed) && isTypingTarget(event.target)) return;
        if (handler(event) === false) return;
        event.preventDefault();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function useShortcut(id: ShortcutId, handler: ShortcutHandler): void {
  useShortcuts({ [id]: handler });
}

/** True while Settings is recording a new binding, so shortcuts don't fire. */
export const recordingShortcut = signal(false);

window.addEventListener("storage", (event) => {
  if (event.key === KEY) keybindingOverrides.value = readOverrides();
});
