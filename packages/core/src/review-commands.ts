import path from "node:path";
import { z } from "zod";
import type { Core } from "./core.ts";
import { CoreError } from "./errors.ts";
import { REF_PATTERN, parseRef, refKey } from "./refs.ts";
import { defineCommand } from "./registry.ts";
import { exportReview, publishReview } from "./review-export.ts";
import { ReviewFileSchema, type Review, type ReviewItem } from "./reviews.ts";
import { SlugSchema } from "./schemas.ts";

const ReviewRef = z
  .string()
  .regex(REF_PATTERN, "Use id or project/id")
  .describe("Review id, or project/id when several projects have that id");

const ItemInput = z.object({
  prototype: z
    .string()
    .regex(REF_PATTERN)
    .describe("Prototype id (a specific version) in the review's project"),
  label: z.string().min(1).optional().describe("What reviewers call it (default Option A, B, …)"),
  note: z.string().optional().describe("Context shown to reviewers with it"),
});

const Fields = {
  intro: z.string().optional().describe("Shown to reviewers first: what this is and the context"),
  questions: z.array(z.string().min(1)).optional().describe("What feedback you want"),
  presentation: ReviewFileSchema.shape.presentation
    .unwrap()
    .optional()
    .describe("'sequence' (one at a time), 'compare' (side by side) or 'both'"),
  device: ReviewFileSchema.shape.device.unwrap().optional().describe("Viewport options open at"),
  theme: z.string().optional().describe("Theme id to open prototypes in"),
};

const optionLabel = (index: number) =>
  `Option ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;

/** Resolve item prototypes in `project` and fill in default labels. */
function resolveItems(
  core: Core,
  project: string,
  items: z.infer<typeof ItemInput>[],
): ReviewItem[] {
  const scope = core.projects.scope(project);
  return items.map((item, index) => {
    const { id } = parseRef(item.prototype, project);
    scope.prototypes.get(id);
    return {
      prototype: id,
      label: item.label ?? optionLabel(index),
      ...(item.note ? { note: item.note } : {}),
    };
  });
}

/** Where a published review's stable (latest round) link points, if it's been published. */
function latestUrlOf(review: Review): string | undefined {
  return review.rounds.at(-1)?.url?.replace(/round-\d+\/$/, "");
}

function describeReview(core: Core, review: Review) {
  const latest = latestUrlOf(review);
  return {
    ...review,
    urls: {
      app: `${core.urls.app}/projects/${encodeURIComponent(review.project)}/feedback/${encodeURIComponent(review.id)}`,
      ...(latest ? { latest } : {}),
    },
  };
}

function line(review: Review): string {
  const round = review.rounds.at(-1);
  return `${refKey(review.project, review.id).padEnd(40)} ${review.title}  (${review.items.length} option(s), ${round ? `round ${round.round} published` : "draft"})`;
}

export const reviewList = defineCommand({
  name: "review.list",
  title: "List reviews",
  description:
    "List reviews: packages of prototypes shared with people for feedback, newest first. Optionally only one project's.",
  kind: "query",
  input: z.object({ project: SlugSchema.optional() }),
  handler: (input, core) => ({
    reviews: core.reviews.list(input.project).map((r) => describeReview(core, r)),
  }),
  format: (out) => out.reviews.map(line).join("\n") || "No reviews yet.",
});

export const reviewGet = defineCommand({
  name: "review.get",
  title: "Get review",
  description: "A review's settings, options, and published rounds with their URLs.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: ReviewRef }),
  handler: (input, core) => ({ review: describeReview(core, core.reviews.get(input.id)) }),
  format: (out) =>
    [
      line(out.review),
      ...out.review.items.map((i) => `  ${i.label.padEnd(12)} ${i.prototype}`),
      ...out.review.rounds.map((r) => `  round ${r.round}: ${r.url ?? r.path}`),
    ].join("\n"),
});

export const reviewCreate = defineCommand({
  name: "review.create",
  title: "Create review",
  description:
    "Package prototypes (specific versions) of a project for people to give feedback on. Reviewers see them as labeled options (Option A, B, … by default; internal names stay private), one at a time and/or side by side, with your intro and questions. Then preview it (review.preview) and publish it (review.publish).",
  kind: "mutation",
  input: z.object({
    project: SlugSchema.optional().describe(
      "Project it belongs to. Required unless the workspace has exactly one project",
    ),
    id: SlugSchema.optional().describe("Explicit id (defaults to a slug of the title)"),
    title: z.string().min(1),
    items: z.array(ItemInput).default([]).describe("The options, in order"),
    ...Fields,
  }),
  handler: async ({ project, items, ...input }, core) => {
    const projectId = core.resolveProject(project);
    const review = await core.reviews.create(projectId, {
      ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      title: input.title,
      items: resolveItems(core, projectId, items),
    });
    core.events.emit("review.changed", { project: projectId, id: review.id, exists: true });
    return { review: describeReview(core, review) };
  },
  format: (out) =>
    `Created review ${out.review.project}/${out.review.id}\n  app: ${out.review.urls.app}`,
});

export const reviewUpdate = defineCommand({
  name: "review.update",
  title: "Update review",
  description:
    "Update a review's title, intro, questions, presentation, device, theme or options (`items` replaces the list). Pass null to clear intro or theme. Published rounds stay as they were; publish again for a new round.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: ReviewRef,
    title: z.string().min(1).optional(),
    items: z.array(ItemInput).optional(),
    ...Fields,
    intro: Fields.intro.unwrap().nullable().optional(),
    theme: Fields.theme.unwrap().nullable().optional(),
  }),
  handler: async ({ id, items, ...patch }, core) => {
    const { scope, store, id: local } = core.reviews.locate(id);
    const review = await store.update(local, {
      ...patch,
      ...(items ? { items: resolveItems(core, scope.id, items) } : {}),
    });
    core.events.emit("review.changed", { project: scope.id, id: local, exists: true });
    return { review: describeReview(core, review) };
  },
  format: (out) => `Updated ${out.review.project}/${out.review.id}`,
});

export const reviewDelete = defineCommand({
  name: "review.delete",
  title: "Delete review",
  description:
    "Move a review to its project's trash. Rounds already published stay online until removed from the gh-pages branch.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: ReviewRef }),
  handler: async ({ id }, core) => {
    const { store, id: local } = core.reviews.locate(id);
    const result = await store.delete(local);
    core.events.emit("review.changed", { project: result.project, id: local, exists: false });
    return result;
  },
  format: (out) => `Moved ${out.id} to ${out.trashedTo}`,
});

export const reviewExport = defineCommand({
  name: "review.export",
  title: "Export review",
  description:
    "Write a review as a self-contained static site (reviewer app, review.json, frozen prototypes and design system builds) to a folder, to host anywhere.",
  kind: "mutation",
  positional: ["id", "out"],
  input: z.object({
    id: ReviewRef,
    out: z
      .string()
      .min(1)
      .describe("Folder to write (replaced). Absolute, or relative to the current directory"),
  }),
  handler: async ({ id, out }, core) => {
    const review = core.reviews.get(id);
    const dir = path.resolve(out);
    const result = await exportReview(core, refKey(review.project, review.id), dir, {
      round: (review.rounds.at(-1)?.round ?? 0) + 1,
    });
    return { dir, items: result.manifest.items.length, warnings: result.warnings };
  },
  format: (out) =>
    [`Exported ${out.items} option(s) to ${out.dir}`, ...out.warnings.map((w) => `⚠ ${w}`)].join(
      "\n",
    ),
});

export const reviewPreview = defineCommand({
  name: "review.preview",
  title: "Preview review",
  description:
    "Export a review to a local preview and return its URL (on the prototype sandbox), to see exactly what reviewers will before publishing.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: ReviewRef }),
  handler: async ({ id }, core) => {
    const review = core.reviews.get(id);
    const dir = path.join(core.workspace.cacheDir, "review-previews", review.project, review.id);
    const result = await exportReview(core, refKey(review.project, review.id), dir, {
      round: (review.rounds.at(-1)?.round ?? 0) + 1,
    });
    const sandbox = await core.sandboxUrl();
    return {
      url: `${sandbox}/review-previews/${encodeURIComponent(review.project)}/${encodeURIComponent(review.id)}/index.html`,
      warnings: result.warnings,
    };
  },
  format: (out) => [out.url, ...out.warnings.map((w) => `⚠ ${w}`)].join("\n"),
});

export const reviewPublish = defineCommand({
  name: "review.publish",
  title: "Publish review",
  description:
    "Publish a new round of a review to GitHub Pages: a frozen copy goes to the gh-pages branch of the project's repo under a hard-to-guess path, and Pages is turned on if needed. Returns the round's URL and a stable link to the latest round (GitHub takes a minute to deploy). The project must be shared first (project.git.link); published reviews are public to anyone with the link.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: ReviewRef }),
  handler: async ({ id }, core) => {
    const review = core.reviews.get(id);
    if (!review.items.length)
      throw new CoreError("INVALID_INPUT", "Add prototypes to the review before publishing it");
    const result = await publishReview(core, refKey(review.project, review.id));
    return { ...result, review: describeReview(core, result.review) };
  },
  format: (out) =>
    [
      `Published round ${out.round.round}${out.round.url ? `: ${out.round.url}` : ` to ${out.round.path} on the gh-pages branch`}`,
      out.latestUrl ? `Latest round: ${out.latestUrl}` : "",
      ...out.warnings.map((w) => `⚠ ${w}`),
    ]
      .filter(Boolean)
      .join("\n"),
});

export const reviewCommands = [
  reviewList,
  reviewGet,
  reviewCreate,
  reviewUpdate,
  reviewDelete,
  reviewExport,
  reviewPreview,
  reviewPublish,
];
