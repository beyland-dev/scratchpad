import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { atomicWrite, nowIso, pathExists, slugify, writeJson } from "./fs-utils.ts";
import { PROJECT_META_FILE } from "./projects.ts";
import { EXAMPLE_PROTOTYPE_HTML, renderAgentsGuide } from "./guide.ts";
import { PROTOTYPE_META_FILE } from "./prototypes.ts";
import { ID_PATTERN, type ProjectFile, type PrototypeFile } from "./schemas.ts";
import {
  CACHE_DIR,
  DESIGN_DIR,
  PROJECTS_DIR,
  PROTOTYPES_DIR,
  TRASH_DIR,
  defaultWorkspaceConfig,
  workspaceFileOf,
} from "./workspace.ts";

export interface InitWorkspaceOptions {
  name?: string;
  description?: string;
  /** Add the welcome example prototype. Default true. */
  example?: boolean;
}

export interface InitWorkspaceResult {
  root: string;
  created: string[];
}

const ROOT_AGENTS_POINTER = `# Agent instructions

This repository contains a design-tool workspace. See [.design/AGENTS.md](.design/AGENTS.md)
for how to create and iterate on design prototypes.
`;

export async function initWorkspace(
  root: string,
  options: InitWorkspaceOptions = {},
): Promise<InitWorkspaceResult> {
  const resolved = path.resolve(root);
  if (await pathExists(workspaceFileOf(resolved))) {
    throw new CoreError("CONFLICT", `A design workspace already exists at ${resolved}`);
  }
  const name = options.name ?? path.basename(resolved);
  const designDir = path.join(resolved, DESIGN_DIR);
  const created: string[] = [];
  const rel = (p: string) => path.relative(resolved, p);

  await mkdir(path.join(designDir, PROTOTYPES_DIR), { recursive: true });
  await writeJson(workspaceFileOf(resolved), defaultWorkspaceConfig(name, options.description));
  created.push(rel(workspaceFileOf(resolved)));

  await atomicWrite(path.join(designDir, ".gitignore"), `${CACHE_DIR}/\n${TRASH_DIR}/\n`);
  created.push(rel(path.join(designDir, ".gitignore")));

  await atomicWrite(path.join(designDir, "AGENTS.md"), renderAgentsGuide(name));
  created.push(rel(path.join(designDir, "AGENTS.md")));

  const rootAgents = path.join(resolved, "AGENTS.md");
  if (!(await pathExists(rootAgents))) {
    await writeFile(rootAgents, ROOT_AGENTS_POINTER, { flag: "wx" });
    created.push(rel(rootAgents));
  }

  // Start with one project named after the workspace; new prototypes and systems default to it.
  const slug = slugify(name);
  const projectId = ID_PATTERN.test(slug) ? slug : "main";
  const projectDir = path.join(designDir, PROJECTS_DIR, projectId);
  const project: ProjectFile = { name, createdAt: nowIso(), updatedAt: nowIso() };
  await writeJson(path.join(projectDir, PROJECT_META_FILE), project);
  created.push(rel(projectDir) + "/");

  if (options.example ?? true) {
    const dir = path.join(designDir, PROTOTYPES_DIR, "welcome");
    const now = nowIso();
    const meta: PrototypeFile = {
      title: "Welcome",
      description: "An example prototype showing the workspace conventions.",
      status: "draft",
      tags: ["example"],
      project: projectId,
      entry: "index.html",
      createdBy: { kind: "human", name: "design-tool" },
      sourceRefs: [],
      createdAt: now,
      updatedAt: now,
    };
    await atomicWrite(path.join(dir, "index.html"), EXAMPLE_PROTOTYPE_HTML);
    await writeJson(path.join(dir, PROTOTYPE_META_FILE), meta);
    created.push(rel(dir) + "/");
  }

  return { root: resolved, created };
}
