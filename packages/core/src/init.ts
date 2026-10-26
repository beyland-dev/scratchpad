import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { atomicWrite, nowIso, pathExists, writeJson } from "./fs-utils.ts";
import { EXAMPLE_PROTOTYPE_HTML, renderAgentsGuide } from "./guide.ts";
import { PROTOTYPE_META_FILE } from "./prototypes.ts";
import type { PrototypeFile } from "./schemas.ts";
import {
  CACHE_DIR,
  DESIGN_DIR,
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

  if (options.example ?? true) {
    const dir = path.join(designDir, PROTOTYPES_DIR, "welcome");
    const now = nowIso();
    const meta: PrototypeFile = {
      title: "Welcome",
      description: "An example prototype showing the workspace conventions.",
      status: "draft",
      tags: ["example"],
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
