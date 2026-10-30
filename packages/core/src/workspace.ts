import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
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

/** Per-user settings kept outside any workspace, since they say where the workspace is. */
export interface UserSettings {
  /** Workspace folder chosen in Settings (absolute). */
  workspace?: string;
  /** Desktop app icon chosen in Settings (an id like "blue"; unset: the default icon). */
  appIcon?: string;
}

/** `$XDG_CONFIG_HOME/sprue/settings.json`, else `~/.config/sprue/settings.json`. */
export function userSettingsFile(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME
    ? path.resolve(env.XDG_CONFIG_HOME)
    : path.join(os.homedir(), ".config");
  return path.join(base, "sprue", "settings.json");
}

/** Missing or unreadable settings count as none, so a bad file never blocks startup. */
export function readUserSettings(env: NodeJS.ProcessEnv = process.env): UserSettings {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(userSettingsFile(env), "utf8"));
  } catch {
    return {};
  }
  if (!json || typeof json !== "object") return {};
  const { workspace, appIcon } = json as Record<string, unknown>;
  return {
    ...(typeof workspace === "string" && path.isAbsolute(workspace) ? { workspace } : {}),
    ...(typeof appIcon === "string" && /^[a-z0-9-]+$/.test(appIcon) ? { appIcon } : {}),
  };
}

/** Merge `patch` into the saved settings; `undefined` values remove a setting. */
export async function updateUserSettings(
  patch: Partial<Record<keyof UserSettings, string | undefined>>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<UserSettings> {
  const next: Record<string, string | undefined> = { ...readUserSettings(env), ...patch };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  const file = userSettingsFile(env);
  await mkdir(path.dirname(file), { recursive: true });
  await writeJson(file, next);
  return next as UserSettings;
}

/** `~/.sprue`: where the workspace lives unless moved in Settings or by `$SPRUE_HOME`. */
export function builtinWorkspaceRoot(): string {
  return path.join(os.homedir(), HOME_DIR_NAME);
}

/** The workspace root: `$SPRUE_HOME`, else the folder chosen in Settings, else `~/.sprue`. */
export function defaultWorkspaceRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SPRUE_HOME) return path.resolve(env.SPRUE_HOME);
  return readUserSettings(env).workspace ?? builtinWorkspaceRoot();
}

/** Expand `~` and make absolute; relative paths aren't meaningful for a machine-wide setting. */
export function resolveWorkspacePath(input: string): string {
  const trimmed = input.trim();
  const expanded =
    trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("~\\")
      ? path.join(os.homedir(), trimmed.slice(1))
      : trimmed;
  if (!path.isAbsolute(expanded))
    throw new CoreError("INVALID_INPUT", `Use an absolute path (or one starting with ~): ${input}`);
  return path.resolve(expanded);
}

/** A workspace can go in a new or empty folder, or point at an existing Sprue workspace. */
export async function checkWorkspaceFolder(root: string): Promise<{ exists: boolean }> {
  let info;
  try {
    info = await stat(root);
  } catch {
    return { exists: false };
  }
  if (!info.isDirectory()) throw new CoreError("INVALID_INPUT", `${root} is a file, not a folder.`);
  if (await pathExists(configFileOf(root))) return { exists: true };
  const entries = (await readdir(root)).filter((name) => name !== ".DS_Store");
  if (entries.length)
    throw new CoreError(
      "INVALID_INPUT",
      `${root} isn't empty. Choose an empty folder or an existing Sprue workspace.`,
    );
  return { exists: false };
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
