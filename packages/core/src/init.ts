import path from "node:path";
import { CoreError } from "./errors.ts";
import { atomicWrite, nowIso, pathExists, slugify, writeJson } from "./fs-utils.ts";
import { PROJECT_GITIGNORE, PROJECT_META_FILE } from "./projects.ts";
import { EXAMPLE_PROTOTYPE_HTML } from "./guide.ts";
import { PROTOTYPE_META_FILE } from "./prototypes.ts";
import { ID_PATTERN, type ProjectFile, type PrototypeFile } from "./schemas.ts";
import { PROJECTS_DIR, PROTOTYPES_DIR, ensureWorkspace } from "./workspace.ts";

export interface InitWorkspaceOptions {
  /** Also create a first project with this name. */
  project?: string;
  /** Add the welcome example prototype to the new project. Default true. */
  example?: boolean;
}

export interface InitWorkspaceResult {
  root: string;
  /** Id of the project that was created, if any. */
  project?: string;
  created: string[];
}

/**
 * Create the workspace (if missing) and, optionally, a first project with an example prototype.
 * Opening a workspace creates it anyway; this is for setting one up with content.
 */
export async function initWorkspace(
  root: string,
  options: InitWorkspaceOptions = {},
): Promise<InitWorkspaceResult> {
  const ensured = await ensureWorkspace(root);
  const resolved = ensured.root;
  const created: string[] = ensured.created ? ["config.json", "AGENTS.md"] : [];
  const rel = (p: string) => path.relative(resolved, p);
  if (!options.project) return { root: resolved, created };

  const slug = slugify(options.project);
  const projectId = ID_PATTERN.test(slug) ? slug : "main";
  const projectDir = path.join(resolved, PROJECTS_DIR, projectId);
  if (await pathExists(projectDir))
    throw new CoreError(
      "CONFLICT",
      `A project with id ${JSON.stringify(projectId)} already exists`,
    );
  const now = nowIso();
  const project: ProjectFile = { name: options.project, createdAt: now, updatedAt: now };
  await atomicWrite(path.join(projectDir, ".gitignore"), PROJECT_GITIGNORE);
  await writeJson(path.join(projectDir, PROJECT_META_FILE), project);
  created.push(`${rel(projectDir)}/`);

  if (options.example ?? true) {
    const dir = path.join(projectDir, PROTOTYPES_DIR, "welcome");
    const meta: PrototypeFile = {
      title: "Welcome",
      description: "An example prototype showing the workspace conventions.",
      status: "draft",
      tags: ["example"],
      entry: "index.html",
      createdBy: { kind: "human", name: "Scratchpad" },
      sourceRefs: [],
      createdAt: now,
      updatedAt: now,
    };
    await atomicWrite(path.join(dir, "index.html"), EXAMPLE_PROTOTYPE_HTML);
    await writeJson(path.join(dir, PROTOTYPE_META_FILE), meta);
    created.push(`${rel(dir)}/`);
  }

  return { root: resolved, project: projectId, created };
}
