import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Core } from "./core.ts";
import { CoreError } from "./errors.ts";
import { nowIso, pathExists, slugify, walkFiles, writeJson } from "./fs-utils.ts";
import { githubRepoOf } from "./git.ts";
import { PROTOTYPE_META_FILE, normalizeRel, systemRefsIn } from "./prototypes.ts";
import { refKey } from "./refs.ts";
import {
  REVIEW_MANIFEST_FILE,
  REVIEW_MANIFEST_VERSION,
  type ReviewManifest,
  type ReviewManifestItem,
} from "./review-manifest.ts";
import type { Review, ReviewRound } from "./reviews.ts";
import { ID_PATTERN } from "./schemas.ts";
import { DIST_DIR } from "./systems/store.ts";

export const PUBLISH_BRANCH = "gh-pages";

/** Where the built reviewer app (apps/review) is found, first match wins. */
export function reviewAppCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    env.SCRATCHPAD_REVIEW_APP,
    fileURLToPath(new URL("./review", import.meta.url)),
    fileURLToPath(new URL("../../../apps/review/dist", import.meta.url)),
  ].filter((c): c is string => Boolean(c));
}

export async function findReviewApp(candidates = reviewAppCandidates()): Promise<string> {
  for (const dir of candidates) if (await pathExists(path.join(dir, "index.html"))) return dir;
  throw new CoreError(
    "INVALID_INPUT",
    "The reviewer app isn't available. Reinstall Scratchpad, run `pnpm build` in a source checkout, or set SCRATCHPAD_REVIEW_APP.",
  );
}

export interface ExportResult {
  dir: string;
  manifest: ReviewManifest;
  /** The prototypes as exported (for the round's record). */
  prototypes: { id: string; updatedAt: string }[];
  warnings: string[];
}

const itemKey = (index: number): string =>
  index < 26 ? String.fromCharCode(97 + index) : `o${index + 1}`;

/**
 * Write a review as a self-contained static site into `outDir` (emptied first): the reviewer app,
 * review.json, a frozen copy of each prototype (React ones built) and the design system builds
 * they load, laid out like the project so the prototypes' relative links keep working.
 */
export async function exportReview(
  core: Core,
  ref: string,
  outDir: string,
  options: { round: number; appDir?: string },
): Promise<ExportResult> {
  const { scope, store, id } = core.reviews.locate(ref);
  const review = store.get(id);
  if (!review.items.length)
    throw new CoreError("INVALID_INPUT", `Review ${JSON.stringify(id)} has no prototypes yet`);
  const appDir = options.appDir ?? (await findReviewApp());
  const warnings: string[] = [];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(appDir, outDir, { recursive: true });

  const items: ReviewManifestItem[] = [];
  const exported: { id: string; updatedAt: string }[] = [];
  const systems = new Set<string>();
  for (const [index, item] of review.items.entries()) {
    if (!scope.prototypes.has(item.prototype))
      throw new CoreError(
        "NOT_FOUND",
        `Review item ${JSON.stringify(item.label)} uses prototype ${JSON.stringify(item.prototype)}, which isn't in project ${scope.id}`,
      );
    const proto = scope.prototypes.get(item.prototype);
    const source = proto.framework
      ? await core.buildPrototype(refKey(scope.id, proto.id))
      : scope.prototypes.dirOf(proto.id);
    const target = path.join(outDir, "prototypes", proto.id);
    if (!(await pathExists(target)))
      await cp(source, target, {
        recursive: true,
        filter: (file) => ![PROTOTYPE_META_FILE, ".signature"].includes(path.basename(file)),
      });
    const pages = (await walkFiles(target))
      .map((f) => normalizeRel(f.path))
      .filter((f) => /\.html?$/i.test(f));
    for (const page of pages) {
      if (proto.framework) continue;
      for (const system of systemRefsIn(await readFile(path.join(target, page), "utf8")))
        systems.add(system);
    }
    const entry = normalizeRel(proto.entry);
    items.push({
      key: itemKey(index),
      label: item.label,
      ...(item.note ? { note: item.note } : {}),
      entry: `prototypes/${proto.id}/${entry}`,
      pages: pages.filter((p) => p !== entry).map((p) => `prototypes/${proto.id}/${p}`),
    });
    exported.push({ id: proto.id, updatedAt: proto.updatedAt });
  }

  for (const system of systems) {
    if (!scope.systems.has(system)) {
      warnings.push(
        `A prototype loads design system ${JSON.stringify(system)}, which isn't in project ${scope.id}`,
      );
      continue;
    }
    if (scope.systems.get(system).kind === "package") continue;
    await core.buildSystem(refKey(scope.id, system));
    await cp(
      path.join(scope.systems.dirOf(system), DIST_DIR),
      path.join(outDir, "systems", system),
      {
        recursive: true,
      },
    );
  }

  const manifest: ReviewManifest = {
    version: REVIEW_MANIFEST_VERSION,
    title: review.title,
    ...(review.intro ? { intro: review.intro } : {}),
    questions: review.questions,
    presentation: review.presentation,
    device: review.device,
    ...(review.theme ? { theme: review.theme } : {}),
    round: options.round,
    exportedAt: nowIso(),
    project: core.projects.get(scope.id).name,
    items,
  };
  await writeJson(path.join(outDir, REVIEW_MANIFEST_FILE), manifest);
  await writeFile(path.join(outDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  return { dir: outDir, manifest, prototypes: exported, warnings };
}

/** A page that sends visitors of a review's stable link to its latest round. */
function latestRedirect(title: string, round: number): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <meta http-equiv="refresh" content="0; url=round-${round}/" />
    <title>${esc(title)}</title>
  </head>
  <body>
    <p><a href="round-${round}/">${esc(title)}</a></p>
  </body>
</html>
`;
}

export interface PublishResult {
  review: Review;
  round: ReviewRound;
  /** Always points at the newest round. */
  latestUrl?: string;
  warnings: string[];
}

export interface DeletePublishedReviewResult {
  path?: string;
  removed: boolean;
}

function publishedSlugBase(review: Pick<Review, "id" | "title">): string {
  const title = slugify(review.title);
  const ordinal = /-(\d+)$/.exec(review.id)?.[1];
  return ordinal && !title.endsWith(`-${ordinal}`) ? `${title}-${ordinal}` : title;
}

/**
 * Publish a new round of a review to the `gh-pages` branch of its project's remote, under a
 * hard-to-guess path (`<slug>/round-<n>/`, plus `<slug>/` for the latest round). On GitHub, Pages
 * is turned on for the branch if needed.
 */
export async function publishReview(core: Core, ref: string): Promise<PublishResult> {
  const { scope, store, id } = core.reviews.locate(ref);
  const review = store.get(id);
  const git = core.git(scope.id);
  const status = await git.status();
  if (!status.remote)
    throw new CoreError(
      "INVALID_INPUT",
      "Publishing uses the project's git remote: share the project first (project.git.link).",
    );
  const round = (review.rounds.at(-1)?.round ?? 0) + 1;
  const slug = review.slug ?? `${publishedSlugBase(review)}-${randomBytes(4).toString("hex")}`;
  const roundPath = `${slug}/round-${round}`;
  const run = core.gitRunner;
  const tmp = await mkdtemp(path.join(os.tmpdir(), "scratchpad-publish-"));
  const site = path.join(tmp, "site");
  try {
    try {
      await run(
        "git",
        [
          "clone",
          "--quiet",
          "--depth",
          "1",
          "--branch",
          PUBLISH_BRANCH,
          "--single-branch",
          "--",
          status.remote,
          site,
        ],
        { cwd: tmp },
      );
    } catch {
      await mkdir(site);
      await run("git", ["init", "--quiet", "-b", PUBLISH_BRANCH], { cwd: site });
      await run("git", ["remote", "add", "origin", status.remote], { cwd: site });
    }
    const result = await exportReview(core, ref, path.join(site, roundPath), { round });
    await writeFile(path.join(site, slug, "index.html"), latestRedirect(review.title, round));
    await writeFile(path.join(site, ".nojekyll"), "");
    await writeFile(path.join(site, "robots.txt"), "User-agent: *\nDisallow: /\n");
    await run("git", ["add", "-A"], { cwd: site });
    await run("git", ["commit", "--quiet", "-m", `Publish “${review.title}”, round ${round}`], {
      cwd: site,
    });
    const github = githubRepoOf(status.remote);
    try {
      await run("git", ["push", "--quiet", "origin", `HEAD:${PUBLISH_BRANCH}`], { cwd: site });
    } catch (error) {
      if (!github) throw error;
      throw new CoreError(
        "CONFLICT",
        `Failed to publish the feedback round to ${github.owner}/${github.name}. Ask the repository owner to grant you permission to push the ${PUBLISH_BRANCH} branch, then try again. ${(error as Error).message}`,
      );
    }

    let base: string | undefined;
    if (github) base = await enableGithubPages(core, scope.dir, `${github.owner}/${github.name}`);
    const record: ReviewRound = {
      round,
      publishedAt: nowIso(),
      target: "github-pages",
      ...(base ? { url: `${base}${roundPath}/` } : {}),
      path: roundPath,
      prototypes: result.prototypes,
    };
    const updated = await store.update(id, { slug, rounds: [...review.rounds, record] });
    core.events.emit("review.changed", { project: scope.id, id, exists: true });
    return {
      review: updated,
      round: record,
      ...(base ? { latestUrl: `${base}${slug}/` } : {}),
      warnings: result.warnings,
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** Remove every published round and the stable link for one review from its gh-pages branch. */
export async function deletePublishedReview(
  core: Core,
  ref: string,
): Promise<DeletePublishedReviewResult> {
  const { scope, store, id } = core.reviews.locate(ref);
  const review = store.get(id);
  if (!review.slug || !review.rounds.length) return { removed: false };
  if (!ID_PATTERN.test(review.slug))
    throw new CoreError(
      "INVALID_INPUT",
      `Review ${JSON.stringify(id)} has an invalid published path. Local data was not deleted.`,
    );

  const status = await core.git(scope.id).status();
  if (!status.remote)
    throw new CoreError(
      "CONFLICT",
      `Review ${JSON.stringify(id)} has published rounds, but project ${JSON.stringify(scope.id)} no longer has a git remote. Restore its remote before deleting the review; local data was not deleted.`,
    );

  const run = core.gitRunner;
  const tmp = await mkdtemp(path.join(os.tmpdir(), "scratchpad-delete-review-"));
  const site = path.join(tmp, "site");
  const github = githubRepoOf(status.remote);
  const destination = github ? `${github.owner}/${github.name}` : status.remote;
  try {
    try {
      await run(
        "git",
        [
          "clone",
          "--quiet",
          "--depth",
          "1",
          "--branch",
          PUBLISH_BRANCH,
          "--single-branch",
          "--",
          status.remote,
          site,
        ],
        { cwd: tmp },
      );
    } catch (error) {
      throw new CoreError(
        "CONFLICT",
        `Failed to access published feedback in ${destination}. Ask the repository owner for access to the ${PUBLISH_BRANCH} branch, then try again; local data was not deleted. ${(error as Error).message}`,
      );
    }

    const target = path.join(site, review.slug);
    if (!(await pathExists(target))) return { path: review.slug, removed: false };
    await rm(target, { recursive: true, force: true });
    await run("git", ["add", "-A"], { cwd: site });
    await run("git", ["commit", "--quiet", "-m", `Delete review “${review.title}”`], {
      cwd: site,
    });
    try {
      await run("git", ["push", "--quiet", "origin", `HEAD:${PUBLISH_BRANCH}`], { cwd: site });
    } catch (error) {
      throw new CoreError(
        "CONFLICT",
        `Failed to remove the published review from ${destination}. Ask the repository owner to grant you permission to push the ${PUBLISH_BRANCH} branch, then try again; local data was not deleted. ${(error as Error).message}`,
      );
    }
    return { path: review.slug, removed: true };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** Turn on GitHub Pages for the publish branch (if it isn't on) and return the site's base URL. */
async function enableGithubPages(core: Core, cwd: string, repo: string): Promise<string> {
  const run = core.gitRunner;
  let info: string;
  try {
    info = await run("gh", ["api", `repos/${repo}/pages`], { cwd });
  } catch {
    try {
      info = await run(
        "gh",
        [
          "api",
          "-X",
          "POST",
          `repos/${repo}/pages`,
          "-f",
          `source[branch]=${PUBLISH_BRANCH}`,
          "-f",
          "source[path]=/",
        ],
        { cwd },
      );
    } catch (error) {
      throw new CoreError(
        "CONFLICT",
        `Published to the ${PUBLISH_BRANCH} branch, but couldn't turn on GitHub Pages for ${repo}. Ask the repository owner to grant you permission to configure Pages or enable Pages from the ${PUBLISH_BRANCH} branch for you. Private repositories also need a plan that supports Pages. ${(error as Error).message}`,
      );
    }
  }
  const url = (JSON.parse(info) as { html_url?: string }).html_url;
  if (!url) throw new CoreError("INTERNAL", `GitHub didn't return a Pages URL for ${repo}`);
  return url.endsWith("/") ? url : `${url}/`;
}
