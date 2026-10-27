import { z } from "zod";
import { ID_PATTERN } from "../schemas.ts";

export const SYSTEM_FORMAT_VERSION = 1;

export const SystemIdSchema = z
  .string()
  .regex(
    ID_PATTERN,
    "Must start with a letter or number and contain only letters, numbers, '.', '_' or '-'",
  );

/** Custom element names: lowercase, must contain a dash. */
export const TagSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/, "Must be a valid custom element name, e.g. 'vsc-button'");

/**
 * How a component is written in markup: a custom element name (captured systems, e.g. "vsc-button")
 * or a JSX component name (package systems, e.g. "Button").
 */
export const ComponentTagSchema = z
  .string()
  .regex(
    /^([a-z][a-z0-9]*(-[a-z0-9]+)+|[A-Z][A-Za-z0-9]*)$/,
    "Must be a custom element name (e.g. 'vsc-button') or a JSX component name (e.g. 'Button')",
  );

export const ComponentNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Lowercase letters, numbers and dashes");

export const ThemeKindSchema = z.enum(["light", "dark", "hc-light", "hc-dark"]);

export const ThemeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  kind: ThemeKindSchema,
  /** Classes the root context element applies for this theme (e.g. "vs-dark vscode-theme-…"). */
  classes: z.string().default(""),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const AttributionSchema = z.object({
  name: z.string(),
  license: z.string(),
  url: z.string().optional(),
  note: z.string().optional(),
});

export const CapturedFromSchema = z.object({
  product: z.string().optional(),
  version: z.string().optional(),
  commit: z.string().optional(),
  date: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

/** Contents of `.design/systems/<id>/system.json`. */
/**
 * - `captured`: components reverse-engineered from a running product into custom elements
 *   (dist/system.css + system.js, usable from plain HTML).
 * - `package`: an existing library (e.g. shadcn/ui, Primer) installed and configured in the system's
 *   folder (package.json, vite.config.ts, node_modules shared by every prototype built with it).
 */
export const SystemKindSchema = z.enum(["captured", "package"]);
export type SystemKind = z.infer<typeof SystemKindSchema>;

export const FrameworkSchema = z.enum(["react"]);
export type Framework = z.infer<typeof FrameworkSchema>;

export const LibrarySchema = z.object({
  /** Display name, e.g. "shadcn/ui". */
  name: z.string().min(1),
  /** npm package or registry it comes from, e.g. "shadcn" or "@primer/react". */
  package: z.string().optional(),
  /** Official documentation, linked from the app. */
  docsUrl: z.string().url().optional(),
});
export type Library = z.infer<typeof LibrarySchema>;

export const SystemFileSchema = z.object({
  version: z.literal(SYSTEM_FORMAT_VERSION).default(SYSTEM_FORMAT_VERSION),
  kind: SystemKindSchema.default("captured"),
  /** Package systems: the UI framework its components are written in. */
  framework: FrameworkSchema.optional(),
  /** Package systems: the library it's based on. */
  library: LibrarySchema.optional(),
  /** Package systems: the global stylesheet (theme variables), relative to the system folder. */
  styles: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Workspace source (codebase) this system was audited from. */
  sourceId: z.string().optional(),
  /** Id of the project this system belongs to. */
  project: SystemIdSchema.optional(),
  /** Custom element tag prefix, e.g. "vsc". */
  prefix: z.string().regex(/^[a-z][a-z0-9]*$/),
  themes: z.array(ThemeSchema).min(1),
  defaultTheme: z.string(),
  /**
   * The context element every component ultimately renders inside (e.g. "vsc-workbench").
   * It receives `theme="<id>"` and applies the theme's classes.
   */
  rootContext: TagSchema.optional(),
  /** CSS selector template for theme variables; `{theme}` and `{classes}` (dot-joined) are substituted. */
  themeSelector: z.string().default('[data-theme="{theme}"]'),
  /** Order of captured stylesheets (by provenance label) when merging component CSS; others sort after, alphabetically. */
  sheetOrder: z.array(z.string()).default([]),
  /**
   * Captured stylesheets whose rules carry theme-specific values (e.g. a generated color-theme
   * sheet). When pulled in through `cssCaptures`, their rules are scoped to the capture's theme,
   * and rules that only set token variables are dropped (tokens already define them).
   */
  themeSheets: z.array(z.string()).default([]),
  capturedFrom: CapturedFromSchema.optional(),
  /** Markdown notes for agents: how to run the app for capture, quirks, conventions. */
  notes: z.string().optional(),
  attribution: z.array(AttributionSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SystemFile = z.infer<typeof SystemFileSchema>;

export const SystemSchema = SystemFileSchema.extend({
  id: SystemIdSchema,
  issues: z.array(z.string()).optional(),
});
export type DesignSystem = z.infer<typeof SystemSchema>;

export const TokenTypeSchema = z.enum([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "duration",
  "shadow",
  "number",
  "other",
]);
export type TokenType = z.infer<typeof TokenTypeSchema>;

export const SourceRefSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  note: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const TokenSchema = z.object({
  /** Canonical token name, e.g. "editor.background" or "cornerRadius.large". */
  name: z.string().min(1),
  type: TokenTypeSchema,
  /** CSS custom property that carries the value, e.g. "--vscode-editor-background". */
  cssVar: z.string().regex(/^--[A-Za-z0-9_-]+$/),
  description: z.string().optional(),
  /** Resolved value per theme id. Missing themes fall back to `value`. */
  values: z.record(z.string(), z.string()).default({}),
  /** Theme-independent value (sizes, fonts, …). */
  value: z.string().optional(),
  /** Grouping for browsing, e.g. "editor", "button", "spacing". */
  group: z.string().optional(),
  source: SourceRefSchema.optional(),
  deprecated: z.boolean().optional(),
});
export type Token = z.infer<typeof TokenSchema>;
export type TokenInput = z.input<typeof TokenSchema>;

export const TokensFileSchema = z.object({
  tokens: z.array(TokenSchema).default([]),
});

export const ComponentKindSchema = z.enum(["component", "pattern", "context"]);
export type ComponentKind = z.infer<typeof ComponentKindSchema>;

export const AttributeSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.enum(["string", "boolean", "number", "enum"]),
  values: z.array(z.string()).optional(),
  default: z.string().optional(),
  description: z.string().optional(),
});

export const SlotSchema = z.object({
  /** "" for the default slot (element children). */
  name: z.string(),
  description: z.string().optional(),
});

export const StateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** How to reach it: an attribute (e.g. `disabled`), interaction (hover/focus) or context. */
  trigger: z.string().optional(),
});

export const ExampleSchema = z.object({
  title: z.string(),
  /** Markup shown with the example: HTML (captured systems) or JSX (package systems). */
  html: z.string(),
  /** Package systems: the export of the component's `story` module that renders this example. */
  story: z.string().optional(),
  description: z.string().optional(),
  /** Width of the specimen frame in CSS px. */
  width: z.number().int().positive().optional(),
});
export type ComponentExample = z.infer<typeof ExampleSchema>;

export const ReferenceSchema = z.object({
  /** Capture label (folder under captures/). */
  capture: z.string(),
  /** Example index rendered for comparison. */
  example: z.number().int().nonnegative().default(0),
  /** Theme to render in (defaults to the capture's theme). */
  theme: z.string().optional(),
  /** Width of the rendered container in px (defaults to the captured parent's width). */
  width: z.number().positive().optional(),
  /** Selector of the element in the specimen that corresponds to the captured root (defaults to the component's tag). */
  root: z.string().optional(),
  /** Class selectors (e.g. ".scrollbar") of descendants to leave out of the comparison, in the reference and the specimen. */
  ignore: z.array(z.string()).default([]),
});
export type ComponentReference = z.infer<typeof ReferenceSchema>;

export const VerificationSchema = z.object({
  status: z.enum(["verified", "drift", "unverified"]),
  checkedAt: z.string(),
  compared: z.number().int().nonnegative().optional(),
  diffs: z.number().int().nonnegative().optional(),
  theme: z.string().optional(),
  summary: z.array(z.string()).optional(),
});
export type Verification = z.infer<typeof VerificationSchema>;

/** Contents of `.design/systems/<id>/components/<name>/component.json`. */
export const ComponentFileSchema = z.object({
  tag: ComponentTagSchema,
  kind: ComponentKindSchema.default("component"),
  title: z.string().min(1),
  category: z.string().default("general"),
  description: z.string().default(""),
  /** When to use it (and when not to). Shown to agents. */
  usage: z.string().optional(),
  attributes: z.array(AttributeSchema).default([]),
  slots: z.array(SlotSchema).default([]),
  states: z.array(StateSchema).default([]),
  variants: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        html: z.string().optional(),
      }),
    )
    .default([]),
  /** Default CSS display of the host element (custom elements are inline by default). */
  hostDisplay: z.string().default("block"),
  /**
   * Native element the host stands in for (e.g. "a" or "li"). Type selectors for it in the
   * system's CSS (`.toolbar > li`) are widened at build time to also match this component.
   */
  hostTag: z
    .string()
    .regex(/^[a-z][a-z0-9]*$/)
    .optional(),
  /** Capture labels whose captured rules are part of this component's CSS (resolved at build time). */
  cssCaptures: z.array(z.string()).default([]),
  /** Context elements that must wrap this one (outermost first), e.g. ["vsc-workbench", "vsc-chat-view"]. */
  requires: z.array(ComponentTagSchema).default([]),
  /** CSS custom properties the component reads. */
  tokens: z.array(z.string()).default([]),
  /** Components this one is composed of (tags). */
  uses: z.array(ComponentTagSchema).default([]),
  sources: z.array(SourceRefSchema).default([]),
  /** Package systems: how to import it, e.g. `import { Button } from "@/components/ui/button"`. */
  import: z.string().optional(),
  /** Package systems: module with its examples as React components, relative to the system folder. */
  story: z.string().optional(),
  /** Official documentation for this component. */
  docsUrl: z.string().url().optional(),
  examples: z.array(ExampleSchema).default([]),
  /** Captured references from the real app that `capture.verify` compares the component against. */
  references: z.array(ReferenceSchema).default([]),
  status: z.enum(["draft", "stable", "deprecated"]).default("draft"),
  verification: VerificationSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ComponentFile = z.infer<typeof ComponentFileSchema>;
export type ComponentFileInput = z.input<typeof ComponentFileSchema>;

export const ComponentSchema = ComponentFileSchema.extend({
  name: ComponentNameSchema,
  system: SystemIdSchema,
  issues: z.array(z.string()).optional(),
});
export type DesignComponent = z.infer<typeof ComponentSchema>;
