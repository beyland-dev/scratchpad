import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { atomicWrite, nowIso, pathExists, slugify, uniqueSlug, writeJson } from "./fs-utils.ts";
import {
  ID_PATTERN,
  ProjectFileSchema,
  type FileEncoding,
  type Project,
  type ProjectFile,
  type ProjectIconFormat,
} from "./schemas.ts";
import { ProjectScope } from "./scope.ts";
import type { Workspace } from "./workspace.ts";

export const PROJECT_META_FILE = "project.json";
export const PROJECT_GITIGNORE = `# sprue: generated, local-only files
.trash/
.cache/
systems/*/dist/
systems/*/dist.*/
systems/*/skill/
systems/*/skill.*/
systems/*/source/
systems/*/node_modules/
systems/*/activity.jsonl
`;
export const MAX_ICON_BYTES = 1024 * 1024;
const ICON_FORMATS: ProjectIconFormat[] = ["svg", "png", "webp", "jpg"];

export interface ProjectIconInput {
  format: ProjectIconFormat;
  content: string;
  encoding?: FileEncoding;
}

export interface CreateProjectInput {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  pattern?: number;
  icon?: ProjectIconInput;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  pattern?: number | null;
  /** Replace the icon, or `null` to remove it. */
  icon?: ProjectIconInput | null;
}

interface DecodedIcon {
  format: ProjectIconFormat;
  data: Buffer;
}

function decodeIcon(icon: ProjectIconInput): DecodedIcon {
  const data = Buffer.from(
    icon.content,
    icon.encoding ?? (icon.format === "svg" ? "utf8" : "base64"),
  );
  if (data.byteLength > MAX_ICON_BYTES)
    throw new CoreError("INVALID_INPUT", `Icon exceeds ${MAX_ICON_BYTES} bytes`);
  if (icon.format === "svg" && !/<svg[\s>]/i.test(data.toString("utf8")))
    throw new CoreError("INVALID_INPUT", "SVG icon content must contain an <svg> element");
  return { format: icon.format, data };
}

/**
 * Projects live in `projects/<id>/`: project.json, an optional icon, and the project's prototypes,
 * design systems and reviews. Each project has a {@link ProjectScope} with its stores.
 */
export class ProjectStore {
  readonly #ws: Workspace;
  #index = new Map<string, Project>();
  #scopes = new Map<string, ProjectScope>();
  #iconVersions = new Map<string, string>();

  constructor(workspace: Workspace) {
    this.#ws = workspace;
  }

  dirOf(id: string): string {
    if (!ID_PATTERN.test(id))
      throw new CoreError("INVALID_INPUT", `Invalid project id: ${JSON.stringify(id)}`);
    return path.join(this.#ws.projectsDir, id);
  }

  /** Load every project and its contents. */
  async load(): Promise<void> {
    await mkdir(this.#ws.projectsDir, { recursive: true });
    const entries = await readdir(this.#ws.projectsDir, { withFileTypes: true });
    const next = new Map<string, Project>();
    const scopes = new Map<string, ProjectScope>();
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue;
      const project = await this.#readFromDisk(entry.name);
      if (!project) continue;
      next.set(project.id, project);
      const scope = new ProjectScope(this.#ws, project.id);
      await scope.load();
      scopes.set(project.id, scope);
    }
    this.#index = next;
    this.#scopes = scopes;
  }

  /**
   * Re-read a single project's metadata. A project folder that appeared (e.g. a git clone) gets its
   * contents loaded; one that disappeared is dropped. `scopeChanged` says whether either happened.
   */
  async reloadOne(id: string): Promise<{ project: Project | undefined; scopeChanged: boolean }> {
    if (!ID_PATTERN.test(id)) return { project: undefined, scopeChanged: false };
    const project = await this.#readFromDisk(id);
    let scopeChanged = false;
    if (project) {
      // Load a new project's contents before it's listed, so it's never known without its stores.
      if (!this.#scopes.has(id)) {
        const scope = new ProjectScope(this.#ws, id);
        await scope.load();
        this.#scopes.set(id, scope);
        scopeChanged = true;
      }
      this.#index.set(id, project);
    } else {
      this.#index.delete(id);
      scopeChanged = this.#scopes.delete(id);
    }
    return { project, scopeChanged };
  }

  /** The stores of a project's contents. */
  scope(id: string): ProjectScope {
    const scope = this.#scopes.get(id);
    if (!scope) throw new CoreError("NOT_FOUND", `No project with id ${JSON.stringify(id)}`);
    return scope;
  }

  scopes(): ProjectScope[] {
    return this.list().flatMap((p) => this.#scopes.get(p.id) ?? []);
  }

  has(id: string): boolean {
    return this.#index.has(id);
  }

  get(id: string): Project {
    const project = this.#index.get(id);
    if (!project) throw new CoreError("NOT_FOUND", `No project with id ${JSON.stringify(id)}`);
    return project;
  }

  list(): Project[] {
    return [...this.#index.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }

  /** Absolute path of the project's icon file, if it has one. */
  iconPathOf(id: string): string | undefined {
    const icon = this.get(id).icon;
    return icon ? path.join(this.dirOf(id), icon) : undefined;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const now = nowIso();
    const meta = ProjectFileSchema.parse({
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.color ? { color: input.color } : {}),
      ...(input.pattern !== undefined ? { pattern: input.pattern } : {}),
      createdAt: now,
      updatedAt: now,
    });
    // Validate before claiming the folder: a leftover folder would show up as a project.
    const icon = input.icon ? decodeIcon(input.icon) : undefined;
    const id = await this.#claimDir(input.id ?? slugify(input.name), input.id !== undefined);
    try {
      if (icon) await this.#writeIcon(id, icon);
      await atomicWrite(path.join(this.dirOf(id), ".gitignore"), PROJECT_GITIGNORE);
      await writeJson(path.join(this.dirOf(id), PROJECT_META_FILE), meta);
    } catch (error) {
      await rm(this.dirOf(id), { recursive: true, force: true });
      throw error;
    }
    return (await this.reloadOne(id)).project!;
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const current = this.get(id);
    const { id: _id, icon: _icon, issues: _issues, ...file } = current;
    const next: ProjectFile = { ...file, updatedAt: nowIso() };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.pattern === null) delete next.pattern;
    else if (patch.pattern !== undefined) next.pattern = patch.pattern;
    for (const key of ["description", "color"] as const) {
      const value = patch[key];
      if (value === undefined) continue;
      if (value === null || value === "") delete next[key];
      else next[key] = value;
    }
    if (patch.icon !== undefined)
      await this.#writeIcon(id, patch.icon ? decodeIcon(patch.icon) : null);
    await writeJson(path.join(this.dirOf(id), PROJECT_META_FILE), ProjectFileSchema.parse(next));
    return (await this.reloadOne(id)).project!;
  }

  /** Soft-delete: move the whole project folder (with its contents) into the workspace trash. */
  async delete(id: string): Promise<{ id: string; trashedTo: string }> {
    this.get(id);
    await mkdir(this.#ws.trashDir, { recursive: true });
    const target = path.join(this.#ws.trashDir, `project-${id}-${Date.now()}`);
    await rename(this.dirOf(id), target);
    this.#index.delete(id);
    this.#scopes.delete(id);
    return { id, trashedTo: path.relative(this.#ws.root, target) };
  }

  /** Write the (already validated) icon, then remove icons in other formats; `null` removes it. */
  async #writeIcon(id: string, icon: DecodedIcon | null): Promise<void> {
    const dir = this.dirOf(id);
    if (icon) await atomicWrite(path.join(dir, `icon.${icon.format}`), icon.data);
    for (const format of ICON_FORMATS) {
      if (format !== icon?.format) await rm(path.join(dir, `icon.${format}`), { force: true });
    }
  }

  /** Changes whenever the icon file does (so URLs can bust caches); undefined without an icon. */
  iconVersionOf(id: string): string | undefined {
    return this.#iconVersions.get(id);
  }

  /** Atomically reserve a project folder, picking a unique id unless `exact` is set. */
  async #claimDir(base: string, exact: boolean): Promise<string> {
    await mkdir(this.#ws.projectsDir, { recursive: true });
    if (exact) {
      try {
        await mkdir(this.dirOf(base));
        return base;
      } catch (error) {
        if (error instanceof CoreError) throw error;
        throw new CoreError("CONFLICT", `A project with id ${JSON.stringify(base)} already exists`);
      }
    }
    const slug = ID_PATTERN.test(base) ? base : "project";
    const tried = new Set<string>();
    for (let attempt = 0; attempt < 50; attempt++) {
      const id = uniqueSlug(slug, (c) => tried.has(c) || this.#index.has(c));
      tried.add(id);
      try {
        await mkdir(this.dirOf(id));
        return id;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    throw new CoreError("CONFLICT", `Could not allocate a project id for ${JSON.stringify(base)}`);
  }

  async #readFromDisk(id: string): Promise<Project | undefined> {
    const dir = path.join(this.#ws.projectsDir, id);
    let dirStat;
    try {
      dirStat = await stat(dir);
    } catch {
      return undefined;
    }
    if (!dirStat.isDirectory()) return undefined;

    const issues: string[] = [];
    const metaPath = path.join(dir, PROJECT_META_FILE);
    let raw: Record<string, unknown> = {};
    if (await pathExists(metaPath)) {
      try {
        const parsed: unknown = JSON.parse(await readFile(metaPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          raw = parsed as Record<string, unknown>;
        else issues.push(`${PROJECT_META_FILE} must contain a JSON object`);
      } catch (error) {
        issues.push(`${PROJECT_META_FILE} is not valid JSON: ${(error as Error).message}`);
      }
    } else {
      issues.push(`Missing ${PROJECT_META_FILE}`);
    }
    const defaults = {
      name: id.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      createdAt: (dirStat.birthtime.getTime() ? dirStat.birthtime : dirStat.mtime).toISOString(),
      updatedAt: dirStat.mtime.toISOString(),
    };
    let meta: ProjectFile;
    const result = ProjectFileSchema.safeParse({ ...defaults, ...raw });
    if (result.success) {
      meta = result.data;
    } else {
      issues.push(
        ...result.error.issues.map(
          (i) => `${PROJECT_META_FILE}: ${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      );
      const salvaged: Record<string, unknown> = { ...defaults };
      for (const [key, value] of Object.entries(raw)) {
        if (ProjectFileSchema.safeParse({ ...salvaged, [key]: value }).success)
          salvaged[key] = value;
      }
      meta = ProjectFileSchema.parse(salvaged);
    }
    let icon: string | undefined;
    this.#iconVersions.delete(id);
    for (const format of ICON_FORMATS) {
      try {
        const iconStat = await stat(path.join(dir, `icon.${format}`));
        icon = `icon.${format}`;
        this.#iconVersions.set(id, `${format}-${Math.round(iconStat.mtimeMs)}-${iconStat.size}`);
        break;
      } catch {
        // no icon in this format
      }
    }
    return { id, ...meta, ...(icon ? { icon } : {}), ...(issues.length ? { issues } : {}) };
  }
}
