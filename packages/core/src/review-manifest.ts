/**
 * The contract between a review export and the reviewer app: `review.json` at the root of an
 * exported review. Free of Node APIs, so the reviewer app (a static site) can import it.
 *
 * An export is a self-contained folder that works from any static host:
 *
 * ```
 * index.html, assets/…        the reviewer app (relative paths)
 * review.json                 this manifest
 * prototypes/<id>/…           a frozen copy of each prototype (React ones built)
 * systems/<id>/…              build output of the design systems they load
 * ```
 */

export const REVIEW_MANIFEST_FILE = "review.json";
export const REVIEW_MANIFEST_VERSION = 1;

/** How reviewers move through the options. */
export type ReviewPresentation = "sequence" | "compare" | "both";

export type ReviewDevice = "desktop" | "laptop" | "tablet" | "mobile";

export interface ReviewManifestItem {
  /** Stable, URL-safe key for links (e.g. "a", "b"). */
  key: string;
  /** What reviewers call it, e.g. "Option A". Internal names never reach the export. */
  label: string;
  /** Optional context shown with it. */
  note?: string;
  /** Its entry page, relative to the export root, e.g. "prototypes/checkout-v2/index.html". */
  entry: string;
  /** Other pages of the prototype, relative to the export root. */
  pages: string[];
}

export interface ReviewManifest {
  version: typeof REVIEW_MANIFEST_VERSION;
  title: string;
  /** Plain text (paragraphs separated by blank lines) shown before the options. */
  intro?: string;
  /** What feedback is wanted. */
  questions: string[];
  presentation: ReviewPresentation;
  /** Viewport the options open at. */
  device: ReviewDevice;
  /** Theme id to open prototypes in (prototypes without it keep their own). */
  theme?: string;
  /** Which round of the review this export is (each publish is a new round). */
  round: number;
  /** When it was exported. */
  exportedAt: string;
  /** Display name of the project (no ids or paths). */
  project: string;
  items: ReviewManifestItem[];
}
