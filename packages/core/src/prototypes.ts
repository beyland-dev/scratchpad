import { cp, mkdir, readFile, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";
import { familyOf } from "./family.ts";
import {
  atomicWrite,
  nowIso,
  pathExists,
  safeJoin,
  uniqueSlug,
  walkFiles,
  writeJson,
} from "./fs-utils.ts";
import {
  FileInputSchema,
  ID_PATTERN,
  PrototypeFileSchema,
  type Author,
  type FileEncoding,
  type FileInput,
  type Prototype,
  type PrototypeFile,
  type PrototypeFileEntry,
  type PrototypeStatus,
} from "./schemas.ts";
import type { ScopeContext } from "./scope.ts";
import { PROTOTYPES_DIR } from "./workspace.ts";

export const PROTOTYPE_META_FILE = "prototype.json";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface CreatePrototypeInput {
  id?: string;
  title: string;
  description?: string;
  status?: PrototypeStatus;
  tags?: string[];
  framework?: "react";
  system?: string;
  group?: string;
  variantOf?: string;
  entry?: string;
  createdBy?: Author;
  sourceRefs?: string[];
  html?: string;
  files?: FileInput[];
}

export interface UpdatePrototypeInput {
  title?: string;
  system?: string | null;
  description?: string | null;
  status?: PrototypeStatus;
  tags?: string[];
  group?: string | null;
  variantOf?: string | null;
  entry?: string;
  sourceRefs?: string[];
}

export interface PrototypeFilter {
  group?: string;
  tag?: string;
  status?: PrototypeStatus;
  search?: string;
}

export interface ReadFileResult {
  path: string;
  content: string;
  encoding: FileEncoding;
  size: number;
}

/** The prototypes of one project: `projects/<project>/prototypes/<id>/`. */
export class PrototypeStore {
  readonly #ctx: ScopeContext;
  readonly dir: string;
  #index = new Map<string, Prototype>();
  /** Design systems each prototype's entry HTML loads (…/systems/<id>/system.css or system.js). */
  #systemRefs = new Map<string, string[]>();

  constructor(context: ScopeContext) {
    this.#ctx = context;
    this.dir = path.join(context.dir, PROTOTYPES_DIR);
  }

  dirOf(id: string): string {
    if (!ID_PATTERN.test(id))
      throw new CoreError("INVALID_INPUT", `Invalid prototype id: ${JSON.stringify(id)}`);
    return path.join(this.dir, id);
  }

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const entries = await readdir(this.dir, { withFileTypes: true });
    const next = new Map<string, Prototype>();
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue;
      const proto = await this.#readFromDisk(entry.name);
      if (proto) next.set(proto.id, proto);
    }
    this.#index = next;
  }

  /** Re-read a single prototype from disk. Returns undefined if it no longer exists. */
  async reloadOne(id: string): Promise<Prototype | undefined> {
    if (!ID_PATTERN.test(id)) return undefined;
    const proto = await this.#readFromDisk(id);
    if (proto) this.#index.set(id, proto);
    else {
      this.#index.delete(id);
      this.#systemRefs.delete(id);
    }
    return proto;
  }

  has(id: string): boolean {
    return this.#index.has(id);
  }

  /** Ids of the design systems a prototype's entry HTML loads, in order of appearance. */
  systemRefs(id: string): string[] {
    return this.#systemRefs.get(id) ?? [];
  }

  list(filter: PrototypeFilter = {}): Prototype[] {
    const search = filter.search?.toLowerCase();
    return [...this.#index.values()]
      .filter((p) => (filter.group === undefined ? true : p.group === filter.group))
      .filter((p) => (filter.tag === undefined ? true : p.tags.includes(filter.tag)))
      .filter((p) => (filter.status === undefined ? true : p.status === filter.status))
      .filter((p) =>
        search
          ? [p.id, p.title, p.description ?? "", p.group ?? "", ...p.tags].some((v) =>
              v.toLowerCase().includes(search),
            )
          : true,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  get(id: string): Prototype {
    const proto = this.#index.get(id);
    if (!proto)
      throw new CoreError(
        "NOT_FOUND",
        `No prototype ${JSON.stringify(id)} in project ${JSON.stringify(this.#ctx.project)}`,
      );
    return proto;
  }

  /** All prototypes in the same variant family, oldest → newest (the last one is the latest version). */
  family(id: string): Prototype[] {
    this.get(id);
    return familyOf([...this.#index.values()], id);
  }

  async listFiles(id: string): Promise<PrototypeFileEntry[]> {
    this.get(id);
    return walkFiles(this.dirOf(id), { ignore: (rel) => rel === PROTOTYPE_META_FILE });
  }

  async create(input: CreatePrototypeInput): Promise<Prototype> {
    if (input.variantOf) this.get(input.variantOf);
    this.#assertSources(input.sourceRefs);
    const files = (input.files ?? []).map((f) => FileInputSchema.parse(f));
    const entry = input.entry ?? "index.html";
    const id = await this.#claimDir(input.id ?? input.title, input.id !== undefined);
    const now = nowIso();
    const meta: PrototypeFile = {
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      status: input.status ?? "draft",
      tags: input.tags ?? [],
      ...(input.framework ? { framework: input.framework } : {}),
      ...(input.system ? { system: input.system } : {}),
      ...(input.group ? { group: input.group } : {}),
      ...(input.variantOf ? { variantOf: input.variantOf } : {}),
      entry,
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      sourceRefs: input.sourceRefs ?? [],
      createdAt: now,
      updatedAt: now,
    };
    const dir = this.dirOf(id);
    if (input.html !== undefined)
      files.push({ path: entry, content: input.html, encoding: "utf8" });
    for (const file of files) await this.#writeRaw(dir, file.path, file.content, file.encoding);
    if (!files.some((f) => normalizeRel(f.path) === normalizeRel(entry))) {
      if (input.framework === "react") {
        await this.#writeRaw(dir, entry, reactShellHtml(input.title), "utf8");
        if (!files.some((f) => /^main\.[jt]sx?$/.test(normalizeRel(f.path))))
          await this.#writeRaw(
            dir,
            "main.tsx",
            reactPlaceholder(input.title, input.description),
            "utf8",
          );
      } else {
        await this.#writeRaw(dir, entry, placeholderHtml(input.title, input.description), "utf8");
      }
    }
    await writeJson(path.join(dir, PROTOTYPE_META_FILE), meta);
    return (await this.reloadOne(id))!;
  }

  /**
   * Update metadata. Versions of a family share one name: renaming any version renames all of
   * them, and joining a family (`variantOf`) takes on its name.
   */
  async update(id: string, patch: UpdatePrototypeInput): Promise<Prototype> {
    const current = this.get(id);
    let title = patch.title;
    if (patch.variantOf) {
      if (patch.variantOf === id)
        throw new CoreError("INVALID_INPUT", "A prototype cannot be a variant of itself");
      this.get(patch.variantOf);
      title ??= this.family(patch.variantOf)[0]?.title;
    }
    this.#assertSources(patch.sourceRefs);
    const next: PrototypeFile = { ...toFile(current) };
    if (title !== undefined) next.title = title;
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.tags !== undefined) next.tags = patch.tags;
    if (patch.entry !== undefined) next.entry = normalizeRel(patch.entry);
    if (patch.sourceRefs !== undefined) next.sourceRefs = patch.sourceRefs;
    applyNullable(next, "description", patch.description);
    applyNullable(next, "group", patch.group);
    applyNullable(next, "variantOf", patch.variantOf);
    applyNullable(next, "system", patch.system);
    next.updatedAt = nowIso();
    await writeJson(
      path.join(this.dirOf(id), PROTOTYPE_META_FILE),
      PrototypeFileSchema.parse(next),
    );
    const updated = (await this.reloadOne(id))!;
    if (title !== undefined) {
      // A rename isn't an edit of the other versions' designs, so their updatedAt stays.
      for (const member of this.family(id)) {
        if (member.id === id || member.title === title) continue;
        await writeJson(path.join(this.dirOf(member.id), PROTOTYPE_META_FILE), {
          ...toFile(member),
          title,
        });
        await this.reloadOne(member.id);
      }
    }
    return updated;
  }

  async writeFile(
    id: string,
    relPath: string,
    content: string,
    encoding: FileEncoding = "utf8",
  ): Promise<PrototypeFileEntry> {
    this.get(id);
    const size = await this.#writeRaw(this.dirOf(id), relPath, content, encoding);
    await this.#touch(id);
    return { path: normalizeRel(relPath), size };
  }

  async readFile(id: string, relPath: string, encoding?: FileEncoding): Promise<ReadFileResult> {
    this.get(id);
    const abs = safeJoin(this.dirOf(id), relPath);
    let data: Buffer;
    try {
      data = await readFile(abs);
    } catch {
      throw new CoreError(
        "NOT_FOUND",
        `No file ${JSON.stringify(relPath)} in prototype ${JSON.stringify(id)}`,
      );
    }
    const resolved = encoding ?? (isProbablyText(abs) ? "utf8" : "base64");
    return {
      path: normalizeRel(relPath),
      content: data.toString(resolved),
      encoding: resolved,
      size: data.byteLength,
    };
  }

  /**
   * Fork `id` into a new version of its family: a copy of its files, linked by `variantOf`. Versions
   * share the family's name (they're told apart as V1, V2, … Latest); `description` says what
   * this one changes.
   */
  async createVariant(
    id: string,
    input: { id?: string; description?: string; createdBy?: Author } = {},
  ): Promise<Prototype> {
    const source = this.get(id);
    const family = this.family(id);
    // Named after the family's original, so forking "checkout-v2" gives "checkout-v3", not "checkout-v2-v3".
    const root = family[0] ?? source;
    const title = root.title;
    const newId = await this.#claimDir(
      input.id ?? `${root.id}-v${family.length + 1}`,
      input.id !== undefined,
    );
    const dir = this.dirOf(newId);
    await cp(this.dirOf(id), dir, {
      recursive: true,
      filter: (src) => path.basename(src) !== PROTOTYPE_META_FILE,
    });
    const now = nowIso();
    const meta: PrototypeFile = {
      ...toFile(source),
      title,
      status: "draft",
      variantOf: source.id,
      createdAt: now,
      updatedAt: now,
    };
    delete meta.description;
    if (input.description) meta.description = input.description;
    delete meta.createdBy;
    if (input.createdBy) meta.createdBy = input.createdBy;
    await writeJson(path.join(dir, PROTOTYPE_META_FILE), meta);
    return (await this.reloadOne(newId))!;
  }

  /** Soft-delete: move the folder into the project's `.trash/`. */
  async delete(id: string): Promise<{ id: string; project: string; trashedTo: string }> {
    this.get(id);
    await mkdir(this.#ctx.trashDir, { recursive: true });
    const target = path.join(this.#ctx.trashDir, `prototype-${id}-${Date.now()}`);
    await rename(this.dirOf(id), target);
    this.#index.delete(id);
    this.#systemRefs.delete(id);
    return {
      id,
      project: this.#ctx.project,
      trashedTo: path.relative(this.#ctx.workspace.root, target),
    };
  }

  /**
   * Move a prototype's folder in from another project's store. Links that don't hold in this
   * project (`variantOf`, `system`) are dropped.
   */
  async adopt(
    from: PrototypeStore,
    id: string,
    options: { keepSystem: boolean },
  ): Promise<Prototype> {
    const source = from.get(id);
    if (this.#index.has(id) || (await pathExists(this.dirOf(id))))
      throw new CoreError(
        "CONFLICT",
        `Project ${JSON.stringify(this.#ctx.project)} already has a prototype ${JSON.stringify(id)}`,
      );
    await mkdir(this.dir, { recursive: true });
    await rename(from.dirOf(id), this.dirOf(id));
    from.#index.delete(id);
    from.#systemRefs.delete(id);
    const meta = toFile(source);
    if (meta.variantOf && !this.#index.has(meta.variantOf)) delete meta.variantOf;
    if (!options.keepSystem) delete meta.system;
    meta.updatedAt = nowIso();
    await writeJson(path.join(this.dirOf(id), PROTOTYPE_META_FILE), meta);
    return (await this.reloadOne(id))!;
  }

  #assertSources(refs: string[] | undefined): void {
    for (const ref of refs ?? []) this.#ctx.workspace.getSource(ref);
  }

  async #touch(id: string): Promise<void> {
    const current = this.get(id);
    await writeJson(path.join(this.dirOf(id), PROTOTYPE_META_FILE), {
      ...toFile(current),
      updatedAt: nowIso(),
    });
    await this.reloadOne(id);
  }

  async #writeRaw(
    dir: string,
    relPath: string,
    content: string,
    encoding: FileEncoding,
  ): Promise<number> {
    if (normalizeRel(relPath) === PROTOTYPE_META_FILE) {
      throw new CoreError(
        "INVALID_INPUT",
        `${PROTOTYPE_META_FILE} is managed by scratchpad; use prototype.update instead`,
      );
    }
    const abs = safeJoin(dir, relPath);
    const data = Buffer.from(content, encoding);
    if (data.byteLength > MAX_FILE_BYTES) {
      throw new CoreError("INVALID_INPUT", `File ${relPath} exceeds ${MAX_FILE_BYTES} bytes`);
    }
    await atomicWrite(abs, data);
    return data.byteLength;
  }

  /** Atomically reserve a prototype folder, picking a unique id unless `exact` is set. */
  async #claimDir(base: string, exact: boolean): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    if (exact) {
      if (!ID_PATTERN.test(base))
        throw new CoreError("INVALID_INPUT", `Invalid prototype id: ${JSON.stringify(base)}`);
      try {
        await mkdir(this.dirOf(base));
        return base;
      } catch {
        throw new CoreError(
          "CONFLICT",
          `A prototype with id ${JSON.stringify(base)} already exists`,
        );
      }
    }
    const tried = new Set<string>();
    for (let attempt = 0; attempt < 50; attempt++) {
      const id = uniqueSlug(base, (c) => tried.has(c) || this.#index.has(c));
      tried.add(id);
      try {
        await mkdir(this.dirOf(id));
        return id;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    throw new CoreError(
      "CONFLICT",
      `Could not allocate a prototype id for ${JSON.stringify(base)}`,
    );
  }

  async #readFromDisk(id: string): Promise<Prototype | undefined> {
    const dir = path.join(this.dir, id);
    let dirStat;
    try {
      dirStat = await stat(dir);
    } catch {
      return undefined;
    }
    if (!dirStat.isDirectory()) return undefined;

    const issues: string[] = [];
    const metaPath = path.join(dir, PROTOTYPE_META_FILE);
    let raw: Record<string, unknown> | undefined;
    if (await pathExists(metaPath)) {
      try {
        const parsed: unknown = JSON.parse(await readFile(metaPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          raw = parsed as Record<string, unknown>;
        else issues.push(`${PROTOTYPE_META_FILE} must contain a JSON object`);
      } catch (error) {
        issues.push(`${PROTOTYPE_META_FILE} is not valid JSON: ${(error as Error).message}`);
      }
    }

    const files = await walkFiles(dir, { ignore: (rel) => rel === PROTOTYPE_META_FILE });
    if (!raw && files.length === 0) return undefined;

    const fallbackTime = (
      dirStat.birthtime.getTime() ? dirStat.birthtime : dirStat.mtime
    ).toISOString();
    const entry = typeof raw?.entry === "string" ? raw.entry : "index.html";
    const defaults = {
      title: await inferTitle(dir, entry, id),
      createdAt: fallbackTime,
      updatedAt: dirStat.mtime.toISOString(),
    };
    let meta: PrototypeFile;
    const result = PrototypeFileSchema.safeParse({ ...defaults, ...raw });
    if (result.success) {
      meta = result.data;
    } else {
      issues.push(
        ...result.error.issues.map(
          (i) => `${PROTOTYPE_META_FILE}: ${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      );
      // Keep whichever fields are individually valid so a single bad field doesn't hide the prototype.
      const salvaged: Record<string, unknown> = { ...defaults };
      for (const [key, value] of Object.entries(raw ?? {})) {
        const candidate = PrototypeFileSchema.safeParse({ ...salvaged, [key]: value });
        if (candidate.success) salvaged[key] = value;
      }
      meta = PrototypeFileSchema.parse(salvaged);
    }
    if (!files.some((f) => f.path === normalizeRel(meta.entry))) {
      issues.push(`Entry file ${meta.entry} not found`);
      this.#systemRefs.delete(id);
    } else {
      this.#systemRefs.set(id, await readSystemRefs(path.join(dir, normalizeRel(meta.entry))));
    }
    return { id, project: this.#ctx.project, ...meta, ...(issues.length ? { issues } : {}) };
  }
}

function toFile(proto: Prototype): PrototypeFile {
  const { id: _id, project: _project, issues: _issues, ...rest } = proto;
  return rest;
}

function applyNullable<K extends "description" | "group" | "variantOf" | "system">(
  target: PrototypeFile,
  key: K,
  value: string | null | undefined,
): void {
  if (value === undefined) return;
  if (value === null || value === "") delete target[key];
  else target[key] = value as PrototypeFile[K];
}

/** `../../systems/<id>/system.css` (or .js): a plain HTML prototype loading one of its project's systems. */
const SYSTEM_REF = /(?:^|[/"'])systems\/([a-zA-Z0-9][a-zA-Z0-9._-]*)\/system\.(?:css|js)\b/g;

async function readSystemRefs(file: string): Promise<string[]> {
  if (!/\.html?$/i.test(file)) return [];
  const html = await readFile(file, "utf8").catch(() => "");
  return [...new Set([...html.matchAll(SYSTEM_REF)].map((m) => m[1]!))];
}

export function normalizeRel(rel: string): string {
  return path.posix.normalize(rel.replaceAll("\\", "/")).replace(/^\.\//, "");
}

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".svg",
  ".xml",
  ".csv",
  ".yaml",
  ".yml",
]);

function isProbablyText(file: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function inferTitle(dir: string, entry: string, id: string): Promise<string> {
  try {
    const html = await readFile(safeJoin(dir, entry), "utf8");
    const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const title = match?.[1]?.trim();
    if (title) return title;
  } catch {
    // fall through to id-based title
  }
  return id.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Entry of a React prototype: an empty shell; the app lives in main.tsx. */
export function reactShellHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`;
}

function reactPlaceholder(title: string, description?: string): string {
  return `import { createRoot } from "react-dom/client";
import "@/index.css";

function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-8 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">${title.replace(/[{}<>]/g, "")}</h1>
        <p className="mt-2 text-muted-foreground">
          ${(description ?? "This prototype is empty. Write main.tsx to get started.").replace(/[{}<>]/g, "")}
        </p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`;
}

function placeholderHtml(title: string, description?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; color: #444; background: #fafafa; }
      main { text-align: center; max-width: 32rem; padding: 2rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description ?? "This prototype is empty. Write an index.html to get started.")}</p>
    </main>
  </body>
</html>
`;
}
