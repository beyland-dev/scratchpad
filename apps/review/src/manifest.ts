import {
  REVIEW_MANIFEST_VERSION,
  type ReviewDevice,
  type ReviewManifest,
  type ReviewManifestItem,
  type ReviewPresentation,
} from "@beyland/sprue-core/review-manifest";

export const REVIEW_DEVICES: readonly ReviewDevice[] = ["desktop", "laptop", "tablet", "mobile"];
const PRESENTATIONS: readonly ReviewPresentation[] = ["sequence", "compare", "both"];

/** Most options shown side by side in compare. */
export const MAX_COMPARE = 4;

/** review.json is missing something the reviewer can't do without. */
export class ManifestError extends Error {
  override name = "ManifestError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isReviewDevice(value: unknown): value is ReviewDevice {
  return REVIEW_DEVICES.includes(value as ReviewDevice);
}

/**
 * A path inside the export: relative, without a scheme, host, query, `..` or backslashes. Keeps
 * frames on the export's own files whatever review.json says.
 */
export function isExportPath(path: unknown): path is string {
  if (typeof path !== "string" || !path || path.length > 1024) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/")) return false;
  if (/[\\?#]/.test(path)) return false;
  return path.split("/").every((segment) => segment !== ".." && segment !== "");
}

function normalizeItem(raw: unknown): ReviewManifestItem | null {
  if (!isRecord(raw)) return null;
  const key = text(raw.key);
  if (!key || !/^[\w-]+$/.test(key) || !isExportPath(raw.entry)) return null;
  const note = text(raw.note);
  const pages = Array.isArray(raw.pages)
    ? [...new Set(raw.pages.filter(isExportPath))].filter((p) => p !== raw.entry)
    : [];
  return {
    key,
    label: text(raw.label) ?? key,
    ...(note ? { note } : {}),
    entry: raw.entry,
    pages,
  };
}

/**
 * A usable manifest from parsed review.json: unknown or malformed optional fields fall back to
 * defaults and invalid items are dropped. Throws `ManifestError` when there is nothing to review.
 */
export function parseManifest(data: unknown): ReviewManifest {
  if (!isRecord(data)) throw new ManifestError("review.json is not a JSON object.");
  if (data.version !== REVIEW_MANIFEST_VERSION) {
    throw new ManifestError(`Unsupported review.json version: ${String(data.version)}.`);
  }
  const seen = new Set<string>();
  const items: ReviewManifestItem[] = [];
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    const item = normalizeItem(raw);
    if (item && !seen.has(item.key)) {
      seen.add(item.key);
      items.push(item);
    }
  }
  if (items.length === 0) throw new ManifestError("This review has no options to show.");
  const round = typeof data.round === "number" && data.round >= 1 ? Math.floor(data.round) : 1;
  const intro = text(data.intro);
  const theme = text(data.theme);
  return {
    version: REVIEW_MANIFEST_VERSION,
    title: text(data.title) ?? "Design review",
    ...(intro ? { intro } : {}),
    questions: Array.isArray(data.questions)
      ? data.questions.map(text).filter((q): q is string => Boolean(q))
      : [],
    presentation: PRESENTATIONS.includes(data.presentation as ReviewPresentation)
      ? (data.presentation as ReviewPresentation)
      : "both",
    device: isReviewDevice(data.device) ? data.device : "desktop",
    ...(theme ? { theme } : {}),
    round,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    project: text(data.project) ?? "",
    items,
  };
}

/** Paragraphs of plain-text intro (separated by blank lines). */
export function introParagraphs(intro: string | undefined): string[] {
  if (!intro) return [];
  return intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function canSequence(manifest: ReviewManifest): boolean {
  return manifest.presentation !== "compare";
}

export function canCompare(manifest: ReviewManifest): boolean {
  return manifest.presentation !== "sequence" && manifest.items.length >= 2;
}

/** Every page of an item, entry first. */
export function pagesOf(item: ReviewManifestItem): string[] {
  return [item.entry, ...item.pages.filter((p) => p !== item.entry)];
}

/** The page to show: `page` when it belongs to the item, else its entry. */
export function pageOf(item: ReviewManifestItem, page: string | undefined): string {
  return page && pagesOf(item).includes(page) ? page : item.entry;
}

/** A page's path within its prototype folder, e.g. "settings/index.html". */
export function pageLabel(item: ReviewManifestItem, page: string): string {
  const folder = item.entry.slice(0, item.entry.lastIndexOf("/") + 1);
  return folder && page.startsWith(folder) ? page.slice(folder.length) : page;
}

/** Item keys to compare: the requested ones that exist (else the first few), at most `MAX_COMPARE`. */
export function compareKeys(manifest: ReviewManifest, requested: string[] | undefined): string[] {
  const known = new Set(manifest.items.map((i) => i.key));
  const keys = [...new Set((requested ?? []).filter((k) => known.has(k)))].slice(0, MAX_COMPARE);
  return keys.length ? keys : manifest.items.slice(0, MAX_COMPARE).map((i) => i.key);
}

/** "Oct 28, 2026" for an ISO date, or "" when it can't be read. */
export function formatDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

/** Absolute URL of a path in the export, resolved against the page (works from any sub-path). */
export function exportUrl(path: string, base: string): string {
  return new URL(path, base).href;
}
