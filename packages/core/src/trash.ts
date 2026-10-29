import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Core } from "./core.ts";
import { CoreError } from "./errors.ts";
import { pathExists } from "./fs-utils.ts";
import { PROJECT_META_FILE } from "./projects.ts";
import { PROTOTYPE_META_FILE } from "./prototypes.ts";
import { defineCommand } from "./registry.ts";
import { REVIEW_META_FILE } from "./reviews.ts";
import { COMPONENT_FILE, SYSTEM_FILE } from "./systems/store.ts";

export type TrashKind = "project" | "prototype" | "system" | "review" | "component" | "unknown";

export interface TrashEntry {
  id: string;
  kind: TrashKind;
  itemId: string;
  label: string;
  project?: string;
  system?: string;
  deletedAt: string;
  restorable: boolean;
  reason?: string;
  issue?: string;
}

interface LocatedTrashEntry {
  entry: TrashEntry;
  source: string;
}

const TrashId = z.string().min(1).describe("Opaque trash entry id returned by trash.list");

function posix(relative: string): string {
  return relative.split(path.sep).join("/");
}

function parseName(
  name: string,
  prefix: string,
): { itemId: string; deletedAt: string } | undefined {
  const match = new RegExp(`^${prefix}-(.+)-(\\d{10,})$`).exec(name);
  if (!match) return undefined;
  const timestamp = Number(match[2]);
  return {
    itemId: match[1]!,
    deletedAt: Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : new Date(0).toISOString(),
  };
}

async function labelOf(
  dir: string,
  file: string,
  fallback: string,
): Promise<{ label: string; issue?: string }> {
  try {
    const value = JSON.parse(await readFile(path.join(dir, file), "utf8")) as {
      name?: unknown;
      title?: unknown;
    };
    const label =
      typeof value.name === "string"
        ? value.name
        : typeof value.title === "string"
          ? value.title
          : fallback;
    return { label };
  } catch (error) {
    return {
      label: fallback,
      issue: `Could not read ${file}: ${(error as Error).message}`,
    };
  }
}

async function directories(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function scanTrash(core: Core): Promise<LocatedTrashEntry[]> {
  const found: LocatedTrashEntry[] = [];
  for (const name of await directories(core.workspace.trashDir)) {
    const parsed = parseName(name, "project");
    const source = path.join(core.workspace.trashDir, name);
    if (!parsed) {
      const deletedAt = (await stat(source)).mtime.toISOString();
      found.push({
        source,
        entry: {
          id: posix(path.relative(core.workspace.root, source)),
          kind: "unknown",
          itemId: name,
          label: name,
          deletedAt,
          restorable: false,
          reason: "Unrecognized workspace trash folder",
        },
      });
      continue;
    }
    const label = await labelOf(source, PROJECT_META_FILE, parsed.itemId);
    found.push({
      source,
      entry: {
        id: posix(path.relative(core.workspace.root, source)),
        kind: "project",
        itemId: parsed.itemId,
        label: label.label,
        deletedAt: parsed.deletedAt,
        restorable: !core.projects.has(parsed.itemId),
        ...(core.projects.has(parsed.itemId)
          ? { reason: `Project ${JSON.stringify(parsed.itemId)} already exists` }
          : {}),
        ...(label.issue ? { issue: label.issue } : {}),
      },
    });
  }

  for (const scope of core.projects.scopes()) {
    const systemIds = scope.systems
      .list()
      .map((system) => system.id)
      .sort((a, b) => b.length - a.length);
    for (const name of await directories(scope.context.trashDir)) {
      const source = path.join(scope.context.trashDir, name);
      const id = posix(path.relative(core.workspace.root, source));
      const candidates: {
        kind: TrashKind;
        file: string;
        parsed: ReturnType<typeof parseName>;
      }[] = [
        { kind: "prototype", file: PROTOTYPE_META_FILE, parsed: parseName(name, "prototype") },
        { kind: "system", file: SYSTEM_FILE, parsed: parseName(name, "system") },
        { kind: "review", file: REVIEW_META_FILE, parsed: parseName(name, "review") },
      ];
      const matched = candidates.find((candidate) => candidate.parsed);
      if (matched?.parsed) {
        const label = await labelOf(source, matched.file, matched.parsed.itemId);
        const exists =
          matched.kind === "prototype"
            ? scope.prototypes.has(matched.parsed.itemId)
            : matched.kind === "system"
              ? scope.systems.has(matched.parsed.itemId)
              : scope.reviews.has(matched.parsed.itemId);
        found.push({
          source,
          entry: {
            id,
            kind: matched.kind,
            itemId: matched.parsed.itemId,
            label: label.label,
            project: scope.id,
            deletedAt: matched.parsed.deletedAt,
            restorable: !exists,
            ...(exists
              ? {
                  reason: `${matched.kind} ${JSON.stringify(matched.parsed.itemId)} already exists`,
                }
              : {}),
            ...(label.issue ? { issue: label.issue } : {}),
          },
        });
        continue;
      }

      const component = parseName(name, "component");
      if (component) {
        const system = systemIds.find((candidate) => component.itemId.startsWith(`${candidate}-`));
        const itemId = system ? component.itemId.slice(system.length + 1) : component.itemId;
        const label = await labelOf(source, COMPONENT_FILE, itemId);
        const target = system ? scope.systems.componentDirOf(system, itemId) : undefined;
        const exists = target ? await pathExists(target) : false;
        found.push({
          source,
          entry: {
            id,
            kind: "component",
            itemId,
            label: label.label,
            project: scope.id,
            ...(system ? { system } : {}),
            deletedAt: component.deletedAt,
            restorable: Boolean(system) && !exists,
            ...(!system
              ? { reason: "The component's design system no longer exists" }
              : exists
                ? { reason: `Component ${JSON.stringify(itemId)} already exists` }
                : {}),
            ...(label.issue ? { issue: label.issue } : {}),
          },
        });
        continue;
      }

      found.push({
        source,
        entry: {
          id,
          kind: "unknown",
          itemId: name,
          label: name,
          project: scope.id,
          deletedAt: (await stat(source)).mtime.toISOString(),
          restorable: false,
          reason: "Unrecognized project trash folder",
        },
      });
    }
  }
  return found.sort((a, b) => b.entry.deletedAt.localeCompare(a.entry.deletedAt));
}

async function locateTrash(core: Core, id: string): Promise<LocatedTrashEntry> {
  const located = (await scanTrash(core)).find((candidate) => candidate.entry.id === id);
  if (!located) throw new CoreError("NOT_FOUND", `No trash entry ${JSON.stringify(id)}`);
  return located;
}

async function restoreTrash(core: Core, id: string): Promise<TrashEntry> {
  const located = await locateTrash(core, id);
  const { entry, source } = located;
  if (!entry.restorable)
    throw new CoreError(
      "CONFLICT",
      entry.reason ?? `${entry.kind} ${JSON.stringify(entry.itemId)} cannot be restored`,
    );

  let target: string;
  if (entry.kind === "project") target = path.join(core.workspace.projectsDir, entry.itemId);
  else {
    const scope = core.projects.scope(entry.project!);
    if (entry.kind === "prototype") target = scope.prototypes.dirOf(entry.itemId);
    else if (entry.kind === "system") target = scope.systems.dirOf(entry.itemId);
    else if (entry.kind === "review") target = scope.reviews.dirOf(entry.itemId);
    else if (entry.kind === "component")
      target = scope.systems.componentDirOf(entry.system!, entry.itemId);
    else
      throw new CoreError("INVALID_INPUT", `Trash entry ${JSON.stringify(id)} is not restorable`);
  }
  if (await pathExists(target))
    throw new CoreError("CONFLICT", `${path.relative(core.workspace.root, target)} already exists`);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(source, target);

  if (entry.kind === "project") await core.reloadProject(entry.itemId);
  else {
    const scope = core.projects.scope(entry.project!);
    if (entry.kind === "prototype") {
      await scope.prototypes.reloadOne(entry.itemId);
      core.events.emit("prototype.changed", {
        project: scope.id,
        id: entry.itemId,
        exists: true,
        paths: [],
      });
    } else if (entry.kind === "system" || entry.kind === "component") {
      await scope.systems.reloadSystem(entry.kind === "system" ? entry.itemId : entry.system!);
      core.events.emit("system.changed", {
        project: scope.id,
        id: entry.kind === "system" ? entry.itemId : entry.system!,
        exists: true,
        paths: [],
      });
    } else if (entry.kind === "review") {
      await scope.reviews.reloadOne(entry.itemId);
      core.events.emit("review.changed", {
        project: scope.id,
        id: entry.itemId,
        exists: true,
      });
    }
  }
  return entry;
}

export const trashList = defineCommand({
  name: "trash.list",
  title: "List trash",
  description:
    "List soft-deleted projects, prototypes, design systems, components, and reviews, including whether each can be restored.",
  kind: "query",
  input: z.object({}),
  handler: async (_input, core) => ({
    entries: (await scanTrash(core)).map((located) => located.entry),
  }),
  format: (out) =>
    out.entries.length
      ? out.entries
          .map(
            (entry) =>
              `${entry.id.padEnd(60)} ${entry.kind.padEnd(10)} ${entry.label}${entry.restorable ? "" : ` (${entry.reason})`}`,
          )
          .join("\n")
      : "Trash is empty.",
});

export const trashRestore = defineCommand({
  name: "trash.restore",
  title: "Restore trash entry",
  description:
    "Move a soft-deleted item out of trash and reload it into Scratchpad. Fails when its original location is occupied.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: TrashId }),
  handler: async ({ id }, core) => ({ entry: await restoreTrash(core, id) }),
  format: (out) => `Restored ${out.entry.kind} ${out.entry.label}`,
});

export const trashDelete = defineCommand({
  name: "trash.delete",
  title: "Permanently delete trash entry",
  description: "Permanently delete one item from trash. This cannot be undone.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: TrashId }),
  handler: async ({ id }, core) => {
    const located = await locateTrash(core, id);
    await rm(located.source, { recursive: true, force: false });
    return { entry: located.entry };
  },
  format: (out) => `Permanently deleted ${out.entry.kind} ${out.entry.label}`,
});

export const trashCommands = [trashList, trashRestore, trashDelete];
