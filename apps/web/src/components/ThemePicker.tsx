/** Segmented control for a design system's themes (system pages, the viewer, compare). */
export function ThemePicker({
  themes,
  theme,
  onChange,
  allOption = false,
}: {
  themes: { id: string; label: string }[];
  theme: string;
  onChange: (t: string) => void;
  /** Adds an "All" option (value "all") that shows every theme side by side. */
  allOption?: boolean;
}) {
  const options = [...(allOption ? [{ id: "all", label: "All themes" }] : []), ...themes];
  return (
    <div class="segmented" role="group" aria-label="Theme">
      {options.map((t) => (
        <button
          type="button"
          key={t.id}
          class={t.id === theme ? "active" : ""}
          aria-pressed={t.id === theme}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
