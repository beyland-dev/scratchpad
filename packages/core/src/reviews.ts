import { mkdir, readFile, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CoreError } from "./errors.ts";
import { nowIso, pathExists, slugify, uniqueSlug, writeJson } from "./fs-utils.ts";
import { ID_PATTERN, SlugSchema } from "./schemas.ts";
import type { ScopeContext } from "./scope.ts";
import { REVIEWS_DIR } from "./workspace.ts";

export const REVIEW_META_FILE = "review.json";

export const ReviewItemSchema = z.object({
  /** Prototype id (in the same project): a specific version of a family. */
  prototype: SlugSchema,
  /** What reviewers call it, e.g. "Option A". */
  label: z.string().min(1),
  /** Context shown to reviewers with it. */
  note: z.string().optional(),
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const ReviewRoundSchema = z.object({
  round: z.number().int().positive(),
  publishedAt: z.string(),
  target: z.enum(["github-pages"]),
  /** Where this round is published (its own URL, frozen). */
  url: z.string().optional(),
  /** Path of the round inside the published site, e.g. "checkout-3f9a/round-2". */
  path: z.string(),
  /** The prototypes as published. */
  prototypes: z.array(z.object({ id: z.string(), updatedAt: z.string() })),
});
export type ReviewRound = z.infer<typeof ReviewRoundSchema>;

/** Contents of `projects/<project>/reviews/<id>/review.json`. */
export const ReviewFileSchema = z.object({
  title: z.string().min(1),
  /** Plain text shown to reviewers before the options. */
  intro: z.string().optional(),
  /** What feedback is wanted. */
  questions: z.array(z.string().min(1)).default([]),
  /** One option at a time, side by side, or both. */
  presentation: z.enum(["sequence", "compare", "both"]).default("both"),
  device: z.enum(["desktop", "laptop", "tablet", "mobile"]).default("desktop"),
  theme: z.string().optional(),
  items: z.array(ReviewItemSchema).default([]),
  /** Hard-to-guess path segment the review is published under (set on first publish). */
  slug: z.string().optional(),
  rounds: z.array(ReviewRoundSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReviewFile = z.infer<typeof ReviewFileSchema>;

export type Review = ReviewFile & { id: string; project: string; issues?: string[] };

export type ReviewInput = Partial<Omit<ReviewFile, "slug" | "rounds" | "createdAt" | "updatedAt">>;

/** The reviews of one project: `projects/<project>/reviews/<id>/`. */
export class ReviewStore {
  readonly #ctx: ScopeContext;
  readonly dir: string;
  #index = new Map<string, Review>();

  constructor(context: ScopeContext) {
    this.#ctx = context;
    this.dir = path.join(context.dir, REVIEWS_DIR);
  }

  dirOf(id: string): string {
    if (!ID_PATTERN.test(id))
      throw new CoreError("INVALID_INPUT", `Invalid review id: ${JSON.stringify(id)}`);
    return path.join(this.dir, id);
  }

  async load(): Promise<void> {
    const next = new Map<string, Review>();
    if (await pathExists(this.dir)) {
      for (const entry of await readdir(this.dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue;
        const review = await this.#readFromDisk(entry.name);
        if (review) next.set(review.id, review);
      }
    }
    this.#index = next;
  }

  async reloadOne(id: string): Promise<Review | undefined> {
    if (!ID_PATTERN.test(id)) return undefined;
    const review = await this.#readFromDisk(id);
    if (review) this.#index.set(id, review);
    else this.#index.delete(id);
    return review;
  }

  has(id: string): boolean {
    return this.#index.has(id);
  }

  get(id: string): Review {
    const review = this.#index.get(id);
    if (!review)
      throw new CoreError(
        "NOT_FOUND",
        `No review ${JSON.stringify(id)} in project ${JSON.stringify(this.#ctx.project)}`,
      );
    return review;
  }

  /** Newest first. */
  list(): Review[] {
    return [...this.#index.values()].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
  }

  async create(input: ReviewInput & { title: string; id?: string }): Promise<Review> {
    const { id: requested, ...fields } = input;
    const now = nowIso();
    const meta = ReviewFileSchema.parse({ ...fields, createdAt: now, updatedAt: now });
    await mkdir(this.dir, { recursive: true });
    const id = requested ?? uniqueSlug(slugify(input.title), (c) => this.#index.has(c));
    if (!ID_PATTERN.test(id))
      throw new CoreError("INVALID_INPUT", `Invalid review id: ${JSON.stringify(id)}`);
    try {
      await mkdir(this.dirOf(id));
    } catch {
      throw new CoreError("CONFLICT", `A review with id ${JSON.stringify(id)} already exists`);
    }
    await writeJson(path.join(this.dirOf(id), REVIEW_META_FILE), meta);
    return (await this.reloadOne(id))!;
  }

  /** Patch fields; `null` clears optional ones. */
  async update(
    id: string,
    patch: { [K in keyof ReviewFile]?: ReviewFile[K] | null },
  ): Promise<Review> {
    const { id: _id, project: _project, issues: _issues, ...current } = this.get(id);
    const next: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null || value === "") delete next[key];
      else next[key] = value;
    }
    next.updatedAt = nowIso();
    await writeJson(path.join(this.dirOf(id), REVIEW_META_FILE), ReviewFileSchema.parse(next));
    return (await this.reloadOne(id))!;
  }

  async delete(id: string): Promise<{ id: string; project: string; trashedTo: string }> {
    this.get(id);
    await mkdir(this.#ctx.trashDir, { recursive: true });
    const target = path.join(this.#ctx.trashDir, `review-${id}-${Date.now()}`);
    await rename(this.dirOf(id), target);
    this.#index.delete(id);
    return {
      id,
      project: this.#ctx.project,
      trashedTo: path.relative(this.#ctx.workspace.root, target),
    };
  }

  async #readFromDisk(id: string): Promise<Review | undefined> {
    const dir = path.join(this.dir, id);
    const file = path.join(dir, REVIEW_META_FILE);
    let dirStat;
    try {
      dirStat = await stat(dir);
    } catch {
      return undefined;
    }
    if (!dirStat.isDirectory() || !(await pathExists(file))) return undefined;
    const issues: string[] = [];
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    } catch (error) {
      issues.push(`${REVIEW_META_FILE} is not valid JSON: ${(error as Error).message}`);
    }
    const defaults = {
      title: id,
      createdAt: dirStat.mtime.toISOString(),
      updatedAt: dirStat.mtime.toISOString(),
    };
    const parsed = ReviewFileSchema.safeParse({ ...defaults, ...raw });
    let meta: ReviewFile;
    if (parsed.success) meta = parsed.data;
    else {
      issues.push(
        ...parsed.error.issues.map(
          (i) => `${REVIEW_META_FILE}: ${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      );
      const salvaged: Record<string, unknown> = { ...defaults };
      for (const [key, value] of Object.entries(raw))
        if (ReviewFileSchema.safeParse({ ...salvaged, [key]: value }).success)
          salvaged[key] = value;
      meta = ReviewFileSchema.parse(salvaged);
    }
    return { id, project: this.#ctx.project, ...meta, ...(issues.length ? { issues } : {}) };
  }
}
