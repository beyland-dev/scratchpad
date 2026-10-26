import { readFile } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { pathExists, writeJson } from "./fs-utils.ts";
import {
  WORKSPACE_FORMAT_VERSION,
  WorkspaceConfigSchema,
  type Source,
  type WorkspaceConfig,
} from "./schemas.ts";

export const DESIGN_DIR = ".design";
export const WORKSPACE_FILE = "workspace.json";
export const PROTOTYPES_DIR = "prototypes";
export const TRASH_DIR = ".trash";
export const CACHE_DIR = ".cache";

export function designDirOf(root: string): string {
  return path.join(root, DESIGN_DIR);
}

export function workspaceFileOf(root: string): string {
  return path.join(root, DESIGN_DIR, WORKSPACE_FILE);
}

/** Walk up from `start` looking for a folder containing `.design/workspace.json`. */
export async function findWorkspaceRoot(start: string): Promise<string | undefined> {
  let current = path.resolve(start);
  while (true) {
    if (await pathExists(workspaceFileOf(current))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function readWorkspaceConfig(root: string): Promise<WorkspaceConfig> {
  const file = workspaceFileOf(root);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new CoreError(
      "NO_WORKSPACE",
      `No design workspace found at ${root} (missing ${DESIGN_DIR}/${WORKSPACE_FILE}). Run \`dt init\` first.`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new CoreError("INVALID_INPUT", `${file} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = WorkspaceConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new CoreError(
      "INVALID_INPUT",
      `${file} is invalid: ${parsed.error.message}`,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export class Workspace {
  readonly root: string;
  readonly designDir: string;
  readonly prototypesDir: string;
  readonly trashDir: string;
  readonly cacheDir: string;
  #config: WorkspaceConfig;

  private constructor(root: string, config: WorkspaceConfig) {
    this.root = root;
    this.designDir = designDirOf(root);
    this.prototypesDir = path.join(this.designDir, PROTOTYPES_DIR);
    this.trashDir = path.join(this.designDir, TRASH_DIR);
    this.cacheDir = path.join(this.designDir, CACHE_DIR);
    this.#config = config;
  }

  static async open(root: string): Promise<Workspace> {
    const resolved = path.resolve(root);
    return new Workspace(resolved, await readWorkspaceConfig(resolved));
  }

  get config(): WorkspaceConfig {
    return this.#config;
  }

  async reload(): Promise<WorkspaceConfig> {
    this.#config = await readWorkspaceConfig(this.root);
    return this.#config;
  }

  async update(mutate: (config: WorkspaceConfig) => WorkspaceConfig): Promise<WorkspaceConfig> {
    const next = WorkspaceConfigSchema.parse(mutate(structuredClone(this.#config)));
    await writeJson(workspaceFileOf(this.root), next);
    this.#config = next;
    return next;
  }

  getSource(id: string): Source {
    const source = this.#config.sources.find((s) => s.id === id);
    if (!source) throw new CoreError("NOT_FOUND", `No source with id ${JSON.stringify(id)}`);
    return source;
  }

  /** Absolute path for local sources; the URL for git sources. */
  resolveSourceLocation(source: Source): string {
    return source.kind === "local" ? path.resolve(this.root, source.location) : source.location;
  }
}

export function defaultWorkspaceConfig(name: string, description?: string): WorkspaceConfig {
  return {
    version: WORKSPACE_FORMAT_VERSION,
    name,
    ...(description ? { description } : {}),
    sources: [],
  };
}
