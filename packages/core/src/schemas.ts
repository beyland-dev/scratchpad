import { z } from "zod";

export const WORKSPACE_FORMAT_VERSION = 2;

/** Ids are folder names, so keep them URL- and filesystem-safe. */
export const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

export const SlugSchema = z
  .string()
  .regex(
    ID_PATTERN,
    "Must start with a letter or number and contain only letters, numbers, '.', '_' or '-' (max 100 chars)",
  );

export const SourceKindSchema = z.enum(["local", "git"]);

/**
 * A product codebase (or other reference) used as read-only source of truth
 * for design system, style, and component information.
 */
export const SourceSchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  kind: SourceKindSchema,
  /** Absolute local path or git URL. */
  location: z.string().min(1),
  notes: z.string().optional(),
  addedAt: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ServerSettingsSchema = z.object({
  port: z.number().int().positive().optional(),
  sandboxPort: z.number().int().positive().optional(),
  host: z.string().optional(),
});
export type ServerSettings = z.infer<typeof ServerSettingsSchema>;

/** Contents of `~/.scratchpad/config.json`: machine-local settings, never committed. */
export const WorkspaceConfigSchema = z.object({
  version: z.literal(WORKSPACE_FORMAT_VERSION),
  sources: z.array(SourceSchema).default([]),
  server: ServerSettingsSchema.optional(),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

/** Contents of `projects/<id>/project.json`. A project is a product or effort; its prototypes,
 * design systems and reviews live in its folder, which can be its own git repo. */
export const ProjectFileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  /** Accent color for the project's generated icon, e.g. "#5b5bd6". */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #5b5bd6")
    .optional(),
  /** Which abstract pattern the generated icon uses (when there's no icon file). */
  pattern: z.number().int().min(0).max(63).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const ProjectSchema = ProjectFileSchema.extend({
  id: SlugSchema,
  /** File name of the project's icon (e.g. "icon.svg") when it has one. */
  icon: z.string().optional(),
  /** Problems found while loading (e.g. missing or invalid project.json). */
  issues: z.array(z.string()).optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectIconFormatSchema = z.enum(["svg", "png", "webp", "jpg"]);
export type ProjectIconFormat = z.infer<typeof ProjectIconFormatSchema>;

export const PrototypeStatusSchema = z.enum(["draft", "review", "approved", "archived"]);
export type PrototypeStatus = z.infer<typeof PrototypeStatusSchema>;

export const AuthorSchema = z.object({
  kind: z.enum(["agent", "human"]),
  name: z.string().optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

/** Contents of `projects/<project>/prototypes/<id>/prototype.json`. */
export const PrototypeFileSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: PrototypeStatusSchema.default("draft"),
  tags: z.array(z.string()).default([]),
  /**
   * Built with a framework (bundled by the design system's Vite on demand) instead of served as
   * plain files. The entry stays an HTML shell that loads e.g. main.tsx.
   */
  framework: z.enum(["react"]).optional(),
  /**
   * Design system it uses. Framework prototypes build against this package system (its
   * components, styles and node_modules); plain HTML prototypes load this system's system.css and
   * system.js. The viewer offers the system's themes. When unset, it's inferred.
   */
  system: SlugSchema.optional(),
  /** Free-form exploration name used to group related prototypes. */
  group: z.string().optional(),
  /** Id of the prototype (in the same project) this one is a variant of. */
  variantOf: SlugSchema.optional(),
  /** Entry file, relative to the prototype folder. */
  entry: z.string().default("index.html"),
  createdBy: AuthorSchema.optional(),
  /** Ids of workspace sources this prototype draws from. */
  sourceRefs: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PrototypeFile = z.infer<typeof PrototypeFileSchema>;

export const PrototypeSchema = PrototypeFileSchema.extend({
  id: SlugSchema,
  /** The project whose folder it lives in. */
  project: SlugSchema,
  /** Problems found while loading (e.g. missing or invalid prototype.json). */
  issues: z.array(z.string()).optional(),
});
export type Prototype = z.infer<typeof PrototypeSchema>;

export const PrototypeFileEntrySchema = z.object({
  path: z.string(),
  size: z.number(),
});
export type PrototypeFileEntry = z.infer<typeof PrototypeFileEntrySchema>;

export const FileEncodingSchema = z.enum(["utf8", "base64"]);
export type FileEncoding = z.infer<typeof FileEncodingSchema>;

export const FileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("Path relative to the prototype folder, e.g. 'index.html' or 'assets/app.css'"),
  content: z.string().describe("File contents"),
  encoding: FileEncodingSchema.default("utf8").describe(
    "Use 'base64' for binary files such as images",
  ),
});
export type FileInput = z.input<typeof FileInputSchema>;

export interface WorkspaceUrls {
  app: string;
  sandbox: string;
}

export interface ProjectUrls {
  /** The project's page in the app. */
  app: string;
  /** The icon, served from the sandbox origin (icons are untrusted files). */
  icon?: string;
}

export interface PrototypeUrls {
  viewer: string;
  raw: string;
}
