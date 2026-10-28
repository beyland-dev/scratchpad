/**
 * The viewer side of the prototype theme bridge (see packages/core/src/systems/theme-bridge.ts):
 * prototypes that load a design system announce their themes with "dt-theme-ready", take an
 * initial theme from `?theme=` and switch live on "dt-theme" messages.
 */

export interface ThemeOption {
  id: string;
  label: string;
  kind?: string;
}

/** What a prototype's design system runtime reported once it loaded. */
export interface ThemeReady {
  system: string;
  themes: ThemeOption[];
  /** The theme on screen (the one passed in, else the prototype's authored one). */
  theme: string | null;
}

/** `url` with `?theme=<id>` set (or unchanged without a theme), keeping its other parameters. */
export function withTheme(url: string, theme: string | undefined): string {
  if (!theme) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("theme", theme);
  return parsed.toString();
}

/** A query string from the given parameters, skipping empty ones. */
export function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Viewer URL of a prototype, keeping the viewport and theme across versions. */
export function prototypeHref(
  id: string,
  query: { device?: string; theme?: string; page?: string },
): string {
  return withQuery(`/p/${encodeURIComponent(id)}`, {
    device: query.device,
    theme: query.theme,
    page: query.page,
  });
}

/** Parse a "dt-theme-ready" message (anything else, or a malformed one, is null). */
export function parseThemeReady(data: unknown): ThemeReady | null {
  const d = data as Partial<ThemeReady> & { type?: unknown };
  if (!d || d.type !== "dt-theme-ready" || typeof d.system !== "string" || !Array.isArray(d.themes))
    return null;
  const themes = d.themes.filter(
    (t): t is ThemeOption => Boolean(t) && typeof t.id === "string" && typeof t.label === "string",
  );
  return { system: d.system, themes, theme: typeof d.theme === "string" ? d.theme : null };
}

/**
 * The themes to offer for a prototype: only when it resolves to a design system, that system's
 * runtime answered from the frame, and it has more than one theme. Otherwise the control is hidden.
 */
export function themeOptions(
  resolvedSystem: string | undefined,
  ready: ThemeReady | null | undefined,
): ThemeOption[] | null {
  if (!resolvedSystem || !ready || ready.system !== resolvedSystem) return null;
  return ready.themes.length > 1 ? ready.themes : null;
}

/** Ask a prototype frame to switch themes. Sandboxed frames have an opaque origin, hence "*". */
export function postTheme(frame: HTMLIFrameElement | null, theme: string): void {
  frame?.contentWindow?.postMessage({ type: "dt-theme", theme }, "*");
}
