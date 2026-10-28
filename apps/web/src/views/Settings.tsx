import { Icon, type IconName } from "../components/Icon.tsx";
import { setThemePreference, themePreference, type ThemePreference } from "../theme.ts";

const THEMES: { id: ThemePreference; label: string; icon: IconName; hint: string }[] = [
  { id: "system", label: "System", icon: "monitor", hint: "Match your OS" },
  { id: "light", label: "Light", icon: "sun", hint: "Always light" },
  { id: "dark", label: "Dark", icon: "moon", hint: "Always dark" },
];

export function Settings() {
  const current = themePreference.value;
  return (
    <div class="page settings">
      <div class="page-head">
        <h1>Settings</h1>
        <p class="muted">Preferences for scratchpad in this browser.</p>
      </div>

      <section class="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <div class="settings-row">
          <div class="settings-row-text">
            <span class="settings-label" id="theme-label">
              Theme
            </span>
            <span class="settings-hint">The app's colors. Prototypes keep their own styles.</span>
          </div>
          <div class="theme-options" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((theme) => (
              <button
                type="button"
                role="radio"
                key={theme.id}
                aria-checked={current === theme.id}
                class={`theme-option ${current === theme.id ? "active" : ""}`}
                onClick={() => setThemePreference(theme.id)}
              >
                <ThemePreview theme={theme.id} />
                <span class="theme-option-label">
                  <Icon name={theme.icon} size={14} />
                  {theme.label}
                </span>
                <span class="theme-option-hint">{theme.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** A miniature app window in fixed light or dark colors; System shows both, split diagonally. */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  const mini = (scheme: "light" | "dark") => (
    <span class={`theme-window ${scheme}`}>
      <span class="tw-sidebar">
        <span class="tw-dot" />
        <span class="tw-dot" />
        <span class="tw-dot" />
      </span>
      <span class="tw-main">
        <span class="tw-bar" />
        <span class="tw-cards">
          <span class="tw-card" />
          <span class="tw-card accent" />
          <span class="tw-card" />
        </span>
      </span>
    </span>
  );
  return (
    <span class={`theme-preview ${theme}`} aria-hidden="true">
      {theme === "dark" ? mini("dark") : mini("light")}
      {theme === "system" && <span class="theme-preview-half">{mini("dark")}</span>}
    </span>
  );
}
