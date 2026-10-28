import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  Core,
  initWorkspace,
  summarizeChanges,
  type GitStatus,
  type Runner,
} from "../src/index.ts";

let tmp: string;
let remote: string;
let core: Core;

beforeAll(() => {
  // A fixed identity, so commits work without the machine's git config.
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
  tmp = await mkdtemp(path.join(tmpdir(), "sp-git-"));
  remote = path.join(tmp, "remote.git");
  execFileSync("git", ["init", "--bare", "-b", "main", remote]);
  await initWorkspace(path.join(tmp, "a"), { project: "Shop" });
  core = await Core.open({ root: path.join(tmp, "a") });
});

afterEach(async () => {
  await core.close();
  await rm(tmp, { recursive: true, force: true });
});

describe("project git", () => {
  test("a project that isn't a repo reports so", async () => {
    const status = await core.run<GitStatus>("project.git.status", { project: "shop" });
    expect(status).toMatchObject({ repo: false, changes: [] });
    await expect(core.run("project.git.commit", { project: "shop" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  test("link, commit, push; a collaborator clones, edits and syncs back", async () => {
    const linked = await core.run<GitStatus>("project.git.link", { remote });
    expect(linked).toMatchObject({ repo: true, branch: "main", remote, ahead: 0, changes: [] });
    expect(linked.lastCommit?.subject).toBe("Start Shop");
    // Generated and local-only files stay out of the repo.
    const tracked = execFileSync(
      "git",
      [`--git-dir=${remote}`, "ls-tree", "-r", "--name-only", "main"],
      { encoding: "utf8" },
    );
    expect(tracked.split("\n")).toEqual(
      expect.arrayContaining([".gitignore", "project.json", "prototypes/welcome/index.html"]),
    );

    // Edits are summarized into a commit message.
    await core.run("prototype.create", { title: "Checkout" });
    await core.run("prototype.update", { id: "welcome", status: "review" });
    const commit = await core.run<GitStatus & { committed: boolean }>("project.git.commit", {});
    expect(commit.committed).toBe(true);
    expect(commit.lastCommit?.subject).toBe("Update prototypes checkout, welcome");
    expect(commit.ahead).toBe(1);
    expect((await core.run<GitStatus>("project.git.push", {})).ahead).toBe(0);

    // A collaborator clones the project into their own workspace.
    const other = await Core.open({ root: path.join(tmp, "b") });
    try {
      const cloned = await other.run<{ project: { id: string; name: string } }>("project.clone", {
        url: remote,
      });
      expect(cloned.project).toMatchObject({ id: "remote", name: "Shop" });
      expect(other.prototypes.get("remote/checkout").title).toBe("Checkout");
      await other.run("prototype.update", { id: "checkout", status: "approved" });
      await other.run("project.git.sync", { message: "Approve checkout" });

      // The first workspace pulls it, along with its own uncommitted edit.
      await core.run("prototype.writeFile", { id: "welcome", path: "notes.md", content: "hi" });
      const pulled = await core.run<GitStatus>("project.git.pull", {});
      expect(pulled.behind).toBe(0);
      expect(core.prototypes.get("checkout").status).toBe("approved");
      expect(pulled.changes.map((c) => c.path)).toEqual(
        expect.arrayContaining(["prototypes/welcome/notes.md"]),
      );
    } finally {
      await other.close();
    }
  });

  test("a conflicting pull changes nothing and names the files", async () => {
    await core.run("project.git.link", { remote });
    const other = await Core.open({ root: path.join(tmp, "b") });
    try {
      await other.run("project.clone", { url: remote, id: "shop" });
      await other.run("prototype.writeFile", {
        id: "welcome",
        path: "index.html",
        content: "theirs",
      });
      await other.run("project.git.sync", {});
    } finally {
      await other.close();
    }
    await core.run("prototype.writeFile", { id: "welcome", path: "index.html", content: "mine" });
    await core.run("project.git.commit", { message: "Mine" });
    await expect(core.run("project.git.pull", {})).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("prototypes/welcome/index.html"),
    });
    const after = await core.run<GitStatus>("project.git.status", {});
    expect(after).toMatchObject({ ahead: 1, conflicts: [] });
    expect(
      await readFile(
        path.join(core.projects.scope("shop").dir, "prototypes/welcome/index.html"),
        "utf8",
      ),
    ).toBe("mine");
  });

  test("linking refuses a remote that already has history", async () => {
    const seeded = path.join(tmp, "seed");
    execFileSync("git", ["clone", remote, seeded]);
    await writeFile(path.join(seeded, "README.md"), "x");
    execFileSync("git", ["add", "-A"], { cwd: seeded });
    execFileSync("git", ["commit", "-m", "seed"], { cwd: seeded });
    execFileSync("git", ["push", "origin", "HEAD:main"], { cwd: seeded });
    await expect(core.run("project.git.link", { remote })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("project.clone"),
    });
    await expect(core.run("project.git.link", { remote: "not a url" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  test("creating a GitHub repo goes through the gh CLI", async () => {
    const calls: string[][] = [];
    const real = core.gitRunner;
    const fake: Runner = async (command, args, options) => {
      if (command !== "gh") return real(command, args, options);
      calls.push(args);
      await real("git", ["remote", "add", "origin", remote], options);
      await real("git", ["push", "-u", "origin", "HEAD"], options);
      return "";
    };
    core.gitRunner = fake;
    const status = await core.run<GitStatus>("project.git.link", {
      github: { owner: "beyland-dev", private: true },
    });
    expect(calls[0]).toEqual(
      expect.arrayContaining(["repo", "create", "beyland-dev/shop", "--private", "--push"]),
    );
    expect(status.remote).toBe(remote);
    await expect(
      core.run("project.git.link", { github: { name: "bad name!" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("commit messages summarize what changed", () => {
    expect(
      summarizeChanges([
        { path: "prototypes/a/index.html", status: " M" },
        { path: "prototypes/a/b.css", status: "??" },
        { path: "systems/ds/tokens.json", status: " M" },
        { path: "project.json", status: " M" },
      ]),
    ).toBe("Update prototypes a; systems ds; 1 other file");
    expect(summarizeChanges([])).toBe("Update project");
  });
});
