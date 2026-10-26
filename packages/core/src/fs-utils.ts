import { randomBytes } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "./errors.ts";

export const TMP_SUFFIX = ".dt-tmp";

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Write via temp file + rename so readers and watchers never see partial files. */
export async function atomicWrite(target: string, data: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomBytes(4).toString("hex")}${TMP_SUFFIX}`;
  try {
    await writeFile(tmp, data);
    await rename(tmp, target);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

export async function writeJson(target: string, value: unknown): Promise<void> {
  await atomicWrite(target, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Resolve `relative` inside `base`, rejecting absolute paths and traversal
 * outside of `base`. Returns the normalized absolute path.
 */
export function safeJoin(base: string, relative: string): string {
  if (!relative || relative.includes("\0")) {
    throw new CoreError("INVALID_INPUT", `Invalid path: ${JSON.stringify(relative)}`);
  }
  const normalized = relative.replaceAll("\\", "/");
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new CoreError("INVALID_INPUT", `Path must be relative: ${relative}`);
  }
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, normalized);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new CoreError("INVALID_INPUT", `Path escapes its folder: ${relative}`);
  }
  if (resolved === resolvedBase) {
    throw new CoreError("INVALID_INPUT", `Path must point to a file: ${relative}`);
  }
  return resolved;
}

export interface WalkedFile {
  /** POSIX-style path relative to the walk root. */
  path: string;
  size: number;
}

export async function walkFiles(
  root: string,
  options: { ignore?: (rel: string) => boolean } = {},
): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];
  async function visit(dir: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.endsWith(TMP_SUFFIX) || options.ignore?.(rel)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs, rel);
      } else if (entry.isFile()) {
        const info = await stat(abs);
        out.push({ path: rel, size: info.size });
      }
    }
  }
  await visit(root, "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

export function uniqueSlug(base: string, taken: (candidate: string) => boolean): string {
  const root = slugify(base);
  if (!taken(root)) return root;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${root}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  throw new CoreError("CONFLICT", `Could not find a free id for ${JSON.stringify(base)}`);
}

export function nowIso(): string {
  return new Date().toISOString();
}
