import { signal } from "@preact/signals";

export type ThemePreference = "system" | "light" | "dark";

/** Also read by the inline script in index.html, which applies it before the first paint. */
const THEME_KEY = "sprue.theme";

function read(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

/** "system" leaves `data-theme` unset, so `color-scheme: light dark` follows the OS. */
function apply(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export const themePreference = signal<ThemePreference>(read());
apply(themePreference.value);

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
