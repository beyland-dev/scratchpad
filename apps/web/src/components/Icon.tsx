const PATHS = {
  "arrow-left": "M19 12H5m7 7-7-7 7-7",
  refresh: "M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 4v4.5h-4.5",
  external:
    "M18 14v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h3m4-2h4a2 2 0 0 1 2 2v4m-.6-5.4L11 13",
  x: "M18 6 6 18M6 6l12 12",
  alert:
    "M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  panel: "M7 5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zm8 0v14",
  sidebar: "M7 5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zm2 0v14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-4.35-4.35",
  check: "m5 12.5 4.5 4.5L19 7",
  more: "M5.5 12h.01M12 12h.01M18.5 12h.01",
  shuffle:
    "M4 12a8 8 0 0 1 13.66-5.66L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.66 5.66L4 15.5M4 20v-4.5h4.5",
  plus: "M12 5v14M5 12h14",
  upload: "M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2",
  columns:
    "M3 6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm11 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z",
} as const;

export type IconName = keyof typeof PATHS;

const STROKES: Partial<Record<IconName, number>> = { more: 2.75 };

/** A 24×24 stroke icon that inherits the current text color. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={STROKES[name] ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
