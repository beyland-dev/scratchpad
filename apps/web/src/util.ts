import { useEffect, useState } from "preact/hooks";

export interface Device {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** Viewport presets, largest first; the first one is the default. */
export const DEVICES: [Device, ...Device[]] = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "laptop", label: "Laptop", width: 1280, height: 800 },
  { id: "tablet", label: "Tablet", width: 820, height: 1180 },
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
];

export const DEFAULT_DEVICE = DEVICES[0];

/** The preset with this id, or the default for unknown ids (including the retired "fit"). */
export function deviceById(id: string | undefined): Device {
  return DEVICES.find((d) => d.id === id) ?? DEFAULT_DEVICE;
}

/** Track an element's content box size. Returns a callback ref so it works for elements that mount later. */
export function useElementSize<T extends HTMLElement>(): [
  (element: T | null) => void,
  { width: number; height: number },
] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size];
}

const UNITS: [suffix: string, seconds: number][] = [
  ["y", 365 * 24 * 3600],
  ["mo", 30 * 24 * 3600],
  ["d", 24 * 3600],
  ["h", 3600],
  ["m", 60],
];

/** Compact time since `iso`: "4m ago", "6h ago", "17d ago", "3mo ago", "2y ago", or "just now". */
export function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  for (const [suffix, size] of UNITS) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${suffix} ago`;
  }
  return "just now";
}

/** "Edited 4m ago" (or "Edited just now"). */
export function editedAgo(iso: string): string {
  return `Edited ${relativeTime(iso)}`;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A lowercase, URL- and folder-safe id from a name ("Acme UI" → "acme-ui"). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
