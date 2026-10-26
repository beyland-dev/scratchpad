import { z } from "zod";

export const WORKSPACE_FORMAT_VERSION = 1;

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
  /** Local path (absolute or relative to the workspace root) or git URL. */
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

export const WorkspaceConfigSchema = z.object({
  version: z.literal(WORKSPACE_FORMAT_VERSION),
  name: z.string().min(1),
  description: z.string().optional(),
  sources: z.array(SourceSchema).default([]),
  server: ServerSettingsSchema.optional(),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

export const PrototypeStatusSchema = z.enum(["draft", "review", "approved", "archived"]);
export type PrototypeStatus = z.infer<typeof PrototypeStatusSchema>;

export const AuthorSchema = z.object({
  kind: z.enum(["agent", "human"]),
  name: z.string().optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

/** Contents of `.design/prototypes/<id>/prototype.json`. */
export const PrototypeFileSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: PrototypeStatusSchema.default("draft"),
  tags: z.array(z.string()).default([]),
  /** Free-form exploration name used to group related prototypes. */
  group: z.string().optional(),
  /** Id of the prototype this one is a variant of. */
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

export interface PrototypeUrls {
  viewer: string;
  raw: string;
}
