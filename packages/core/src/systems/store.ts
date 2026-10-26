import { appendFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "../errors.ts";
import { atomicWrite, nowIso, pathExists, safeJoin, walkFiles, writeJson } from "../fs-utils.ts";
import type { FileEncoding } from "../schemas.ts";
import type { Workspace } from "../workspace.ts";
import {
  ComponentFileSchema,
  ComponentNameSchema,
  SystemFileSchema,
  SystemIdSchema,
  TokenSchema,
  TokensFileSchema,
  type ComponentFile,
  type ComponentFileInput,
  type DesignComponent,
  type DesignSystem,
  type SystemFile,
  type Token,
  type TokenInput,
  type TokenType,
} from "./schemas.ts";

export const SYSTEMS_DIR = "systems";
export const SYSTEM_FILE = "system.json";
export const TOKENS_FILE = "tokens.json";
export const COMPONENTS_DIR = "components";
export const COMPONENT_FILE = "component.json";
export const DIST_DIR = "dist";
export const SKILL_DIR = "skill";
/** Folders inside a system that are generated; edits there don't count as source changes. */
export const CAPTURES_DIR = "captures";
/** Append-only log of audit activity (captures, imports, components, verifications, builds). */
export const ACTIVITY_FILE = "activity.jsonl";
export const GENERATED_DIRS = [DIST_DIR, SKILL_DIR, CAPTURES_DIR, ACTIVITY_FILE];
/** Generated paths that are still worth notifying about (but never trigger a rebuild). */
export const OBSERVED_PATHS = [CAPTURES_DIR, ACTIVITY_FILE];
const ACTIVITY_MAX_BYTES = 512 * 1024;
const ACTIVITY_KEEP = 1000;

export type ActivityKind = "system" | "tokens" | "capture" | "component" | "verify" | "build";

export interface ActivityEntry {
  at: string;
  kind: ActivityKind;
  /** One-line summary, e.g. "Captured chat-input-dark". */
  title: string;
  detail?: string;
  /** Capture label or component name the entry is about. */
  ref?: string;
  status?: "ok" | "warn" | "error";
}

export interface TokenQuery {
  query?: string;
  type?: TokenType;
  group?: string;
  limit?: number;
  offset?: number;
}

export interface ComponentQuery {
  query?: string;
  kind?: string;
  category?: string;
  limit?: number;
}

const MANAGED_COMPONENT_FILES = new Set([COMPONENT_FILE]);

export class SystemStore {
  readonly #ws: Workspace;
  #systems = new Map<string, DesignSystem>();
  #components = new Map<string, Map<string, DesignComponent>>();
  #tokens = new Map<string, Token[]>();

  constructor(workspace: Workspace) {
    this.#ws = workspace;
  }

  get dir(): string {
    return path.join(this.#ws.designDir, SYSTEMS_DIR);
  }

  dirOf(id: string): string {
    SystemIdSchema.parse(id);
    return path.join(this.dir, id);
  }

  componentDirOf(id: string, name: string): string {
    ComponentNameSchema.parse(name);
    return path.join(this.dirOf(id), COMPONENTS_DIR, name);
  }

  async load(): Promise<void> {
    this.#systems.clear();
    this.#components.clear();
    this.#tokens.clear();
    if (!(await pathExists(this.dir))) return;
    for (const entry of await readdir(this.dir, { withFileTypes: true })) {
      if (entry.isDirectory() && SystemIdSchema.safeParse(entry.name).success)
        await this.reloadSystem(entry.name);
    }
  }

  /** Re-read a system (metadata + components); tokens are re-read lazily. */
  async reloadSystem(id: string): Promise<DesignSystem | undefined> {
    this.#tokens.delete(id);
    const file = path.join(this.dirOf(id), SYSTEM_FILE);
    if (!(await pathExists(file))) {
      this.#systems.delete(id);
      this.#components.delete(id);
      return undefined;
    }
    const issues: string[] = [];
    let system: DesignSystem;
    try {
      const parsed = SystemFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!parsed.success)
        throw new Error(
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        );
      system = { id, ...parsed.data };
    } catch (error) {
      issues.push(`${SYSTEM_FILE}: ${(error as Error).message}`);
      system = {
        id,
        version: 1,
        name: id,
        prefix: "x",
        themes: [{ id: "default", label: "Default", kind: "light", classes: "" }],
        defaultTheme: "default",
        themeSelector: '[data-theme="{theme}"]',
        sheetOrder: [],
        themeSheets: [],
        attribution: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
    }
    if (!system.themes.some((t) => t.id === system.defaultTheme))
      issues.push(`defaultTheme "${system.defaultTheme}" is not a theme`);
    if (issues.length) system.issues = issues;
    this.#systems.set(id, system);

    const components = new Map<string, DesignComponent>();
    const componentsDir = path.join(this.dirOf(id), COMPONENTS_DIR);
    if (await pathExists(componentsDir)) {
      for (const entry of await readdir(componentsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !ComponentNameSchema.safeParse(entry.name).success) continue;
        const component = await this.#readComponent(id, entry.name);
        if (component) components.set(component.name, component);
      }
    }
    this.#components.set(id, components);
    return system;
  }

  async reloadComponent(id: string, name: string): Promise<DesignComponent | undefined> {
    const component = await this.#readComponent(id, name);
    const map = this.#components.get(id) ?? new Map<string, DesignComponent>();
    if (component) map.set(name, component);
    else map.delete(name);
    this.#components.set(id, map);
    return component;
  }

  async #readComponent(id: string, name: string): Promise<DesignComponent | undefined> {
    const file = path.join(this.componentDirOf(id, name), COMPONENT_FILE);
    if (!(await pathExists(file))) return undefined;
    try {
      const parsed = ComponentFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (parsed.success) return { name, system: id, ...parsed.data };
      const fallback = ComponentFileSchema.parse({
        tag: `x-${name}`,
        title: name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      return {
        name,
        system: id,
        ...fallback,
        issues: parsed.error.issues.map(
          (i) => `${COMPONENT_FILE}: ${i.path.join(".")}: ${i.message}`,
        ),
      };
    } catch (error) {
      return {
        name,
        system: id,
        ...ComponentFileSchema.parse({
          tag: `x-${name}`,
          title: name,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }),
        issues: [`${COMPONENT_FILE} is not valid JSON: ${(error as Error).message}`],
      };
    }
  }

  // ---- Systems -----------------------------------------------------------

  list(): DesignSystem[] {
    return [...this.#systems.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  has(id: string): boolean {
    return this.#systems.has(id);
  }

  get(id: string): DesignSystem {
    const system = this.#systems.get(id);
    if (!system) throw new CoreError("NOT_FOUND", `No design system with id ${JSON.stringify(id)}`);
    return system;
  }

  async create(
    id: string,
    input: Omit<SystemFile, "version" | "createdAt" | "updatedAt">,
  ): Promise<DesignSystem> {
    SystemIdSchema.parse(id);
    if (this.#systems.has(id) || (await pathExists(this.dirOf(id)))) {
      throw new CoreError(
        "CONFLICT",
        `A design system with id ${JSON.stringify(id)} already exists`,
      );
    }
    const now = nowIso();
    const file = SystemFileSchema.parse({ ...input, version: 1, createdAt: now, updatedAt: now });
    if (!file.themes.some((t) => t.id === file.defaultTheme)) {
      throw new CoreError(
        "INVALID_INPUT",
        `defaultTheme "${file.defaultTheme}" must be one of the themes`,
      );
    }
    await mkdir(path.join(this.dirOf(id), COMPONENTS_DIR), { recursive: true });
    await writeJson(path.join(this.dirOf(id), SYSTEM_FILE), file);
    await writeJson(path.join(this.dirOf(id), TOKENS_FILE), { tokens: [] });
    await this.logActivity(id, { kind: "system", title: `Created design system ${file.name}` });
    return (await this.reloadSystem(id))!;
  }

  async update(
    id: string,
    patch: Partial<Omit<SystemFile, "version" | "createdAt" | "updatedAt">>,
  ): Promise<DesignSystem> {
    const current = this.get(id);
    const { id: _id, issues: _issues, ...file } = current;
    const next = SystemFileSchema.parse({ ...file, ...patch, updatedAt: nowIso() });
    if (!next.themes.some((t) => t.id === next.defaultTheme)) {
      throw new CoreError(
        "INVALID_INPUT",
        `defaultTheme "${next.defaultTheme}" must be one of the themes`,
      );
    }
    await writeJson(path.join(this.dirOf(id), SYSTEM_FILE), next);
    await this.logActivity(id, {
      kind: "system",
      title: "Updated system settings",
      detail: Object.keys(patch).join(", "),
    });
    return (await this.reloadSystem(id))!;
  }

  async remove(id: string): Promise<{ id: string; trashedTo: string }> {
    this.get(id);
    await mkdir(this.#ws.trashDir, { recursive: true });
    const target = path.join(this.#ws.trashDir, `system-${id}-${Date.now()}`);
    const { rename } = await import("node:fs/promises");
    await rename(this.dirOf(id), target);
    this.#systems.delete(id);
    this.#components.delete(id);
    this.#tokens.delete(id);
    return { id, trashedTo: path.relative(this.#ws.root, target) };
  }

  /** Write a system-level file (e.g. base.css, assets/font.ttf). */
  async writeFile(
    id: string,
    relPath: string,
    content: string,
    encoding: FileEncoding = "utf8",
  ): Promise<{ path: string; size: number }> {
    this.get(id);
    const normalized = relPath.replaceAll("\\", "/").replace(/^\.\//, "");
    const top = normalized.split("/")[0]!;
    if ([SYSTEM_FILE, TOKENS_FILE, COMPONENTS_DIR, ...GENERATED_DIRS].includes(top)) {
      throw new CoreError(
        "INVALID_INPUT",
        `${top} is managed by design-tool; use the system/token/component commands instead`,
      );
    }
    const data = Buffer.from(content, encoding);
    await atomicWrite(safeJoin(this.dirOf(id), normalized), data);
    return { path: normalized, size: data.byteLength };
  }

  async readFile(id: string, relPath: string): Promise<Buffer> {
    this.get(id);
    try {
      return await readFile(safeJoin(this.dirOf(id), relPath));
    } catch {
      throw new CoreError(
        "NOT_FOUND",
        `No file ${JSON.stringify(relPath)} in design system ${JSON.stringify(id)}`,
      );
    }
  }

  async listFiles(id: string): Promise<{ path: string; size: number }[]> {
    this.get(id);
    return walkFiles(this.dirOf(id), {
      ignore: (rel) =>
        /^(dist|skill)\.(next|old)/.test(rel) ||
        GENERATED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)),
    });
  }

  // ---- Tokens ------------------------------------------------------------

  async tokens(id: string): Promise<Token[]> {
    this.get(id);
    const cached = this.#tokens.get(id);
    if (cached) return cached;
    const file = path.join(this.dirOf(id), TOKENS_FILE);
    let tokens: Token[] = [];
    if (await pathExists(file)) {
      const parsed = TokensFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!parsed.success)
        throw new CoreError("INVALID_INPUT", `${TOKENS_FILE} is invalid: ${parsed.error.message}`);
      tokens = parsed.data.tokens;
    }
    this.#tokens.set(id, tokens);
    return tokens;
  }

  /**
   * Upsert tokens, matched by CSS variable (then by name). With `merge` (default), incoming fields
   * override existing ones and per-theme values are merged, so runtime values (from capture) and
   * source metadata (names, descriptions, locations) can be imported separately.
   */
  async importTokens(
    id: string,
    incoming: TokenInput[],
    mode: "merge" | "replace" = "merge",
  ): Promise<{ added: number; updated: number; total: number }> {
    const existing = mode === "replace" ? [] : await this.tokens(id);
    const byVar = new Map(existing.map((t) => [t.cssVar, t]));
    const nameToVar = new Map(existing.map((t) => [t.name, t.cssVar]));
    let added = 0;
    let updated = 0;
    for (const raw of incoming) {
      const key = byVar.has(raw.cssVar) ? raw.cssVar : nameToVar.get(raw.name);
      const prev = key ? byVar.get(key) : undefined;
      if (prev) {
        const merged = TokenSchema.parse({
          ...prev,
          ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)),
          values: { ...prev.values, ...raw.values },
        });
        byVar.delete(prev.cssVar);
        nameToVar.delete(prev.name);
        byVar.set(merged.cssVar, merged);
        nameToVar.set(merged.name, merged.cssVar);
        updated++;
      } else {
        const token = TokenSchema.parse(raw);
        byVar.set(token.cssVar, token);
        nameToVar.set(token.name, token.cssVar);
        added++;
      }
    }
    const tokens = [...byVar.values()].sort((a, b) => a.name.localeCompare(b.name));
    await writeJson(path.join(this.dirOf(id), TOKENS_FILE), { tokens });
    this.#tokens.set(id, tokens);
    await this.#touch(id);
    const groups = new Set(incoming.map((t) => t.group).filter(Boolean));
    await this.logActivity(id, {
      kind: "tokens",
      title: `Imported ${incoming.length} token${incoming.length === 1 ? "" : "s"}`,
      detail: `${added} added, ${updated} updated, ${tokens.length} total${groups.size ? ` · ${[...groups].slice(0, 6).join(", ")}${groups.size > 6 ? ", …" : ""}` : ""}`,
    });
    return { added, updated, total: tokens.length };
  }

  /** Absolute path of a capture folder (`captures/<label>`). */
  captureDirOf(id: string, label: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(label))
      throw new CoreError("INVALID_INPUT", `Invalid capture label: ${JSON.stringify(label)}`);
    return path.join(this.dirOf(id), CAPTURES_DIR, label);
  }

  async listCaptures(id: string): Promise<string[]> {
    this.get(id);
    const dir = path.join(this.dirOf(id), CAPTURES_DIR);
    if (!(await pathExists(dir))) return [];
    return (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }

  async searchTokens(id: string, q: TokenQuery = {}): Promise<{ tokens: Token[]; total: number }> {
    const terms = (q.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const scored: { token: Token; score: number }[] = [];
    for (const token of await this.tokens(id)) {
      if (q.type && token.type !== q.type) continue;
      if (q.group && token.group !== q.group) continue;
      let score = 0;
      if (terms.length) {
        const name = token.name.toLowerCase();
        const cssVar = token.cssVar.toLowerCase();
        const description = (token.description ?? "").toLowerCase();
        let all = true;
        for (const term of terms) {
          const s =
            (name === term || cssVar === term ? 10 : 0) +
            (name.includes(term) ? 4 : 0) +
            (cssVar.includes(term) ? 3 : 0) +
            (description.includes(term) ? 1 : 0);
          if (!s) {
            all = false;
            break;
          }
          score += s;
        }
        if (!all) continue;
      }
      scored.push({ token, score });
    }
    scored.sort((a, b) => b.score - a.score || a.token.name.localeCompare(b.token.name));
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 50;
    return {
      tokens: scored.slice(offset, offset + limit).map((s) => s.token),
      total: scored.length,
    };
  }

  // ---- Components --------------------------------------------------------

  components(id: string): DesignComponent[] {
    this.get(id);
    return [...(this.#components.get(id)?.values() ?? [])].sort(
      (a, b) =>
        kindRank(a.kind) - kindRank(b.kind) ||
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name),
    );
  }

  component(id: string, name: string): DesignComponent {
    const component = this.#components.get(id)?.get(name);
    if (!component)
      throw new CoreError(
        "NOT_FOUND",
        `No component ${JSON.stringify(name)} in design system ${JSON.stringify(id)}`,
      );
    return component;
  }

  componentByTag(id: string, tag: string): DesignComponent | undefined {
    return this.components(id).find((c) => c.tag === tag);
  }

  searchComponents(id: string, q: ComponentQuery = {}): DesignComponent[] {
    const terms = (q.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const scored: { component: DesignComponent; score: number }[] = [];
    for (const c of this.components(id)) {
      if (q.kind && c.kind !== q.kind) continue;
      if (q.category && c.category !== q.category) continue;
      let score = 0;
      if (terms.length) {
        const fields = {
          name: c.name,
          tag: c.tag,
          title: c.title.toLowerCase(),
          category: c.category.toLowerCase(),
          text: `${c.description} ${c.usage ?? ""} ${c.states.map((s) => s.name).join(" ")} ${c.attributes.map((a) => a.name).join(" ")}`.toLowerCase(),
        };
        let all = true;
        for (const term of terms) {
          const s =
            (fields.name === term || fields.tag === term ? 10 : 0) +
            (fields.name.includes(term) || fields.tag.includes(term) ? 5 : 0) +
            (fields.title.includes(term) ? 4 : 0) +
            (fields.category.includes(term) ? 2 : 0) +
            (fields.text.includes(term) ? 1 : 0);
          if (!s) {
            all = false;
            break;
          }
          score += s;
        }
        if (!all) continue;
      }
      scored.push({ component: c, score });
    }
    scored.sort((a, b) => b.score - a.score || a.component.name.localeCompare(b.component.name));
    return scored.slice(0, q.limit ?? 100).map((s) => s.component);
  }

  async createComponent(
    id: string,
    name: string,
    input: Omit<ComponentFileInput, "createdAt" | "updatedAt">,
    files: { css?: string; js?: string } = {},
  ): Promise<DesignComponent> {
    this.get(id);
    ComponentNameSchema.parse(name);
    const dir = this.componentDirOf(id, name);
    if (await pathExists(dir))
      throw new CoreError("CONFLICT", `Component ${JSON.stringify(name)} already exists`);
    const clash = this.components(id).find((c) => c.tag === input.tag);
    if (clash)
      throw new CoreError(
        "CONFLICT",
        `Tag <${input.tag}> is already used by component ${JSON.stringify(clash.name)}`,
      );
    const now = nowIso();
    const file = ComponentFileSchema.parse({ ...input, createdAt: now, updatedAt: now });
    await mkdir(dir, { recursive: true });
    if (files.css !== undefined) await atomicWrite(path.join(dir, "component.css"), files.css);
    if (files.js !== undefined) await atomicWrite(path.join(dir, "component.js"), files.js);
    await writeJson(path.join(dir, COMPONENT_FILE), file);
    await this.#touch(id);
    await this.logActivity(id, {
      kind: "component",
      title: `Created <${file.tag}>`,
      detail: `${file.kind} · ${file.title}${file.cssCaptures.length ? ` · CSS from ${file.cssCaptures.length} capture(s)` : ""}`,
      ref: name,
    });
    return (await this.reloadComponent(id, name))!;
  }

  async updateComponent(
    id: string,
    name: string,
    patch: Partial<Omit<ComponentFileInput, "createdAt" | "updatedAt">>,
  ): Promise<DesignComponent> {
    const current = this.component(id, name);
    if (patch.tag && patch.tag !== current.tag) {
      const clash = this.components(id).find((c) => c.tag === patch.tag);
      if (clash)
        throw new CoreError(
          "CONFLICT",
          `Tag <${patch.tag}> is already used by component ${JSON.stringify(clash.name)}`,
        );
    }
    const { name: _n, system: _s, issues: _i, ...file } = current;
    const next: ComponentFile = ComponentFileSchema.parse({
      ...file,
      ...patch,
      updatedAt: nowIso(),
    });
    await writeJson(path.join(this.componentDirOf(id, name), COMPONENT_FILE), next);
    await this.#touch(id);
    const keys = Object.keys(patch).filter((k) => k !== "verification");
    if (keys.length)
      await this.logActivity(id, {
        kind: "component",
        title: `Updated <${next.tag}>`,
        detail: keys.join(", "),
        ref: name,
      });
    return (await this.reloadComponent(id, name))!;
  }

  async removeComponent(id: string, name: string): Promise<{ name: string; removed: true }> {
    const tag = this.component(id, name).tag;
    await rm(this.componentDirOf(id, name), { recursive: true, force: true });
    this.#components.get(id)?.delete(name);
    await this.#touch(id);
    await this.logActivity(id, { kind: "component", title: `Removed <${tag}>`, ref: name });
    return { name, removed: true };
  }

  async writeComponentFile(
    id: string,
    name: string,
    relPath: string,
    content: string,
    encoding: FileEncoding = "utf8",
  ): Promise<{ path: string; size: number }> {
    this.component(id, name);
    const normalized = relPath.replaceAll("\\", "/").replace(/^\.\//, "");
    if (MANAGED_COMPONENT_FILES.has(normalized)) {
      throw new CoreError(
        "INVALID_INPUT",
        `${normalized} is managed by design-tool; use component.update instead`,
      );
    }
    const data = Buffer.from(content, encoding);
    await atomicWrite(safeJoin(this.componentDirOf(id, name), normalized), data);
    await this.#touch(id);
    await this.logActivity(id, {
      kind: "component",
      title: `Wrote ${normalized} for <${this.component(id, name).tag}>`,
      detail: `${(data.byteLength / 1024).toFixed(1)} KB`,
      ref: name,
    });
    return { path: normalized, size: data.byteLength };
  }

  async readComponentFile(id: string, name: string, relPath: string): Promise<Buffer | undefined> {
    this.component(id, name);
    try {
      return await readFile(safeJoin(this.componentDirOf(id, name), relPath));
    } catch {
      return undefined;
    }
  }

  async componentFiles(id: string, name: string): Promise<{ path: string; size: number }[]> {
    this.component(id, name);
    return walkFiles(this.componentDirOf(id, name));
  }

  // ---- Activity ----------------------------------------------------------

  /** Record audit activity. Best-effort: never throws. */
  async logActivity(id: string, entry: Omit<ActivityEntry, "at">): Promise<void> {
    try {
      const file = path.join(this.dirOf(id), ACTIVITY_FILE);
      await appendFile(file, `${JSON.stringify({ at: nowIso(), ...entry })}\n`);
      const info = await stat(file);
      if (info.size > ACTIVITY_MAX_BYTES) {
        const lines = (await readFile(file, "utf8")).trimEnd().split("\n");
        await atomicWrite(file, `${lines.slice(-ACTIVITY_KEEP).join("\n")}\n`);
      }
    } catch {
      // Activity is informational.
    }
  }

  /** Recent activity, newest first. */
  async activity(id: string, limit = 200): Promise<ActivityEntry[]> {
    this.get(id);
    const text = await readFile(path.join(this.dirOf(id), ACTIVITY_FILE), "utf8").catch(() => "");
    const out: ActivityEntry[] = [];
    const lines = text.trimEnd().split("\n");
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        if (lines[i]) out.push(JSON.parse(lines[i]!) as ActivityEntry);
      } catch {
        // Skip a partially written line.
      }
    }
    return out;
  }

  async #touch(id: string): Promise<void> {
    const system = this.#systems.get(id);
    if (!system) return;
    system.updatedAt = nowIso();
  }

  /** Modification time of the newest source file in a system (excluding generated folders). */
  async sourceMtime(id: string): Promise<number> {
    let newest = 0;
    for (const file of await this.listFiles(id)) {
      const info = await stat(path.join(this.dirOf(id), file.path));
      newest = Math.max(newest, info.mtimeMs);
    }
    return newest;
  }
}

function kindRank(kind: string): number {
  return kind === "context" ? 0 : kind === "component" ? 1 : 2;
}
