import { execFile } from "node:child_process";
import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { pathExists } from "./fs-utils.ts";

/** Runs a program (never through a shell) and returns its stdout. */
export type Runner = (
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) => Promise<string>;

export const execRunner: Runner = (command, args, { cwd, env }) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
        maxBuffer: 32 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout);
        const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        reject(
          new CoreError(
            missing ? "INVALID_INPUT" : "CONFLICT",
            missing
              ? `${command} isn't installed (or isn't on PATH)`
              : `${command} ${args[0] ?? ""} failed: ${(stderr || stdout || error.message).trim()}`,
          ),
        );
      },
    );
  });

export interface GitChange {
  path: string;
  /** Two-letter porcelain status, e.g. " M", "??", "UU". */
  status: string;
}

export interface GitStatus {
  /** Whether the project folder is a git repo of its own. */
  repo: boolean;
  branch?: string;
  /** `origin`'s URL. */
  remote?: string;
  /** Web page of the remote, when it's on GitHub. */
  webUrl?: string;
  /** The tracked upstream branch, e.g. "origin/main". */
  upstream?: string;
  /** Local commits not on the upstream yet. */
  ahead: number;
  /** Upstream commits not pulled yet. */
  behind: number;
  /** Uncommitted changes (including untracked files). */
  changes: GitChange[];
  conflicts: string[];
  lastCommit?: { hash: string; subject: string; author: string; date: string };
}

const REMOTE_PATTERN = /^(https:\/\/|ssh:\/\/|git@|file:\/\/|\/)/;
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/** `owner/repo` of a GitHub remote, if it is one. */
export function githubRepoOf(
  remote: string | undefined,
): { owner: string; name: string } | undefined {
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(remote ?? "");
  return match ? { owner: match[1]!, name: match[2]! } : undefined;
}

export function assertRemote(url: string): void {
  if (!REMOTE_PATTERN.test(url))
    throw new CoreError(
      "INVALID_INPUT",
      `Not a git remote: ${JSON.stringify(url)} (use https://, ssh://, git@host:owner/repo or a path)`,
    );
}

/** Git operations on one project folder. */
export class ProjectGit {
  readonly dir: string;
  readonly #run: Runner;

  constructor(dir: string, runner: Runner = execRunner) {
    this.dir = dir;
    this.#run = runner;
  }

  git(...args: string[]): Promise<string> {
    return this.#run("git", args, { cwd: this.dir });
  }

  /** The folder is the top of its own repo (not just inside a parent repo). */
  async isRepo(): Promise<boolean> {
    return pathExists(path.join(this.dir, ".git"));
  }

  async status(): Promise<GitStatus> {
    if (!(await this.isRepo()))
      return { repo: false, ahead: 0, behind: 0, changes: [], conflicts: [] };
    const porcelain = await this.git("status", "--porcelain=v2", "--branch", "-z");
    const status: GitStatus = { repo: true, ahead: 0, behind: 0, changes: [], conflicts: [] };
    const records = porcelain.split("\0");
    for (let i = 0; i < records.length; i++) {
      const line = records[i]!;
      if (line.startsWith("# branch.head ")) {
        const head = line.slice("# branch.head ".length);
        if (head !== "(detached)") status.branch = head;
      } else if (line.startsWith("# branch.upstream ")) {
        status.upstream = line.slice("# branch.upstream ".length);
      } else if (line.startsWith("# branch.ab ")) {
        const [ahead, behind] = line.slice("# branch.ab ".length).split(" ");
        status.ahead = Math.abs(Number(ahead));
        status.behind = Math.abs(Number(behind));
      } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
        const parts = line.split(" ");
        const file = parts.slice(line.startsWith("1 ") ? 8 : 9).join(" ");
        status.changes.push({ path: file, status: parts[1]!.replaceAll(".", " ") });
        // Renames carry the original path as the next record.
        if (line.startsWith("2 ")) i++;
      } else if (line.startsWith("u ")) {
        const file = line.split(" ").slice(10).join(" ");
        status.conflicts.push(file);
        status.changes.push({ path: file, status: "UU" });
      } else if (line.startsWith("? ")) {
        status.changes.push({ path: line.slice(2), status: "??" });
      }
    }
    status.remote =
      (await this.git("remote", "get-url", "origin").catch(() => "")).trim() || undefined;
    const github = githubRepoOf(status.remote);
    if (github) status.webUrl = `https://github.com/${github.owner}/${github.name}`;
    const log = await this.git("log", "-1", "--format=%H%x00%s%x00%an%x00%aI").catch(() => "");
    if (log.trim()) {
      const [hash, subject, author, date] = log.trim().split("\0");
      status.lastCommit = { hash: hash!, subject: subject!, author: author!, date: date! };
    }
    return status;
  }

  /** Fetch from `origin`, quietly; best-effort (offline is fine). */
  async fetch(): Promise<void> {
    if (!(await this.isRepo())) return;
    if (!(await this.git("remote").catch(() => "")).split("\n").includes("origin")) return;
    await this.git("fetch", "--quiet", "origin").catch(() => "");
  }

  /** Make the folder a repo with a first commit (no-op if it already is one). */
  async init(message: string): Promise<void> {
    if (await this.isRepo()) return;
    await this.git("init", "-b", "main");
    await this.git("add", "-A");
    await this.git("commit", "-m", message);
  }

  /** Point `origin` at `url` and push the current branch to it (the remote must be empty). */
  async linkRemote(url: string): Promise<void> {
    assertRemote(url);
    const existing = (await this.git("remote", "get-url", "origin").catch(() => "")).trim();
    if (existing && existing !== url)
      throw new CoreError("CONFLICT", `This project is already linked to ${existing}`);
    if (!existing) await this.git("remote", "add", "origin", url);
    const heads = await this.git("ls-remote", "--heads", "origin");
    if (heads.trim())
      throw new CoreError(
        "CONFLICT",
        `${url} already has commits. Clone it as a project instead (project.clone), or link an empty repo.`,
      );
    await this.push();
  }

  /** Create a GitHub repo for the project with the `gh` CLI, and push to it. */
  async createGithubRepo(options: {
    name: string;
    owner?: string;
    private: boolean;
    description?: string;
  }): Promise<string> {
    for (const part of [options.name, options.owner].filter(Boolean) as string[])
      if (!NAME_PATTERN.test(part))
        throw new CoreError("INVALID_INPUT", `Invalid GitHub name ${JSON.stringify(part)}`);
    if ((await this.git("remote").catch(() => "")).split("\n").includes("origin"))
      throw new CoreError("CONFLICT", "This project is already linked to a remote");
    const full = options.owner ? `${options.owner}/${options.name}` : options.name;
    await this.#run(
      "gh",
      [
        "repo",
        "create",
        full,
        options.private ? "--private" : "--public",
        "--source",
        this.dir,
        "--remote",
        "origin",
        "--push",
        ...(options.description ? ["--description", options.description] : []),
      ],
      { cwd: this.dir },
    );
    return (await this.git("remote", "get-url", "origin")).trim();
  }

  /** Stage everything and commit. Returns false when there was nothing to commit. */
  async commit(message: string): Promise<boolean> {
    await this.git("add", "-A");
    if (!(await this.git("status", "--porcelain")).trim()) return false;
    await this.git("commit", "-m", message);
    return true;
  }

  /**
   * Fetch and rebase local commits onto the upstream (uncommitted changes are stashed around it).
   * On a conflict the rebase is aborted, so the folder is left as it was.
   */
  async pull(): Promise<void> {
    const status = await this.status();
    if (!status.remote)
      throw new CoreError("INVALID_INPUT", "This project isn't linked to a remote");
    await this.git("fetch", "origin");
    if (!status.upstream) {
      const branch = status.branch ?? "main";
      const remoteHeads = await this.git("ls-remote", "--heads", "origin", branch);
      if (!remoteHeads.trim()) return;
      await this.git("branch", "--set-upstream-to", `origin/${branch}`);
    }
    try {
      await this.git("pull", "--rebase", "--autostash");
    } catch (error) {
      const conflicts = (await this.status().catch(() => undefined))?.conflicts ?? [];
      await this.git("rebase", "--abort").catch(() => "");
      throw new CoreError(
        "CONFLICT",
        conflicts.length
          ? `Pulling conflicts with local changes in ${conflicts.join(", ")}. Nothing was changed; resolve it in a terminal (git pull --rebase) or ask an agent to.`
          : (error as Error).message,
      );
    }
  }

  async push(): Promise<void> {
    const status = await this.status();
    if (!status.remote)
      throw new CoreError("INVALID_INPUT", "This project isn't linked to a remote");
    await this.git("push", "-u", "origin", "HEAD");
  }
}

/**
 * Clone `url` into `target` (which must not exist), via a temporary folder next to it so a failed
 * clone never leaves a half-made project behind.
 */
export async function cloneInto(
  url: string,
  target: string,
  runner: Runner = execRunner,
): Promise<void> {
  assertRemote(url);
  if (await pathExists(target))
    throw new CoreError("CONFLICT", `${path.basename(target)} already exists`);
  const staging = await mkdtemp(
    path.join(path.dirname(target), `.clone-${path.basename(target)}-`),
  );
  try {
    await runner("git", ["clone", "--", url, staging], { cwd: os.tmpdir() });
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

/** Whether a folder has anything in it besides `.git`. */
export async function hasContent(dir: string): Promise<boolean> {
  return (await readdir(dir)).some((name) => name !== ".git");
}
