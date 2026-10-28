import type { JSX } from "preact";
import type { ProjectEntry } from "../store.ts";

/** Gradient pairs for generated icons; a project's id picks one (and a pattern) deterministically. */
const PALETTES: [string, string][] = [
  ["#6366f1", "#a855f7"],
  ["#0ea5e9", "#22d3ee"],
  ["#f97316", "#facc15"],
  ["#e11d48", "#f472b6"],
  ["#059669", "#a3e635"],
  ["#2563eb", "#38bdf8"],
  ["#c026d3", "#fb7185"],
  ["#0f766e", "#5eead4"],
  ["#7c3aed", "#38bdf8"],
  ["#dc2626", "#fb923c"],
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Abstract white shapes over the gradient, in a 24×24 box. */
const PATTERNS: (() => JSX.Element)[] = [
  () => (
    <>
      <circle cx="12" cy="12" r="7" opacity="0.35" />
      <circle cx="12" cy="12" r="3.5" opacity="0.85" />
    </>
  ),
  () => (
    <>
      <path d="M-2 18 18 -2h6L0 24h-2zM6 24 24 6v6L12 24z" opacity="0.4" />
    </>
  ),
  () => (
    <>
      <circle cx="24" cy="24" r="15" opacity="0.4" />
      <circle cx="24" cy="24" r="8" opacity="0.5" />
    </>
  ),
  () => (
    <>
      <circle cx="9" cy="12" r="6" opacity="0.5" />
      <circle cx="15" cy="12" r="6" opacity="0.5" />
    </>
  ),
  () => (
    <>
      <path d="M12 4 21 19H3z" opacity="0.55" />
    </>
  ),
  () => (
    <>
      <rect x="5" y="5" width="8" height="8" rx="2" opacity="0.8" />
      <rect x="11" y="11" width="8" height="8" rx="2" opacity="0.4" />
    </>
  ),
  () => (
    <>
      <path d="M0 16c4-4 8 4 12 0s8 4 12 0v8H0z" opacity="0.45" />
      <path
        d="M0 10c4-4 8 4 12 0s8 4 12 0"
        stroke="#fff"
        stroke-width="1.5"
        fill="none"
        opacity="0.6"
      />
    </>
  ),
  () => (
    <>
      <circle cx="7" cy="7" r="2.2" opacity="0.85" />
      <circle cx="17" cy="7" r="2.2" opacity="0.5" />
      <circle cx="7" cy="17" r="2.2" opacity="0.5" />
      <circle cx="17" cy="17" r="2.2" opacity="0.85" />
    </>
  ),
];

export const PATTERN_COUNT = PATTERNS.length;
/** Projects without a chosen pattern derive one from the first patterns, so adding patterns never changes existing icons. */
const DERIVED_PATTERNS = 7;

/** The pattern a project's generated icon uses: its chosen one, or one derived from its id. */
export function patternOf(project: { id: string; pattern?: number }): number {
  return project.pattern !== undefined
    ? project.pattern % PATTERN_COUNT
    : (hash(project.id) >>> 8) % DERIVED_PATTERNS;
}

/** A project's icon: its own image when it has one, otherwise a generated abstract tile. */
export function ProjectIcon({ project, size = 32 }: { project: ProjectEntry; size?: number }) {
  const style = { width: `${size}px`, height: `${size}px` };
  if (project.iconUrl) {
    return (
      <span class="project-icon image" style={style} aria-hidden="true">
        <img src={project.iconUrl} alt="" draggable={false} />
      </span>
    );
  }
  // With a chosen pattern, the automatic colors follow it (so the pattern picker previews them);
  // older projects without one derive both from their id.
  const pattern = patternOf(project);
  const [from, to] = project.color
    ? [project.color, `color-mix(in oklab, ${project.color} 55%, white)`]
    : PALETTES[(project.pattern ?? hash(project.id)) % PALETTES.length]!;
  const Pattern = PATTERNS[pattern]!;
  return (
    <span
      class="project-icon generated"
      style={{ ...style, background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="#fff">
        <Pattern />
      </svg>
    </span>
  );
}
