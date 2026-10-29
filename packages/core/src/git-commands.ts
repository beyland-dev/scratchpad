import path from "node:path";
import { z } from "zod";
import type { Core } from "./core.ts";
import { CoreError } from "./errors.ts";
import { atomicWrite, nowIso, pathExists, slugify, writeJson } from "./fs-utils.ts";
import { cloneInto, githubRepoOf, type GitChange, type GitStatus } from "./git.ts";
import { PROJECT_GITIGNORE, PROJECT_META_FILE } from "./projects.ts";
import { defineCommand } from "./registry.ts";
import { ID_PATTERN, SlugSchema, type ProjectFile } from "./schemas.ts";

const ProjectInput = SlugSchema.optional().describe(
  "Project id. Required unless the workspace has exactly one project",
);

/** "Syncing prototype, design system, and review changes." from the changed paths. */
export function summarizeChanges(changes: GitChange[]): string {
  const changed = new Set<"prototype" | "design system" | "review" | "project">();
  for (const change of changes) {
    const section = change.path.split("/")[0];
    if (section === "prototypes") changed.add("prototype");
    else if (section === "systems") changed.add("design system");
    else if (section === "reviews") changed.add("review");
    else changed.add("project");
  }
  const categories = ["prototype", "design system", "review", "project"].filter((category) =>
    changed.has(category as "prototype" | "design system" | "review" | "project"),
  );
  if (!categories.length) return "Syncing project changes.";
  const summary =
    categories.length === 1
      ? categories[0]
      : categories.length === 2
        ? categories.join(" and ")
        : `${categories.slice(0, -1).join(", ")}, and ${categories.at(-1)}`;
  return `Syncing ${summary} changes.`;
}

function describeStatus(status: GitStatus): string {
  if (!status.repo) return "Not a git repo yet (link it with project.git.link)";
  return [
    `${status.branch ?? "(detached)"}${status.upstream ? ` → ${status.upstream}` : ""}${status.remote ? `  (${status.remote})` : "  (no remote)"}`,
    `${status.changes.length} uncommitted change(s), ${status.ahead} to push, ${status.behind} to pull`,
    ...status.conflicts.map((c) => `conflict: ${c}`),
  ].join("\n");
}

async function statusOf(core: Core, project: string): Promise<GitStatus & { project: string }> {
  return { project, ...(await core.git(project).status()) };
}

export const gitStatus = defineCommand({
  name: "project.git.status",
  title: "Project git status",
  description:
    "Git status of a project folder: whether it's a repo, its branch and remote, uncommitted changes, and commits to push or pull.",
  kind: "query",
  positional: ["project"],
  input: z.object({
    project: ProjectInput,
    fetch: z
      .boolean()
      .default(false)
      .describe("Fetch from the remote first, so `behind` is current (needs network)"),
  }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    if (input.fetch) await core.git(id).fetch();
    return statusOf(core, id);
  },
  format: describeStatus,
});

export const gitLink = defineCommand({
  name: "project.git.link",
  title: "Link project to a git repo",
  description:
    "Make a project folder a git repo (with a first commit) and link it to a remote: either create a new GitHub repo (`github`, uses the gh CLI) or an existing, empty `remote` URL. Collaborators can then clone it with project.clone.",
  kind: "mutation",
  positional: ["project"],
  input: z.object({
    project: ProjectInput,
    remote: z.string().optional().describe("URL of an existing, empty repo"),
    github: z
      .object({
        name: z.string().optional().describe("Repo name (defaults to the project id)"),
        owner: z.string().optional().describe("User or organization (defaults to you)"),
        private: z.boolean().default(true),
        description: z.string().optional(),
      })
      .optional()
      .describe("Create a new GitHub repo for the project"),
  }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    if (input.remote && input.github)
      throw new CoreError("INVALID_INPUT", "Pass either remote or github, not both");
    const scope = core.projects.scope(id);
    const git = core.git(id);
    const gitignore = path.join(scope.dir, ".gitignore");
    if (!(await pathExists(gitignore))) await atomicWrite(gitignore, PROJECT_GITIGNORE);
    await git.init(`Start ${core.projects.get(id).name}`);
    if (input.github) {
      const project = core.projects.get(id);
      await git.createGithubRepo({
        name: input.github.name ?? id,
        private: input.github.private,
        ...(input.github.owner ? { owner: input.github.owner } : {}),
        ...((input.github.description ?? project.description)
          ? { description: input.github.description ?? project.description }
          : {}),
      });
    } else if (input.remote) {
      await git.linkRemote(input.remote);
    }
    core.events.emit("project.changed", { id, exists: true });
    return statusOf(core, id);
  },
  format: describeStatus,
});

export const projectClone = defineCommand({
  name: "project.clone",
  title: "Clone a project",
  description:
    "Add a project by cloning its git repo (e.g. one a collaborator linked with project.git.link) into the workspace's projects folder.",
  kind: "mutation",
  positional: ["url"],
  input: z.object({
    url: z.string().min(1).describe("Repo URL, e.g. git@github.com:owner/repo.git"),
    id: SlugSchema.optional().describe("Project id (defaults to the repo name)"),
  }),
  handler: async (input, core) => {
    const repoName =
      githubRepoOf(input.url)?.name ??
      input.url
        .replace(/\.git\/?$/, "")
        .split(/[\\/:]/)
        .filter(Boolean)
        .pop() ??
      "project";
    const slug = slugify(repoName);
    const id = input.id ?? (ID_PATTERN.test(slug) ? slug : "project");
    if (core.projects.has(id))
      throw new CoreError("CONFLICT", `A project with id ${JSON.stringify(id)} already exists`);
    const dir = path.join(core.workspace.projectsDir, id);
    await cloneInto(input.url, dir, core.gitRunner);
    // A repo that isn't a scratchpad project yet becomes one (left uncommitted for review).
    if (!(await pathExists(path.join(dir, PROJECT_META_FILE)))) {
      const meta: ProjectFile = {
        name: repoName.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await writeJson(path.join(dir, PROJECT_META_FILE), meta);
    }
    if (!(await pathExists(path.join(dir, ".gitignore"))))
      await atomicWrite(path.join(dir, ".gitignore"), PROJECT_GITIGNORE);
    await core.reloadProject(id);
    return { project: core.projects.get(id), git: await statusOf(core, id) };
  },
  format: (out) => `Cloned ${out.project.id} (${out.project.name})\n${describeStatus(out.git)}`,
});

export const gitCommit = defineCommand({
  name: "project.git.commit",
  title: "Commit project changes",
  description:
    "Commit every change in a project folder. Without a message, one is written from the kinds of content that changed (e.g. 'Syncing prototype and review changes.').",
  kind: "mutation",
  positional: ["project"],
  input: z.object({ project: ProjectInput, message: z.string().min(1).optional() }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    const git = core.git(id);
    const before = await git.status();
    if (!before.repo)
      throw new CoreError("INVALID_INPUT", "This project isn't a git repo yet (project.git.link)");
    const committed = await git.commit(input.message ?? summarizeChanges(before.changes));
    return { committed, ...(await statusOf(core, id)) };
  },
  format: (out) => (out.committed ? `Committed: ${out.lastCommit?.subject}` : "Nothing to commit"),
});

export const gitPull = defineCommand({
  name: "project.git.pull",
  title: "Pull project changes",
  description:
    "Pull collaborators' commits into a project (rebasing local commits on top; uncommitted changes are kept). On a conflict nothing is changed and the conflicting files are reported.",
  kind: "mutation",
  positional: ["project"],
  input: z.object({ project: ProjectInput }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    await core.git(id).pull();
    await core.reloadProject(id);
    return statusOf(core, id);
  },
  format: describeStatus,
});

export const gitPush = defineCommand({
  name: "project.git.push",
  title: "Push project commits",
  description: "Push a project's commits to its remote.",
  kind: "mutation",
  positional: ["project"],
  input: z.object({ project: ProjectInput }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    await core.git(id).push();
    return statusOf(core, id);
  },
  format: describeStatus,
});

export const gitSync = defineCommand({
  name: "project.git.sync",
  title: "Sync project",
  description:
    "Commit a project's changes (with `message`, or one written from what changed), pull collaborators' commits, and push: the usual way to share work.",
  kind: "mutation",
  positional: ["project"],
  input: z.object({ project: ProjectInput, message: z.string().min(1).optional() }),
  handler: async (input, core) => {
    const id = core.resolveProject(input.project);
    const git = core.git(id);
    const before = await git.status();
    if (!before.remote)
      throw new CoreError(
        "INVALID_INPUT",
        "This project isn't linked to a remote (project.git.link)",
      );
    const committed = await git.commit(input.message ?? summarizeChanges(before.changes));
    await git.pull();
    await git.push();
    await core.reloadProject(id);
    return { committed, ...(await statusOf(core, id)) };
  },
  format: (out) =>
    `Synced${out.committed ? ` (committed: ${out.lastCommit?.subject})` : ""}\n${describeStatus(out)}`,
});

export const gitCommands = [gitStatus, gitLink, projectClone, gitCommit, gitPull, gitPush, gitSync];
