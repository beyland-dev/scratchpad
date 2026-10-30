import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  Core,
  initWorkspace,
  type Review,
  type ReviewManifest,
  type Runner,
} from "../src/index.ts";

let tmp: string;
let core: Core;

beforeAll(() => {
  Object.assign(process.env, {
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  });
});

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "sp-review-"));
  // A stand-in for the built reviewer app.
  const app = path.join(tmp, "app");
  await mkdir(path.join(app, "assets"), { recursive: true });
  await writeFile(path.join(app, "index.html"), "<!doctype html><title>Reviewer</title>");
  await writeFile(path.join(app, "assets", "app.js"), "console.log(1)");
  process.env.SPRUE_REVIEW_APP = app;
  await initWorkspace(path.join(tmp, "home"), { project: "Shop" });
  core = await Core.open({ root: path.join(tmp, "home") });
  await core.run("system.create", { id: "ds", name: "DS", prefix: "ds" });
  await core.run("prototype.create", {
    title: "Checkout",
    description: "Internal notes that reviewers shouldn't see",
    files: [
      {
        path: "index.html",
        content:
          '<link rel="stylesheet" href="../../systems/ds/system.css"><h1>one</h1><a href="pay.html">pay</a>',
      },
      { path: "pay.html", content: "<h1>pay</h1>" },
    ],
  });
  await core.prototypes.createVariant("checkout", { description: "Bigger button" });
});

afterEach(async () => {
  delete process.env.SPRUE_REVIEW_APP;
  await core.close();
  await rm(tmp, { recursive: true, force: true });
});

const create = () =>
  core.run<{ review: Review & { urls: { app: string } } }>("review.create", {
    title: "Checkout options",
    intro: "Two takes on checkout.",
    questions: ["Which feels faster?"],
    items: [{ prototype: "checkout" }, { prototype: "checkout-v2", note: "Bigger button" }],
  });

describe("reviews", () => {
  test("create labels options and lives in the project folder", async () => {
    const { review } = await create();
    expect(review).toMatchObject({
      id: "checkout-options",
      project: "shop",
      presentation: "both",
      device: "desktop",
      items: [
        { prototype: "checkout", label: "Option A" },
        { prototype: "checkout-v2", label: "Option B", note: "Bigger button" },
      ],
      rounds: [],
    });
    expect(review.urls.app).toBe("http://127.0.0.1:7420/projects/shop/feedback/checkout-options");
    const file = path.join(core.projects.scope("shop").dir, "reviews/checkout-options/review.json");
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ title: "Checkout options" });
    await expect(
      core.run("review.create", { title: "x", items: [{ prototype: "nope" }] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const { review: updated } = await core.run<{ review: Review }>("review.update", {
      id: "checkout-options",
      intro: null,
      presentation: "compare",
      items: [{ prototype: "checkout-v2", label: "Bold" }],
    });
    expect(updated.intro).toBeUndefined();
    expect(updated).toMatchObject({ presentation: "compare", items: [{ label: "Bold" }] });
    expect((await core.run<{ reviews: Review[] }>("review.list", {})).reviews).toHaveLength(1);
  });

  test("delete moves an unpublished review to the project trash", async () => {
    await create();
    const preview = path.join(
      core.workspace.cacheDir,
      "review-previews/shop/checkout-options/index.html",
    );
    await mkdir(path.dirname(preview), { recursive: true });
    await writeFile(preview, "cached");
    const deleted = await core.run<{
      published: { removed: boolean };
      trashedTo: string;
    }>("review.delete", { id: "checkout-options" });
    expect(deleted.published.removed).toBe(false);
    expect(deleted.trashedTo).toMatch(/^projects\/shop\/\.trash\/review-checkout-options-/);
    expect(core.projects.scope("shop").reviews.has("checkout-options")).toBe(false);
    await expect(readFile(preview, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("export writes a self-contained site without internal metadata", async () => {
    await create();
    const out = path.join(tmp, "out");
    const result = await core.run<{ warnings: string[] }>("review.export", {
      id: "checkout-options",
      out,
    });
    expect(result.warnings).toEqual([]);
    const manifest = JSON.parse(
      await readFile(path.join(out, "review.json"), "utf8"),
    ) as ReviewManifest;
    expect(manifest).toMatchObject({
      version: 1,
      title: "Checkout options",
      project: "Shop",
      round: 1,
      questions: ["Which feels faster?"],
      items: [
        {
          key: "a",
          label: "Option A",
          entry: "prototypes/checkout/index.html",
          pages: ["prototypes/checkout/pay.html"],
        },
        { key: "b", label: "Option B", note: "Bigger button" },
      ],
    });
    const json = JSON.stringify(manifest);
    expect(json).not.toContain("Internal notes");
    expect(await readFile(path.join(out, "index.html"), "utf8")).toContain("Reviewer");
    expect(await readdir(path.join(out, "prototypes/checkout"))).toEqual([
      "index.html",
      "pay.html",
    ]);
    // The design system build is where the prototype's relative link expects it.
    expect(await readFile(path.join(out, "systems/ds/system.css"), "utf8")).toContain("DS");
    expect(await readFile(path.join(out, "robots.txt"), "utf8")).toContain("Disallow: /");

    // Exports are frozen copies: later edits don't change them.
    await core.run("prototype.writeFile", { id: "checkout", path: "index.html", content: "v2" });
    expect(await readFile(path.join(out, "prototypes/checkout/index.html"), "utf8")).toContain(
      "<h1>one</h1>",
    );
  });

  test("preview exports into the cache and returns a sandbox URL", async () => {
    await create();
    const { url } = await core.run<{ url: string }>("review.preview", { id: "checkout-options" });
    expect(url).toBe("http://127.0.0.1:7421/review-previews/shop/checkout-options/index.html");
    expect(
      await readFile(
        path.join(core.workspace.cacheDir, "review-previews/shop/checkout-options/review.json"),
        "utf8",
      ),
    ).toContain("Checkout options");
  });

  test("publish needs a shared project, then pushes rounds to gh-pages", async () => {
    await create();
    await core.run("review.create", {
      title: "Checkout options",
      items: [{ prototype: "checkout" }],
    });
    await core.run("review.update", {
      id: "checkout-options-2",
      title: "Inbox One",
    });
    await expect(core.run("review.publish", { id: "checkout-options" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: expect.stringContaining("project.git.link"),
    });
    const remote = path.join(tmp, "remote.git");
    execFileSync("git", ["init", "--bare", "-q", "-b", "main", remote]);
    await core.run("project.git.link", { remote });

    const first = await core.run<{ round: { round: number; path: string }; review: Review }>(
      "review.publish",
      { id: "checkout-options-2" },
    );
    expect(first.round.round).toBe(1);
    expect(first.round.path).toMatch(/^inbox-one-2-[0-9a-f]{8}\/round-1$/);
    const slug = first.review.slug!;
    await core.run("prototype.writeFile", {
      id: "checkout",
      path: "index.html",
      content: "<h1>two</h1>",
    });
    const second = await core.run<{ round: { round: number; path: string } }>("review.publish", {
      id: "checkout-options-2",
    });
    expect(second.round.path).toBe(`${slug}/round-2`);

    const show = (file: string) =>
      execFileSync("git", [`--git-dir=${remote}`, "show", `gh-pages:${file}`], {
        encoding: "utf8",
      });
    expect(show(`${slug}/round-1/prototypes/checkout/index.html`)).toContain("<h1>one</h1>");
    expect(show(`${slug}/round-2/prototypes/checkout/index.html`)).toBe("<h1>two</h1>");
    expect(show(`${slug}/index.html`)).toContain('url=round-2/"');
    expect(show(".nojekyll")).toBe("");
    // The project's own branch is untouched.
    expect(
      execFileSync("git", [`--git-dir=${remote}`, "ls-tree", "--name-only", "main"], {
        encoding: "utf8",
      }),
    ).not.toContain(slug);
    expect(core.reviews.get("checkout-options-2").rounds.map((r) => r.round)).toEqual([1, 2]);

    const deleted = await core.run<{ published: { path?: string; removed: boolean } }>(
      "review.delete",
      { id: "checkout-options-2" },
    );
    expect(deleted.published).toEqual({ path: slug, removed: true });
    expect(core.projects.scope("shop").reviews.has("checkout-options-2")).toBe(false);
    expect(
      execFileSync("git", [`--git-dir=${remote}`, "ls-tree", "--name-only", "gh-pages", slug], {
        encoding: "utf8",
      }),
    ).toBe("");
  });

  test("delete keeps local data when published review cleanup cannot push", async () => {
    await create();
    const remote = path.join(tmp, "remote.git");
    execFileSync("git", ["init", "--bare", "-q", "-b", "main", remote]);
    await core.run("project.git.link", { remote });
    const published = await core.run<{ review: Review }>("review.publish", {
      id: "checkout-options",
    });
    const slug = published.review.slug!;

    const real = core.gitRunner;
    core.gitRunner = async (command, args, options) => {
      if (command === "git" && args[0] === "push" && args.includes("HEAD:gh-pages"))
        throw new Error("remote: Permission denied");
      const swapped = args.map((arg) => (arg === "git@github.com:owner/shop.git" ? remote : arg));
      return real(command, swapped, options);
    };
    execFileSync("git", ["remote", "set-url", "origin", "git@github.com:owner/shop.git"], {
      cwd: core.projects.scope("shop").dir,
    });

    await expect(core.run("review.delete", { id: "checkout-options" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(
        /Failed to remove.*repository owner.*local data was not deleted/s,
      ),
    });
    expect(core.projects.scope("shop").reviews.has("checkout-options")).toBe(true);
    expect(
      execFileSync("git", [`--git-dir=${remote}`, "show", `gh-pages:${slug}/index.html`], {
        encoding: "utf8",
      }),
    ).toContain("round-1");
  });

  test("on GitHub, publishing turns on Pages and returns the URLs", async () => {
    await create();
    const remote = path.join(tmp, "remote.git");
    execFileSync("git", ["init", "--bare", "-q", "-b", "main", remote]);
    await core.run("project.git.link", { remote });
    // Pretend origin is on GitHub, but keep pushing to the local bare repo.
    const real = core.gitRunner;
    const gh: string[][] = [];
    const fake: Runner = async (command, args, options) => {
      if (command === "gh") {
        gh.push(args);
        if (args.includes("POST"))
          return JSON.stringify({ html_url: "https://beyland-dev.github.io/shop/" });
        throw new Error("404");
      }
      const swapped = args.map((a) => (a === "git@github.com:beyland-dev/shop.git" ? remote : a));
      return real(command, swapped, options);
    };
    core.gitRunner = fake;
    execFileSync("git", ["remote", "set-url", "origin", "git@github.com:beyland-dev/shop.git"], {
      cwd: core.projects.scope("shop").dir,
    });
    const out = await core.run<{ round: { url?: string }; latestUrl?: string; review: Review }>(
      "review.publish",
      { id: "checkout-options" },
    );
    const slug = out.review.slug!;
    expect(out.round.url).toBe(`https://beyland-dev.github.io/shop/${slug}/round-1/`);
    expect(out.latestUrl).toBe(`https://beyland-dev.github.io/shop/${slug}/`);
    expect(gh.at(-1)).toEqual(
      expect.arrayContaining([
        "-X",
        "POST",
        "repos/beyland-dev/shop/pages",
        "source[branch]=gh-pages",
      ]),
    );
  });

  test("GitHub publish explains missing branch permissions", async () => {
    await create();
    const remote = path.join(tmp, "remote.git");
    execFileSync("git", ["init", "--bare", "-q", "-b", "main", remote]);
    await core.run("project.git.link", { remote });
    const real = core.gitRunner;
    core.gitRunner = async (command, args, options) => {
      if (command === "git" && args[0] === "push" && args.includes("HEAD:gh-pages"))
        throw new Error("remote: Permission denied");
      const swapped = args.map((arg) => (arg === "git@github.com:owner/shop.git" ? remote : arg));
      return real(command, swapped, options);
    };
    execFileSync("git", ["remote", "set-url", "origin", "git@github.com:owner/shop.git"], {
      cwd: core.projects.scope("shop").dir,
    });

    await expect(core.run("review.publish", { id: "checkout-options" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/Failed to publish.*owner\/shop.*repository owner.*gh-pages/s),
    });
  });
});
