import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { atomicWrite, pathExists, writeJson } from "./fs-utils.ts";
import { renderAgentsGuide } from "./guide.ts";
import {
  WORKSPACE_FORMAT_VERSION,
  WorkspaceConfigSchema,
  type Source,
  type WorkspaceConfig,
} from "./schemas.ts";

/** Name of the folder in the user's home directory that holds everything. */
export const HOME_DIR_NAME = ".sprue";
export const CONFIG_FILE = "config.json";
export const AGENTS_FILE = "AGENTS.md";
export const PROJECTS_DIR = "projects";
export const PROTOTYPES_DIR = "prototypes";
export const REVIEWS_DIR = "reviews";
export const TRASH_DIR = ".trash";
export const CACHE_DIR = ".cache";

/** The workspace root: `$SPRUE_HOME`, else `~/.sprue`. */
export function defaultWorkspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.SPRUE_HOME ? path.resolve(env.SPRUE_HOME) : path.join(os.homedir(), HOME_DIR_NAME);
}

export function configFileOf(root: string): string {
  return path.join(root, CONFIG_FILE);
}

export function defaultWorkspaceConfig(): WorkspaceConfig {
  return { version: WORKSPACE_FORMAT_VERSION, sources: [] };
}

/** Create the workspace folder (config, agent guide, projects/) if it doesn't exist yet. */
export async function ensureWorkspace(root: string): Promise<{ root: string; created: boolean }> {
  const resolved = path.resolve(root);
  const file = configFileOf(resolved);
  if (await pathExists(file)) return { root: resolved, created: false };
  await mkdir(path.join(resolved, PROJECTS_DIR), { recursive: true });
  await writeJson(file, defaultWorkspaceConfig());
  await atomicWrite(path.join(resolved, AGENTS_FILE), renderAgentsGuide());
  return { root: resolved, created: true };
}

export async function readWorkspaceConfig(root: string): Promise<WorkspaceConfig> {
  const file = configFileOf(root);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new CoreError("NO_WORKSPACE", `No Sprue workspace at ${root} (missing ${CONFIG_FILE}).`);
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

/**
 * The workspace: one folder per machine (`~/.sprue`) holding machine-local settings and
 * every project. Each project folder is self-contained and can be its own git repo.
 */
export class Workspace {
  readonly root: string;
  readonly projectsDir: string;
  readonly trashDir: string;
  readonly cacheDir: string;
  readonly configFile: string;
  #config: WorkspaceConfig;

  private constructor(root: string, config: WorkspaceConfig) {
    this.root = root;
    this.projectsDir = path.join(root, PROJECTS_DIR);
    this.trashDir = path.join(root, TRASH_DIR);
    this.cacheDir = path.join(root, CACHE_DIR);
    this.configFile = configFileOf(root);
    this.#config = config;
  }

  /** Open the workspace, creating it on first use. */
  static async open(root: string): Promise<Workspace> {
    const { root: resolved } = await ensureWorkspace(root);
    await mkdir(path.join(resolved, PROJECTS_DIR), { recursive: true });
    // The guide is generated: keep it in step with this version of Sprue.
    const guide = path.join(resolved, AGENTS_FILE);
    const text = renderAgentsGuide();
    if ((await readFile(guide, "utf8").catch(() => "")) !== text) await atomicWrite(guide, text);
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
    await writeJson(this.configFile, next);
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
