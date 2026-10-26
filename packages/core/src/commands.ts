import { z } from "zod";
import { defineCommand } from "./registry.ts";
import { pathExists, slugify, uniqueSlug, nowIso } from "./fs-utils.ts";
import { CoreError } from "./errors.ts";
import {
  AuthorSchema,
  FileEncodingSchema,
  FileInputSchema,
  PrototypeStatusSchema,
  SlugSchema,
  SourceKindSchema,
  type Prototype,
  type PrototypeUrls,
  type Source,
} from "./schemas.ts";
import { AGENTS_GUIDE_RESOURCE } from "./guide.ts";
import type { Core } from "./core.ts";

const IdInput = SlugSchema.describe("Prototype id (its folder name under .design/prototypes/)");

type PrototypeWithUrls = Prototype & { urls: PrototypeUrls };

function withUrls(core: Core, proto: Prototype): PrototypeWithUrls {
  return { ...proto, urls: core.prototypeUrls(proto.id) };
}

function describeSource(core: Core, source: Source) {
  return { ...source, resolvedLocation: core.workspace.resolveSourceLocation(source) };
}

function line(proto: Prototype): string {
  const bits = [
    proto.status,
    proto.group && `group:${proto.group}`,
    proto.variantOf && `variant-of:${proto.variantOf}`,
  ]
    .filter(Boolean)
    .join("  ");
  return `${proto.id.padEnd(32)} ${proto.title}${bits ? `  (${bits})` : ""}${proto.issues?.length ? "  ⚠" : ""}`;
}

export const workspaceInfo = defineCommand({
  name: "workspace.info",
  title: "Workspace info",
  description:
    "Get an overview of the design workspace: name, reference sources (product codebases), prototype counts, groups, tags, and the app URLs. Call this first to orient yourself.",
  kind: "query",
  input: z.object({}),
  handler: (_input, core) => {
    const prototypes = core.prototypes.list();
    const config = core.workspace.config;
    return {
      name: config.name,
      description: config.description,
      root: core.workspace.root,
      designDir: core.workspace.designDir,
      sources: config.sources.map((s) => describeSource(core, s)),
      prototypeCount: prototypes.length,
      groups: [...new Set(prototypes.flatMap((p) => (p.group ? [p.group] : [])))].sort(),
      tags: [...new Set(prototypes.flatMap((p) => p.tags))].sort(),
      urls: core.urls,
      guide: `Read the ${AGENTS_GUIDE_RESOURCE} MCP resource or .design/AGENTS.md for workspace conventions.`,
    };
  },
  format: (out) =>
    [
      `${out.name}  (${out.root})`,
      `${out.prototypeCount} prototype(s), ${out.sources.length} source(s)`,
      `App: ${out.urls.app}`,
      out.groups.length ? `Groups: ${out.groups.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
});

export const sourceList = defineCommand({
  name: "source.list",
  title: "List sources",
  description:
    "List reference sources: product codebases and other places to read design system, style, and component information from. Sources are read-only references; never modify them.",
  kind: "query",
  input: z.object({}),
  handler: async (_input, core) => ({
    sources: await Promise.all(
      core.workspace.config.sources.map(async (s) => ({
        ...describeSource(core, s),
        available:
          s.kind === "local"
            ? await pathExists(core.workspace.resolveSourceLocation(s))
            : undefined,
      })),
    ),
  }),
  format: (out) =>
    out.sources.length
      ? out.sources
          .map(
            (s) =>
              `${s.id.padEnd(24)} ${s.kind.padEnd(6)} ${s.resolvedLocation}${s.available === false ? "  (missing)" : ""}`,
          )
          .join("\n")
      : "No sources registered. Add one with `dt source add <location>`.",
});

export const sourceAdd = defineCommand({
  name: "source.add",
  title: "Add source",
  description:
    "Register a product codebase (local path or git URL) as a read-only reference source for design system, style, and component information.",
  kind: "mutation",
  positional: ["location"],
  input: z.object({
    location: z
      .string()
      .min(1)
      .describe("Local path (absolute or relative to the workspace root) or git URL"),
    name: z
      .string()
      .min(1)
      .optional()
      .describe("Display name (defaults to the folder or repo name)"),
    kind: SourceKindSchema.optional().describe("Defaults to 'git' for URLs and 'local' otherwise"),
    id: SlugSchema.optional(),
    notes: z.string().optional().describe("Notes for agents, e.g. where tokens or components live"),
  }),
  handler: async (input, core) => {
    const looksRemote = /^(https?:\/\/|git@|ssh:\/\/)/.test(input.location);
    const kind = input.kind ?? (looksRemote ? "git" : "local");
    const name =
      input.name ??
      input.location
        .replace(/\.git$/, "")
        .split(/[\\/:]/)
        .filter(Boolean)
        .pop() ??
      input.location;
    const taken = new Set(core.workspace.config.sources.map((s) => s.id));
    if (input.id && taken.has(input.id))
      throw new CoreError(
        "CONFLICT",
        `A source with id ${JSON.stringify(input.id)} already exists`,
      );
    const source: Source = {
      id: input.id ?? uniqueSlug(slugify(name), (c) => taken.has(c)),
      name,
      kind,
      location: input.location,
      ...(input.notes ? { notes: input.notes } : {}),
      addedAt: nowIso(),
    };
    await core.workspace.update((config) => ({ ...config, sources: [...config.sources, source] }));
    return { source: describeSource(core, source) };
  },
  format: (out) => `Added source ${out.source.id} → ${out.source.resolvedLocation}`,
});

export const sourceRemove = defineCommand({
  name: "source.remove",
  title: "Remove source",
  description: "Unregister a reference source. Does not touch the source's files.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: SlugSchema }),
  handler: async (input, core) => {
    core.workspace.getSource(input.id);
    await core.workspace.update((config) => ({
      ...config,
      sources: config.sources.filter((s) => s.id !== input.id),
    }));
    return { id: input.id, removed: true };
  },
  format: (out) => `Removed source ${out.id}`,
});

export const prototypeList = defineCommand({
  name: "prototype.list",
  title: "List prototypes",
  description:
    "List prototypes, newest first. Optionally filter by group, tag, status, or a search string.",
  kind: "query",
  input: z.object({
    group: z.string().optional(),
    tag: z.string().optional(),
    status: PrototypeStatusSchema.optional(),
    search: z.string().optional(),
  }),
  handler: (input, core) => {
    const prototypes = core.prototypes.list(input).map((p) => withUrls(core, p));
    return { prototypes, total: prototypes.length };
  },
  format: (out) =>
    out.prototypes.length ? out.prototypes.map(line).join("\n") : "No prototypes yet.",
});

export const prototypeGet = defineCommand({
  name: "prototype.get",
  title: "Get prototype",
  description: "Get a prototype's metadata, its file list, its variant family, and its URLs.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: IdInput }),
  handler: async (input, core) => {
    const proto = core.prototypes.get(input.id);
    return {
      prototype: withUrls(core, proto),
      files: await core.prototypes.listFiles(input.id),
      family: core.prototypes
        .family(input.id)
        .map((p) => ({ id: p.id, title: p.title, variantOf: p.variantOf, status: p.status })),
    };
  },
  format: (out) =>
    [
      line(out.prototype),
      out.prototype.description ?? "",
      `viewer: ${out.prototype.urls.viewer}`,
      `raw:    ${out.prototype.urls.raw}`,
      `files:  ${out.files.map((f) => f.path).join(", ")}`,
      out.family.length > 1 ? `family: ${out.family.map((f) => f.id).join(", ")}` : "",
      ...(out.prototype.issues ?? []).map((i) => `⚠ ${i}`),
    ]
      .filter(Boolean)
      .join("\n"),
});

export const prototypeCreate = defineCommand({
  name: "prototype.create",
  title: "Create prototype",
  description:
    "Create a new prototype: a self-contained folder of HTML/CSS/JS served in a sandbox. Pass `html` for a single-page prototype, or `files` for multi-file prototypes. Use `group` to cluster explorations of the same problem, and `prototype.createVariant` for alternatives of an existing prototype. Returns the viewer URL to share with the human.",
  kind: "mutation",
  input: z.object({
    title: z.string().min(1),
    description: z.string().optional().describe("What this prototype explores and why"),
    id: SlugSchema.optional().describe("Explicit id (defaults to a slug of the title)"),
    group: z.string().optional().describe("Exploration name used to group related prototypes"),
    tags: z.array(z.string()).optional(),
    status: PrototypeStatusSchema.optional(),
    variantOf: SlugSchema.optional().describe("Id of the prototype this is a variant of"),
    entry: z.string().optional().describe("Entry file (default index.html)"),
    sourceRefs: z
      .array(z.string())
      .optional()
      .describe("Ids of workspace sources this prototype draws from"),
    createdBy: AuthorSchema.optional(),
    html: z.string().optional().describe("Contents of the entry HTML file"),
    files: z.array(FileInputSchema).optional().describe("Additional files to write"),
  }),
  handler: async (input, core) => ({
    prototype: withUrls(core, await core.prototypes.create(input)),
  }),
  format: (out) =>
    `Created ${out.prototype.id}\n  viewer: ${out.prototype.urls.viewer}\n  raw:    ${out.prototype.urls.raw}`,
});

export const prototypeUpdate = defineCommand({
  name: "prototype.update",
  title: "Update prototype",
  description:
    "Update prototype metadata (title, description, status, tags, group, variantOf, entry, sourceRefs). Pass null to clear optional fields.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: IdInput,
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: PrototypeStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    group: z.string().nullable().optional(),
    variantOf: SlugSchema.nullable().optional(),
    entry: z.string().optional(),
    sourceRefs: z.array(z.string()).optional(),
  }),
  handler: async ({ id, ...patch }, core) => ({
    prototype: withUrls(core, await core.prototypes.update(id, patch)),
  }),
  format: (out) => `Updated ${out.prototype.id}`,
});

export const prototypeWriteFile = defineCommand({
  name: "prototype.writeFile",
  title: "Write prototype file",
  description:
    "Create or overwrite a file inside a prototype folder (e.g. index.html, styles.css, a second page). The viewer reloads automatically.",
  kind: "mutation",
  positional: ["id", "path"],
  input: z.object({
    id: IdInput,
    path: z.string().min(1).describe("Path relative to the prototype folder"),
    content: z.string(),
    encoding: FileEncodingSchema.default("utf8"),
  }),
  handler: async (input, core) => ({
    file: await core.prototypes.writeFile(input.id, input.path, input.content, input.encoding),
    urls: core.prototypeUrls(input.id),
  }),
  format: (out) => `Wrote ${out.file.path} (${out.file.size} bytes)`,
});

export const prototypeReadFile = defineCommand({
  name: "prototype.readFile",
  title: "Read prototype file",
  description: "Read a file from a prototype folder. Binary files are returned base64-encoded.",
  kind: "query",
  positional: ["id", "path"],
  input: z.object({
    id: IdInput,
    path: z.string().min(1),
    encoding: FileEncodingSchema.optional(),
  }),
  handler: (input, core) => core.prototypes.readFile(input.id, input.path, input.encoding),
  format: (out) => out.content,
});

export const prototypeCreateVariant = defineCommand({
  name: "prototype.createVariant",
  title: "Create variant",
  description:
    "Copy an existing prototype into a new variant linked by `variantOf`, so alternatives can be compared and switched between. Then edit the variant's files with prototype.writeFile.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: IdInput.describe("Id of the prototype to copy"),
    newId: SlugSchema.optional().describe("Explicit id for the variant"),
    title: z.string().min(1).optional(),
    description: z.string().optional().describe("What this variant changes"),
    createdBy: AuthorSchema.optional(),
  }),
  handler: async ({ id, newId, ...rest }, core) => ({
    prototype: withUrls(
      core,
      await core.prototypes.createVariant(id, { ...rest, ...(newId ? { id: newId } : {}) }),
    ),
  }),
  format: (out) =>
    `Created variant ${out.prototype.id} of ${out.prototype.variantOf}\n  viewer: ${out.prototype.urls.viewer}`,
});

export const prototypeDelete = defineCommand({
  name: "prototype.delete",
  title: "Delete prototype",
  description:
    "Move a prototype to the workspace trash (.design/.trash). Recoverable by moving the folder back.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: IdInput }),
  handler: (input, core) => core.prototypes.delete(input.id),
  format: (out) => `Moved ${out.id} to ${out.trashedTo}`,
});

export const prototypeUrls = defineCommand({
  name: "prototype.urls",
  title: "Prototype URLs",
  description: "Get the viewer URL (inside the app) and the raw sandbox URL for a prototype.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: IdInput }),
  handler: (input, core) => core.prototypeUrls(input.id),
  format: (out) => `viewer: ${out.viewer}\nraw:    ${out.raw}`,
});

export const builtinCommands = [
  workspaceInfo,
  sourceList,
  sourceAdd,
  sourceRemove,
  prototypeList,
  prototypeGet,
  prototypeCreate,
  prototypeUpdate,
  prototypeWriteFile,
  prototypeReadFile,
  prototypeCreateVariant,
  prototypeDelete,
  prototypeUrls,
];
