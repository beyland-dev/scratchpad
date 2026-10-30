import { signal } from "@preact/signals";

export type ColorScheme = "light" | "dark";

/**
 * App themes; their palettes live in styles.css under `[data-theme="<id>"]`.
 * Keep the scheme map in index.html's pre-paint script in sync.
 */
export const THEMES = [
  { id: "light", label: "Light", scheme: "light" },
  { id: "periwinkle", label: "Periwinkle", scheme: "light" },
  { id: "fog", label: "Fog", scheme: "light" },
  { id: "sand", label: "Sand", scheme: "light" },
  { id: "mint", label: "Mint", scheme: "light" },
  { id: "orchid", label: "Orchid", scheme: "light" },
  { id: "sky", label: "Sky", scheme: "light" },
  { id: "coral", label: "Coral", scheme: "light" },
  { id: "aqua", label: "Aqua", scheme: "light" },
  { id: "lime", label: "Lime", scheme: "light" },
  { id: "lemonade", label: "Lemonade", scheme: "light" },
  { id: "bubblegum", label: "Bubblegum", scheme: "light" },
  { id: "dark", label: "Dark", scheme: "dark" },
  { id: "graphite", label: "Graphite", scheme: "dark" },
  { id: "slate", label: "Slate", scheme: "dark" },
  { id: "forest", label: "Forest", scheme: "dark" },
  { id: "midnight", label: "Midnight", scheme: "dark" },
  { id: "plum", label: "Plum", scheme: "dark" },
  { id: "ocean", label: "Ocean", scheme: "dark" },
  { id: "ember", label: "Ember", scheme: "dark" },
  { id: "neon", label: "Neon", scheme: "dark" },
  { id: "abyss", label: "Abyss", scheme: "dark" },
  { id: "voltage", label: "Voltage", scheme: "dark" },
  { id: "toxic", label: "Toxic", scheme: "dark" },
  { id: "magma", label: "Magma", scheme: "dark" },
  { id: "synthwave", label: "Synthwave", scheme: "dark" },
  { id: "ultraviolet", label: "Ultraviolet", scheme: "dark" },
  { id: "contrast-dark", label: "Contrast Dark", scheme: "dark", contrast: true },
  { id: "contrast-light", label: "Contrast Light", scheme: "light", contrast: true },
  { id: "contrast-amber", label: "Contrast Amber", scheme: "dark", contrast: true },
  { id: "contrast-ink", label: "Contrast Ink", scheme: "light", contrast: true },
] as const satisfies readonly {
  id: string;
  label: string;
  scheme: ColorScheme;
  contrast?: boolean;
}[];

export type ThemeId = (typeof THEMES)[number]["id"];

/** High contrast themes get their own group in pickers. */
export function isContrastTheme(theme: (typeof THEMES)[number]): boolean {
  return "contrast" in theme;
}
export type ThemePreference = "system" | ThemeId;

/** Also read by the inline script in index.html, which applies it before the first paint. */
const THEME_KEY = "sprue.theme";

function isTheme(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

function read(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY);
  return isTheme(value) ? value : "system";
}

/** "system" leaves `data-theme` unset, so `color-scheme: light dark` follows the OS. */
function apply(preference: ThemePreference): void {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === preference);
  if (!theme) {
    delete root.dataset.theme;
    delete root.dataset.scheme;
    return;
  }
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
}

export const themePreference = signal<ThemePreference>(read());
apply(themePreference.value);

/** Show a theme without saving it (the palette previews as you move through themes); null restores the saved one. */
export function previewTheme(preference: ThemePreference | null): void {
  apply(preference ?? themePreference.value);
}

export function setThemePreference(preference: ThemePreference): void {
  if (preference === "system") localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, preference);
  themePreference.value = preference;
  apply(preference);
}

// Keep other open tabs in sync.
window.addEventListener("storage", (event) => {
  if (event.key !== THEME_KEY) return;
  themePreference.value = read();
  apply(themePreference.value);
});
