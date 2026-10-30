import path from "node:path";
import { z } from "zod";
import { defineCommand } from "./registry.ts";
import { REF_PATTERN, refKey } from "./refs.ts";
import { pathExists, slugify, uniqueSlug, nowIso } from "./fs-utils.ts";
import { CoreError } from "./errors.ts";
import {
  AuthorSchema,
  FileEncodingSchema,
  FileInputSchema,
  ProjectIconFormatSchema,
  PrototypeStatusSchema,
  SlugSchema,
  SourceKindSchema,
  type Project,
  type Prototype,
  type PrototypeUrls,
  type Source,
} from "./schemas.ts";
import { AGENTS_GUIDE_RESOURCE } from "./guide.ts";
import type { Core } from "./core.ts";
import { trashCommands } from "./trash.ts";
import {
  builtinWorkspaceRoot,
  checkWorkspaceFolder,
  defaultWorkspaceRoot,
  readUserSettings,
  resolveWorkspacePath,
  userSettingsFile,
  updateUserSettings,
} from "./workspace.ts";

const IdInput = z
  .string()
  .regex(REF_PATTERN, "Use id or project/id")
  .describe("Prototype id (its folder name), or project/id when several projects have that id");
const ProjectRef = SlugSchema.describe("Project id (its folder name under projects/)");

const ProjectIconInput = z
  .object({
    format: ProjectIconFormatSchema,
    content: z.string().min(1).describe("SVG markup, or base64 data for raster formats"),
    encoding: FileEncodingSchema.optional().describe(
      "Defaults to utf8 for svg and base64 otherwise",
    ),
  })
  .describe("Project icon (square works best), shown in the app's project sidebar");

type PrototypeWithUrls = Prototype & {
  urls: PrototypeUrls;
  /** The design system it uses: its `system`, or the one inferred from its HTML or project. */
  resolvedSystem?: string;
};

function withUrls(core: Core, proto: Prototype): PrototypeWithUrls {
  const resolvedSystem = core.resolvePrototypeSystem(proto);
  return {
    ...proto,
    urls: core.prototypeUrls(refKey(proto.project, proto.id)),
    ...(resolvedSystem ? { resolvedSystem } : {}),
  };
}

function describeSource(core: Core, source: Source) {
  return { ...source, resolvedLocation: core.workspace.resolveSourceLocation(source) };
}

function describeProject(core: Core, project: Project) {
  const scope = core.projects.scope(project.id);
  return {
    ...project,
    dir: scope.dir,
    prototypes: scope.prototypes.list().length,
    systems: scope.systems.list().length,
    urls: core.projectUrls(project.id),
  };
}

function line(proto: Prototype): string {
  const bits = [
    proto.status,
    proto.group && `group:${proto.group}`,
    proto.variantOf && `variant-of:${proto.variantOf}`,
  ]
    .filter(Boolean)
    .join("  ");
  return `${refKey(proto.project, proto.id).padEnd(40)} ${proto.title}${bits ? `  (${bits})` : ""}${proto.issues?.length ? "  ⚠" : ""}`;
}

export const workspaceInfo = defineCommand({
  name: "workspace.info",
  title: "Workspace info",
  description:
    "Get an overview of the Sprue workspace: projects, reference sources (product codebases), prototype counts, groups, tags, and the app URLs. Call this first to orient yourself.",
  kind: "query",
  input: z.object({}),
  handler: (_input, core) => {
    const prototypes = core.prototypes.list();
    const config = core.workspace.config;
    return {
      root: core.workspace.root,
      projects: core.projects.list().map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        dir: core.projects.scope(p.id).dir,
      })),
      sources: config.sources.map((s) => describeSource(core, s)),
      prototypeCount: prototypes.length,
      groups: [...new Set(prototypes.flatMap((p) => (p.group ? [p.group] : [])))].sort(),
      tags: [...new Set(prototypes.flatMap((p) => p.tags))].sort(),
      urls: core.urls,
      guide: `Read the ${AGENTS_GUIDE_RESOURCE} MCP resource or ${path.join(core.workspace.root, "AGENTS.md")} for conventions.`,
    };
  },
  format: (out) =>
    [
      `Sprue  (${out.root})`,
      `${out.projects.length} project(s), ${out.prototypeCount} prototype(s), ${out.sources.length} source(s)`,
      out.projects.length ? `Projects: ${out.projects.map((p) => p.id).join(", ")}` : "",
      `App: ${out.urls.app}`,
      out.groups.length ? `Groups: ${out.groups.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
});

function describeLocation(core: Core) {
  const next = defaultWorkspaceRoot();
  return {
    /** The folder this running Sprue uses. */
    current: core.workspace.root,
    /** The folder Sprue uses the next time it starts (without --home). */
    next,
    builtin: builtinWorkspaceRoot(),
    /** Set in Settings (null: the built-in default). */
    configured: readUserSettings().workspace ?? null,
    /** $SPRUE_HOME overrides the setting. */
    env: process.env.SPRUE_HOME ? "SPRUE_HOME" : null,
    restartRequired: path.resolve(next) !== path.resolve(core.workspace.root),
    settingsFile: userSettingsFile(),
  };
}

export const workspaceLocation = defineCommand({
  name: "workspace.location",
  title: "Workspace location",
  description:
    "Where the workspace folder is: the one in use now, and the one Sprue uses next time it starts (as chosen in Settings, $SPRUE_HOME, or ~/.sprue).",
  kind: "query",
  input: z.object({}),
  handler: (_input, core) => describeLocation(core),
  format: (out) =>
    [
      `Current: ${out.current}`,
      out.restartRequired ? `Next start: ${out.next}` : "",
      out.env ? "Set by $SPRUE_HOME" : "",
    ]
      .filter(Boolean)
      .join("\n"),
});

export const workspaceSetLocation = defineCommand({
  name: "workspace.setLocation",
  title: "Set workspace location",
  description:
    "Choose the workspace folder Sprue uses from its next start: a new or empty folder, or an existing Sprue workspace. Files are not moved. Pass null to go back to ~/.sprue.",
  kind: "mutation",
  input: z.object({
    path: z
      .string()
      .min(1)
      .nullable()
      .describe("Absolute folder path (~ allowed), or null for the default ~/.sprue"),
  }),
  positional: ["path"],
  handler: async (input, core) => {
    const target = input.path === null ? null : resolveWorkspacePath(input.path);
    if (target) await checkWorkspaceFolder(target);
    const isDefault = !target || target === builtinWorkspaceRoot();
    await updateUserSettings({ workspace: isDefault ? undefined : target });
    return describeLocation(core);
  },
  format: (out) =>
    out.restartRequired ? `Sprue will use ${out.next} after a restart.` : `Using ${out.current}.`,
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
      : "No sources registered. Add one with `sp source add <location>`.",
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
      .describe("Local path (absolute, or relative to the current directory) or git URL"),
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
      location: kind === "local" ? path.resolve(input.location) : input.location,
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
    "List prototypes, newest first. Optionally filter by project, group, tag, status, or a search string.",
  kind: "query",
  input: z.object({
    project: ProjectRef.optional().describe("Only prototypes that belong to this project"),
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
    const ref = refKey(proto.project, proto.id);
    return {
      prototype: withUrls(core, proto),
      files: await core.prototypes.listFiles(ref),
      family: core.prototypes
        .family(ref)
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
    "Create a new prototype: a self-contained folder of HTML/CSS/JS served in a sandbox. Pass `html` for a single-page prototype, or `files` for multi-file prototypes. Put it in the right `project` (see project.list), use `group` to cluster explorations of the same problem, and `prototype.createVariant` for alternatives of an existing prototype. Returns the viewer URL to share with the human.",
  kind: "mutation",
  input: z.object({
    title: z.string().min(1),
    description: z.string().optional().describe("What this prototype explores and why"),
    id: SlugSchema.optional().describe("Explicit id (defaults to a slug of the title)"),
    project: ProjectRef.optional().describe(
      "Project it goes into. Required unless the workspace has exactly one project",
    ),
    framework: z
      .enum(["react"])
      .optional()
      .describe(
        "Build it with a framework against a package design system: the entry is an HTML shell loading main.tsx, which imports the system's components (`@/components/...`) and styles (`@/index.css`). Omit for plain HTML",
      ),
    system: SlugSchema.optional().describe(
      "Design system (in the same project) it uses. With a framework: the package system to build against (defaults to the project's only package system). For plain HTML: the captured system whose ../../systems/<id>/system.css and system.js it loads (inferred from the HTML when omitted). The viewer offers its themes",
    ),
    group: z.string().optional().describe("Exploration name used to group related prototypes"),
    tags: z.array(z.string()).optional(),
    status: PrototypeStatusSchema.optional(),
    variantOf: SlugSchema.optional().describe(
      "Id of the prototype (in the same project) this is a variant of",
    ),
    entry: z.string().optional().describe("Entry file (default index.html)"),
    sourceRefs: z
      .array(z.string())
      .optional()
      .describe("Ids of workspace sources this prototype draws from"),
    createdBy: AuthorSchema.optional(),
    html: z.string().optional().describe("Contents of the entry HTML file"),
    files: z.array(FileInputSchema).optional().describe("Additional files to write"),
  }),
  handler: async ({ project, ...input }, core) => {
    const projectId = core.resolveProject(project);
    const scope = core.projects.scope(projectId);
    if (input.framework) {
      input.system = core.prototypeSystem({
        id: input.id ?? input.title,
        project: projectId,
        framework: input.framework,
        ...(input.system ? { system: input.system } : {}),
      });
    } else if (input.system) {
      scope.systems.get(input.system);
    }
    return { prototype: withUrls(core, await core.prototypes.create(projectId, input)) };
  },
  format: (out) =>
    `Created ${out.prototype.id}\n  viewer: ${out.prototype.urls.viewer}\n  raw:    ${out.prototype.urls.raw}`,
});

export const prototypeUpdate = defineCommand({
  name: "prototype.update",
  title: "Update prototype",
  description:
    "Update prototype metadata (title, description, status, tags, system, group, variantOf, entry, sourceRefs), or move it to another project with `project`. Pass null to clear optional fields. Versions of a family share one title: renaming one renames all, and setting `variantOf` takes on the family's title.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: IdInput,
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: PrototypeStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    project: ProjectRef.optional().describe(
      "Move it to another project (its folder moves; links that don't hold there are dropped)",
    ),
    system: SlugSchema.nullable()
      .optional()
      .describe(
        "Design system (in its project) it uses (null to infer it from its HTML or project)",
      ),
    group: z.string().nullable().optional(),
    variantOf: SlugSchema.nullable().optional(),
    entry: z.string().optional(),
    sourceRefs: z.array(z.string()).optional(),
  }),
  handler: async ({ id, project, ...patch }, core) => {
    let proto = core.prototypes.get(id);
    if (project && project !== proto.project) {
      proto = await core.movePrototype(refKey(proto.project, proto.id), project);
    }
    const ref = refKey(proto.project, proto.id);
    if (patch.system) {
      // Framework prototypes build against it, so it must be a package system.
      if (proto.framework) core.prototypeSystem({ ...proto, system: patch.system });
      else core.projects.scope(proto.project).systems.get(patch.system);
    }
    if (!Object.values(patch).some((v) => v !== undefined))
      return { prototype: withUrls(core, proto) };
    return { prototype: withUrls(core, await core.prototypes.update(ref, patch)) };
  },
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
  handler: async (input, core) => {
    const proto = core.prototypes.get(input.id);
    const ref = refKey(proto.project, proto.id);
    return {
      file: await core.prototypes.writeFile(ref, input.path, input.content, input.encoding),
      urls: core.prototypeUrls(ref),
    };
  },
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
    "Copy an existing prototype into a new variant linked by `variantOf`, so alternatives can be compared and switched between. The variant keeps the family's title (versions are told apart as V1, V2, … Latest); describe what it changes in `description`. Then edit the variant's files with prototype.writeFile.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: IdInput.describe("Id of the prototype to copy"),
    newId: SlugSchema.optional().describe("Explicit id for the variant"),
    description: z
      .string()
      .optional()
      .describe(
        "What this variant changes. Versions share the family's title (they're told apart as V1, V2, … Latest), so this is how people tell them apart",
      ),
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
    "Move a prototype to its project's trash (projects/<project>/.trash). Recoverable by moving the folder back.",
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

export const projectList = defineCommand({
  name: "project.list",
  title: "List projects",
  description:
    "List projects: the products or efforts that prototypes and design systems belong to, with how many of each they hold.",
  kind: "query",
  input: z.object({}),
  handler: (_input, core) => ({
    projects: core.projects.list().map((p) => describeProject(core, p)),
  }),
  format: (out) =>
    out.projects.length
      ? out.projects
          .map(
            (p) =>
              `${p.id.padEnd(24)} ${p.name}  (${p.prototypes} prototypes, ${p.systems} systems)${p.issues?.length ? "  ⚠" : ""}`,
          )
          .join("\n")
      : "No projects yet. Create one with `sp project create --name <name>`.",
});

export const projectGet = defineCommand({
  name: "project.get",
  title: "Get project",
  description: "Get a project's metadata with the prototypes and design systems that belong to it.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: ProjectRef }),
  handler: (input, core) => {
    const project = core.projects.get(input.id);
    const scope = core.projects.scope(project.id);
    return {
      project: describeProject(core, project),
      prototypes: scope.prototypes.list().map((p) => withUrls(core, p)),
      systems: scope.systems
        .list()
        .map((s) => ({ id: s.id, name: s.name, description: s.description })),
    };
  },
  format: (out) =>
    [
      `${out.project.name} (${out.project.id})`,
      out.project.description ?? "",
      `app: ${out.project.urls.app}`,
      out.systems.length ? `systems: ${out.systems.map((s) => s.id).join(", ")}` : "",
      ...out.prototypes.map(line),
    ]
      .filter(Boolean)
      .join("\n"),
});

export const projectCreate = defineCommand({
  name: "project.create",
  title: "Create project",
  description:
    "Create a project: a product or effort (e.g. a web app, a marketing site). Its prototypes and design systems live in its folder (projects/<id>/), which can be its own git repo. Pass its id as `project` when creating prototypes and systems.",
  kind: "mutation",
  input: z.object({
    name: z.string().min(1),
    id: SlugSchema.optional().describe("Explicit id (defaults to a slug of the name)"),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe("Accent color for the generated icon, e.g. #5b5bd6"),
    pattern: z
      .number()
      .int()
      .min(0)
      .max(63)
      .optional()
      .describe("Abstract pattern of the generated icon (0–7 in the app)"),
    icon: ProjectIconInput.optional(),
  }),
  handler: async (input, core) => {
    const project = await core.projects.create(input);
    return { project: describeProject(core, project) };
  },
  format: (out) => `Created project ${out.project.id}\n  app: ${out.project.urls.app}`,
});

export const projectUpdate = defineCommand({
  name: "project.update",
  title: "Update project",
  description:
    "Update a project's name, description, color or icon. Pass null to clear description, color or icon. To move a prototype to another project, use prototype.update with `project`.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: ProjectRef,
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    pattern: z.number().int().min(0).max(63).nullable().optional(),
    icon: ProjectIconInput.nullable().optional(),
  }),
  handler: async ({ id, ...patch }, core) => ({
    project: describeProject(core, await core.projects.update(id, patch)),
  }),
  format: (out) => `Updated ${out.project.id}`,
});

export const projectDelete = defineCommand({
  name: "project.delete",
  title: "Delete project",
  description:
    "Move a project folder, with all its prototypes and design systems, to the workspace trash (~/.sprue/.trash). Recoverable by moving the folder back.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: ProjectRef }),
  handler: (input, core) => core.projects.delete(input.id),
  format: (out) => `Moved ${out.id} to ${out.trashedTo}`,
});

export const builtinCommands = [
  workspaceInfo,
  workspaceLocation,
  workspaceSetLocation,
  projectList,
  projectGet,
  projectCreate,
  projectUpdate,
  projectDelete,
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
  ...trashCommands,
];
