import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CoreError } from "../errors.ts";
import { FileEncodingSchema } from "../schemas.ts";
import { defineCommand } from "../registry.ts";
import type { Core } from "../core.ts";
import { DIST_DIR } from "./store.ts";
import { exportSkill, skillName } from "./skill.ts";
import { AUDIT_SKILL, AUDIT_SKILL_NAME } from "./audit-skill.ts";
import { atomicWrite } from "../fs-utils.ts";
import {
  AttributeSchema,
  AttributionSchema,
  CapturedFromSchema,
  ComponentKindSchema,
  ComponentNameSchema,
  ExampleSchema,
  ReferenceSchema,
  SlotSchema,
  SourceRefSchema,
  StateSchema,
  SystemIdSchema,
  TagSchema,
  ThemeSchema,
  TokenSchema,
  TokenTypeSchema,
  VerificationSchema,
  type DesignComponent,
  type DesignSystem,
} from "./schemas.ts";

const SystemRef = SystemIdSchema.describe("Design system id (folder name under .design/systems/)");

function systemUrls(core: Core, id: string) {
  const base = `${core.urls.sandbox}/s/${encodeURIComponent(id)}`;
  return {
    css: `${base}/system.css`,
    js: `${base}/system.js`,
    specimen: `${base}/specimen.html`,
    browse: `${core.urls.app}/systems/${encodeURIComponent(id)}`,
    /** Paths to use inside prototypes (served on the same sandbox origin). */
    prototypeCss: `/s/${id}/system.css`,
    prototypeJs: `/s/${id}/system.js`,
  };
}

function summarize(c: DesignComponent) {
  const sentence = /^(.+?[.!?])(\s|$)/s.exec(c.description.trim());
  return {
    name: c.name,
    tag: c.tag,
    kind: c.kind,
    title: c.title,
    category: c.category,
    status: c.status,
    verification: c.verification?.status ?? "unverified",
    summary: (sentence ? sentence[1]! : c.description).trim(),
    requires: c.requires,
    uses: c.uses,
    issues: c.issues,
  };
}

function wrapInContexts(system: DesignSystem, c: DesignComponent, html: string): string {
  const contexts = [...c.requires];
  if (system.rootContext && c.tag !== system.rootContext && !contexts.includes(system.rootContext))
    contexts.unshift(system.rootContext);
  let out = html.trim();
  for (const tag of [...contexts].reverse()) {
    if (new RegExp(`<${tag}[\\s>/]`).test(out)) continue;
    const attrs = tag === system.rootContext ? ` theme="${system.defaultTheme}"` : "";
    out = `<${tag}${attrs}>\n  ${out.replace(/\n/g, "\n  ")}\n</${tag}>`;
  }
  return out;
}

export const systemList = defineCommand({
  name: "system.list",
  title: "List design systems",
  description:
    "List the design systems (codified component and token libraries) in this workspace.",
  kind: "query",
  input: z.object({}),
  handler: async (_input, core) => ({
    systems: await Promise.all(
      core.systems.list().map(async (s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        sourceId: s.sourceId,
        prefix: s.prefix,
        components: core.systems.components(s.id).length,
        tokens: (await core.systems.tokens(s.id).catch(() => [])).length,
        skill: skillName(s.id),
        urls: systemUrls(core, s.id),
        issues: s.issues,
      })),
    ),
  }),
  format: (out) =>
    out.systems.length
      ? out.systems
          .map(
            (s) => `${s.id.padEnd(20)} ${s.name}  (${s.components} components, ${s.tokens} tokens)`,
          )
          .join("\n")
      : "No design systems yet. Create one with `dt system create`.",
});

export const systemGet = defineCommand({
  name: "system.get",
  title: "Get design system",
  description:
    "Overview of a design system: themes, root context, how to include it in a prototype, components grouped by kind/category, token groups, notes for agents, and the last build. Start here before building a prototype with a design system.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: SystemRef }),
  handler: async ({ id }, core) => {
    const system = core.systems.get(id);
    const tokens = await core.systems.tokens(id);
    const groups: Record<string, number> = {};
    for (const t of tokens) groups[t.group ?? "other"] = (groups[t.group ?? "other"] ?? 0) + 1;
    const components = core.systems.components(id).map(summarize);
    return {
      system,
      urls: systemUrls(core, id),
      include: `<link rel="stylesheet" href="/s/${id}/system.css" />\n<script type="module" src="/s/${id}/system.js"></script>`,
      components,
      tokens: { total: tokens.length, groups },
      skill: skillName(id),
      lastBuild: core.lastBuild(id),
    };
  },
  format: (out) =>
    [
      `${out.system.name} (${out.system.id})${out.system.description ? `\n${out.system.description}` : ""}`,
      `Themes: ${out.system.themes.map((t) => t.id).join(", ")}  ·  root: ${out.system.rootContext ?? "-"}`,
      `${out.components.length} components, ${out.tokens.total} tokens`,
      ...out.components.map(
        (c) =>
          `  <${c.tag}>`.padEnd(34) +
          `${c.kind.padEnd(10)} ${c.verification.padEnd(10)} ${c.title}`,
      ),
      `Browse: ${out.urls.browse}`,
    ].join("\n"),
});

const SystemFields = {
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sourceId: z
    .string()
    .optional()
    .describe("Workspace source (codebase) this system is audited from"),
  prefix: z
    .string()
    .regex(/^[a-z][a-z0-9]*$/)
    .optional()
    .describe("Custom element tag prefix, e.g. 'vsc'"),
  themes: z.array(ThemeSchema).min(1).optional(),
  defaultTheme: z.string().optional(),
  rootContext: TagSchema.optional().describe(
    "Context element that wraps everything and applies the theme, e.g. 'vsc-workbench'",
  ),
  themeSelector: z
    .string()
    .optional()
    .describe(
      "Selector template for themed token values; {theme} = theme id, {classes} = the theme's classes dot-joined",
    ),
  sheetOrder: z
    .array(z.string())
    .optional()
    .describe("Captured stylesheet labels in cascade order"),
  themeSheets: z
    .array(z.string())
    .optional()
    .describe(
      "Captured stylesheets holding theme-specific rules (e.g. a generated color-theme sheet); their rules are scoped to the capture's theme",
    ),
  capturedFrom: CapturedFromSchema.optional(),
  notes: z
    .string()
    .optional()
    .describe("Markdown notes for agents (how to run the app for capture, conventions, gaps)"),
  attribution: z.array(AttributionSchema).optional(),
};

export const systemCreate = defineCommand({
  name: "system.create",
  title: "Create design system",
  description:
    "Create a new, empty design system (tokens + components library) for a source codebase.",
  kind: "mutation",
  input: z.object({
    id: SystemRef,
    ...SystemFields,
    name: z.string().min(1),
    prefix: z.string().regex(/^[a-z][a-z0-9]*$/),
    themes: z
      .array(ThemeSchema)
      .min(1)
      .default([
        { id: "light", label: "Light", kind: "light", classes: "" },
        { id: "dark", label: "Dark", kind: "dark", classes: "" },
      ]),
  }),
  handler: async ({ id, ...input }, core) => {
    if (input.sourceId) core.workspace.getSource(input.sourceId);
    const system = await core.systems.create(id, {
      ...input,
      defaultTheme: input.defaultTheme ?? input.themes[0]!.id,
      themeSelector: input.themeSelector ?? '[data-theme="{theme}"]',
      sheetOrder: input.sheetOrder ?? [],
      themeSheets: input.themeSheets ?? [],
      attribution: input.attribution ?? [],
    });
    return { system, urls: systemUrls(core, id) };
  },
  format: (out) => `Created design system ${out.system.id}`,
});

export const systemUpdate = defineCommand({
  name: "system.update",
  title: "Update design system",
  description: "Update design system metadata (themes, root context, notes, attribution, …).",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: SystemRef, ...SystemFields }),
  handler: async ({ id, ...patch }, core) => ({
    system: await core.systems.update(
      id,
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    ),
  }),
  format: (out) => `Updated ${out.system.id}`,
});

export const systemBuild = defineCommand({
  name: "system.build",
  title: "Build design system",
  description:
    "Compile a design system: dist/system.css (tokens per theme + component CSS in cascade order), dist/system.js (custom elements), catalog and specimen page, and regenerate its agent skill. Returns warnings (e.g. CSS variables used but not defined as tokens). Runs automatically when system files change while the server is running.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: SystemRef }),
  handler: ({ id }, core) => core.buildSystem(id),
  format: (out) =>
    [
      `Built ${out.system}: ${out.components} components, ${out.tokens} tokens`,
      `  system.css ${(out.css.bytes / 1024).toFixed(1)} KB (${out.css.captured} captured rules, ${out.css.duplicates} duplicates merged)`,
      `  system.js  ${(out.js.bytes / 1024).toFixed(1)} KB`,
      ...out.warnings.map((w) => `  ⚠ ${w}`),
    ].join("\n"),
});

export const systemExportSkill = defineCommand({
  name: "system.exportSkill",
  title: "Export design system skill",
  description:
    "Install the generated agent skill for a design system where agents load skills: 'github' (.github/skills), 'claude' (.claude/skills), or a folder path relative to the workspace root. Builds first.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: SystemRef,
    target: z
      .string()
      .default("github")
      .describe("'github', 'claude', or a folder path relative to the workspace root"),
  }),
  handler: async ({ id, target }, core) => {
    await core.buildSystem(id);
    const dir =
      target === "github"
        ? path.join(core.workspace.root, ".github", "skills")
        : target === "claude"
          ? path.join(core.workspace.root, ".claude", "skills")
          : path.resolve(core.workspace.root, target);
    const result = await exportSkill(core.systems, id, dir);
    return { ...result, relative: path.relative(core.workspace.root, result.path) };
  },
  format: (out) => `Exported skill ${out.name} → ${out.relative || out.path}`,
});

export const systemWriteFile = defineCommand({
  name: "system.writeFile",
  title: "Write design system file",
  description:
    "Write a system-level file such as base.css (global styles, @font-face) or assets/<font or icon file>. Use base64 for binary files.",
  kind: "mutation",
  positional: ["id", "path"],
  input: z.object({
    id: SystemRef,
    path: z.string().min(1),
    content: z.string(),
    encoding: FileEncodingSchema.default("utf8"),
  }),
  handler: ({ id, path: rel, content, encoding }, core) =>
    core.systems.writeFile(id, rel, content, encoding),
  format: (out) => `Wrote ${out.path} (${out.size} bytes)`,
});

export const systemCoverage = defineCommand({
  name: "system.coverage",
  title: "Design system coverage",
  description:
    "Audit progress: components by kind, status and verification, token counts by type and group, and build warnings.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: SystemRef }),
  handler: async ({ id }, core) => {
    const components = core.systems.components(id);
    const tokens = await core.systems.tokens(id);
    const count = <T>(items: T[], key: (item: T) => string) =>
      items.reduce<Record<string, number>>(
        (acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }),
        {},
      );
    return {
      components: {
        total: components.length,
        byKind: count(components, (c) => c.kind),
        byStatus: count(components, (c) => c.status),
        byVerification: count(components, (c) => c.verification?.status ?? "unverified"),
        unverified: components
          .filter((c) => c.verification?.status !== "verified")
          .map((c) => c.tag),
        withoutExamples: components.filter((c) => !c.examples.length).map((c) => c.tag),
      },
      tokens: {
        total: tokens.length,
        byType: count(tokens, (t) => t.type),
        withoutDescription: tokens.filter((t) => !t.description).length,
      },
      lastBuild: core.lastBuild(id),
    };
  },
  format: (out) =>
    [
      `Components: ${out.components.total} ${JSON.stringify(out.components.byVerification)}`,
      `Tokens: ${out.tokens.total} ${JSON.stringify(out.tokens.byType)}`,
      out.components.unverified.length ? `Unverified: ${out.components.unverified.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
});

export const tokenSearch = defineCommand({
  name: "token.search",
  title: "Search tokens",
  description:
    "Search a design system's tokens (CSS custom properties) by words in the name, variable or description, optionally filtered by type or group. Returns per-theme values. Use to style custom parts of a prototype with the system's real tokens.",
  kind: "query",
  positional: ["system", "query"],
  input: z.object({
    system: SystemRef,
    query: z.string().optional().describe("Words to match, e.g. 'button background'"),
    type: TokenTypeSchema.optional(),
    group: z.string().optional(),
    limit: z.number().int().positive().max(10000).default(40),
    offset: z.number().int().nonnegative().default(0),
  }),
  handler: ({ system, ...query }, core) => core.systems.searchTokens(system, query),
  format: (out) =>
    `${out.tokens.map((t) => `${t.cssVar.padEnd(48)} ${t.type.padEnd(9)} ${Object.values(t.values).join(" / ") || t.value || ""}`).join("\n")}\n${out.total} match(es)`,
});

export const tokenImport = defineCommand({
  name: "token.import",
  title: "Import tokens",
  description:
    "Add or update tokens in bulk (matched by name). In 'merge' mode, fields you pass override existing ones and per-theme values are merged, so runtime values (from capture) and source metadata (descriptions, source locations) can be imported separately.",
  kind: "mutation",
  positional: ["system"],
  input: z.object({
    system: SystemRef,
    tokens: z.array(
      TokenSchema.partial({ values: true }).extend({ type: TokenTypeSchema, cssVar: z.string() }),
    ),
    mode: z.enum(["merge", "replace"]).default("merge"),
  }),
  handler: ({ system, tokens, mode }, core) => core.systems.importTokens(system, tokens, mode),
  format: (out) => `Tokens: ${out.added} added, ${out.updated} updated, ${out.total} total`,
});

const ComponentRef = {
  system: SystemRef,
  name: ComponentNameSchema.describe("Component name (folder name), e.g. 'button'"),
};

export const componentList = defineCommand({
  name: "component.list",
  title: "List components",
  description:
    "List a design system's components (tag, kind, category, one-line summary, verification status, required context).",
  kind: "query",
  positional: ["system"],
  input: z.object({
    system: SystemRef,
    kind: ComponentKindSchema.optional(),
    category: z.string().optional(),
  }),
  handler: ({ system, kind, category }, core) => ({
    components: core.systems
      .components(system)
      .filter((c) => (!kind || c.kind === kind) && (!category || c.category === category))
      .map(summarize),
  }),
  format: (out) =>
    out.components
      .map(
        (c) => `<${c.tag}>`.padEnd(32) + `${c.kind.padEnd(10)} ${c.category.padEnd(12)} ${c.title}`,
      )
      .join("\n"),
});

export const componentSearch = defineCommand({
  name: "component.search",
  title: "Search components",
  description:
    "Find design-system components by what they are or do (e.g. 'dropdown', 'send button', 'file attachment'). Returns summaries; use component.get for the full API and examples.",
  kind: "query",
  positional: ["system", "query"],
  input: z.object({
    system: SystemRef,
    query: z.string(),
    kind: ComponentKindSchema.optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  handler: ({ system, query, kind, limit }, core) => ({
    components: core.systems.searchComponents(system, { query, kind, limit }).map(summarize),
  }),
  format: (out) =>
    out.components.map((c) => `<${c.tag}>`.padEnd(32) + c.summary).join("\n") || "No matches.",
});

export const componentGet = defineCommand({
  name: "component.get",
  title: "Get component",
  description:
    "Full API of a design-system component: attributes, slots, states, required context, tokens, examples, a ready-to-paste usage snippet (already wrapped in its required context), source references and verification status.",
  kind: "query",
  positional: ["system", "name"],
  input: z.object({
    system: SystemRef,
    name: z.string().optional().describe("Component name"),
    tag: TagSchema.optional().describe("Or the custom element tag"),
    includeCode: z.boolean().default(false).describe("Include component.css and component.js"),
  }),
  handler: async ({ system, name, tag, includeCode }, core) => {
    const sys = core.systems.get(system);
    const component = name
      ? core.systems.component(system, name)
      : tag
        ? core.systems.componentByTag(system, tag)
        : undefined;
    if (!component)
      throw new CoreError("NOT_FOUND", `No component ${JSON.stringify(name ?? tag)} in ${system}`);
    const example = component.examples[0]?.html ?? `<${component.tag}></${component.tag}>`;
    const files = await core.systems.componentFiles(system, component.name);
    const code = includeCode
      ? {
          css:
            (
              await core.systems.readComponentFile(system, component.name, "component.css")
            )?.toString("utf8") ?? "",
          js:
            (
              await core.systems.readComponentFile(system, component.name, "component.js")
            )?.toString("utf8") ?? "",
        }
      : undefined;
    const base = `${core.urls.sandbox}/s/${encodeURIComponent(system)}/specimen.html?component=${encodeURIComponent(component.name)}`;
    return {
      component,
      snippet: wrapInContexts(sys, component, example),
      specimens: sys.themes.map((t) => ({ theme: t.id, url: `${base}&theme=${t.id}` })),
      files,
      ...(code ? { code } : {}),
    };
  },
  format: (out) =>
    [
      `<${out.component.tag}> ${out.component.title}`,
      out.component.description,
      "",
      out.snippet,
    ].join("\n"),
});

const ComponentFields = {
  tag: TagSchema.optional(),
  kind: ComponentKindSchema.optional(),
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  usage: z.string().optional(),
  attributes: z.array(AttributeSchema).optional(),
  slots: z.array(SlotSchema).optional(),
  states: z.array(StateSchema).optional(),
  variants: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        html: z.string().optional(),
      }),
    )
    .optional(),
  hostDisplay: z
    .string()
    .optional()
    .describe(
      "CSS display of the host element (default block; 'contents' when the host wraps a native root)",
    ),
  hostTag: z
    .string()
    .regex(/^[a-z][a-z0-9]*$/)
    .optional()
    .describe(
      "Native element the host stands in for (the captured root's tag, e.g. 'a' or 'li'); type selectors like '.toolbar > li' are widened at build time to match this component",
    ),
  cssCaptures: z
    .array(z.string())
    .optional()
    .describe(
      "Capture labels whose captured rules form this component's CSS (pulled in at build time, so no need to paste them into component.css). List every theme's capture.",
    ),
  requires: z
    .array(TagSchema)
    .optional()
    .describe("Context elements that must wrap this one, outermost first"),
  tokens: z.array(z.string()).optional(),
  uses: z.array(TagSchema).optional(),
  sources: z.array(SourceRefSchema).optional(),
  examples: z.array(ExampleSchema).optional(),
  references: z
    .array(ReferenceSchema)
    .optional()
    .describe("Captures to verify against: [{capture, example?, theme?, width?, root?, ignore?}]"),
  status: z.enum(["draft", "stable", "deprecated"]).optional(),
  verification: VerificationSchema.optional(),
};

const defined = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const componentCreate = defineCommand({
  name: "component.create",
  title: "Create component",
  description:
    "Add a component (or pattern/context) to a design system. Provide metadata, its CSS (cssCaptures = capture labels whose captured rules to include; css = extra component.css, annotated with /* @capture <sheet>@<path> */ when copied from captures) and component.js (a light-DOM custom element extending ds.Element whose host is the captured root element).",
  kind: "mutation",
  input: z.object({
    ...ComponentRef,
    ...ComponentFields,
    tag: TagSchema,
    title: z.string().min(1),
    css: z.string().optional().describe("Contents of component.css"),
    js: z.string().optional().describe("Contents of component.js"),
  }),
  handler: async ({ system, name, css, js, ...input }, core) => ({
    component: await core.systems.createComponent(system, name, defined(input) as typeof input, {
      css,
      js,
    }),
  }),
  format: (out) => `Created <${out.component.tag}> (${out.component.name})`,
});

export const componentUpdate = defineCommand({
  name: "component.update",
  title: "Update component",
  description:
    "Update a component's metadata (attributes, states, examples, requires, status, verification, …).",
  kind: "mutation",
  positional: ["system", "name"],
  input: z.object({ ...ComponentRef, ...ComponentFields }),
  handler: async ({ system, name, ...patch }, core) => ({
    component: await core.systems.updateComponent(system, name, defined(patch)),
  }),
  format: (out) => `Updated <${out.component.tag}>`,
});

export const componentWriteFile = defineCommand({
  name: "component.writeFile",
  title: "Write component file",
  description:
    "Write component.css, component.js, or reference files (reference/*.json|png|html) for a component.",
  kind: "mutation",
  positional: ["system", "name", "path"],
  input: z.object({
    ...ComponentRef,
    path: z.string().min(1),
    content: z.string(),
    encoding: FileEncodingSchema.default("utf8"),
  }),
  handler: ({ system, name, path: rel, content, encoding }, core) =>
    core.systems.writeComponentFile(system, name, rel, content, encoding),
  format: (out) => `Wrote ${out.path} (${out.size} bytes)`,
});

export const componentReadFile = defineCommand({
  name: "component.readFile",
  title: "Read component file",
  description: "Read a file from a component folder (component.css, component.js, reference/…).",
  kind: "query",
  positional: ["system", "name", "path"],
  input: z.object({ ...ComponentRef, path: z.string().min(1) }),
  handler: async ({ system, name, path: rel }, core) => {
    const data = await core.systems.readComponentFile(system, name, rel);
    if (!data) throw new CoreError("NOT_FOUND", `No file ${rel} in component ${name}`);
    const text = /\.(css|js|json|html|md|txt|svg)$/i.test(rel);
    return {
      path: rel,
      encoding: text ? "utf8" : "base64",
      content: data.toString(text ? "utf8" : "base64"),
      size: data.byteLength,
    };
  },
  format: (out) => out.content,
});

export const componentRemove = defineCommand({
  name: "component.remove",
  title: "Remove component",
  description: "Delete a component from a design system.",
  kind: "mutation",
  positional: ["system", "name"],
  input: z.object(ComponentRef),
  handler: ({ system, name }, core) => core.systems.removeComponent(system, name),
  format: (out) => `Removed ${out.name}`,
});

export const skillsInstall = defineCommand({
  name: "skills.install",
  title: "Install agent skills",
  description:
    "Install design-tool's agent skills where agents load them: the 'design-system-audit' skill (how to audit a codebase into a design system) and, optionally, the generated skill of every design system in the workspace. Target: 'github' (.github/skills), 'claude' (.claude/skills), or a folder path.",
  kind: "mutation",
  input: z.object({
    target: z.string().default("github"),
    systems: z
      .boolean()
      .default(true)
      .describe("Also export every design system's generated skill"),
  }),
  handler: async ({ target, systems }, core) => {
    const dir =
      target === "github"
        ? path.join(core.workspace.root, ".github", "skills")
        : target === "claude"
          ? path.join(core.workspace.root, ".claude", "skills")
          : path.resolve(core.workspace.root, target);
    await atomicWrite(path.join(dir, AUDIT_SKILL_NAME, "SKILL.md"), AUDIT_SKILL);
    const installed = [AUDIT_SKILL_NAME];
    if (systems) {
      for (const system of core.systems.list()) {
        await core.buildSystem(system.id);
        installed.push((await exportSkill(core.systems, system.id, dir)).name);
      }
    }
    return { dir: path.relative(core.workspace.root, dir) || dir, installed };
  },
  format: (out) => `Installed ${out.installed.join(", ")} → ${out.dir}`,
});

export const systemActivity = defineCommand({
  name: "system.activity",
  title: "Design system activity",
  description:
    "Recent audit activity for a design system, newest first: captures, token imports, component edits, verifications and builds (from any process: agents, CLI, scripts).",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: SystemRef, limit: z.number().int().positive().max(1000).default(200) }),
  handler: async ({ id, limit }, core) => ({ entries: await core.systems.activity(id, limit) }),
  format: (out) =>
    out.entries
      .map(
        (e) =>
          `${e.at.slice(11, 19)}  ${e.kind.padEnd(9)} ${e.title}${e.detail ? ` — ${e.detail.split("\n")[0]}` : ""}`,
      )
      .join("\n") || "No activity yet",
});

interface StoredCaptureMeta {
  label?: string;
  url?: string;
  selector?: string;
  theme?: string;
  state?: string;
  capturedAt?: string;
  rect?: { w: number; h: number };
  parentWidth?: number;
  scale?: number;
  ancestors?: { tag: string; classes: string }[];
}

export const captureList = defineCommand({
  name: "capture.list",
  title: "List captures",
  description:
    "Captured reference elements of a design system with their selector, theme, size, rule and element counts, and the components that use them (as CSS source or verification reference).",
  kind: "query",
  positional: ["system"],
  input: z.object({ system: SystemRef }),
  handler: async ({ system }, core) => {
    const components = core.systems.components(system);
    const captures = [];
    for (const label of await core.systems.listCaptures(system)) {
      const dir = core.systems.captureDirOf(system, label);
      const read = (file: string) => readFile(path.join(dir, file), "utf8").catch(() => undefined);
      const meta = JSON.parse((await read("capture.json")) ?? "{}") as StoredCaptureMeta;
      const rules = (await read("rules.css"))?.match(/@capture /g)?.length ?? 0;
      const geometry = JSON.parse((await read("geometry.json")) ?? "[]") as { hidden?: boolean }[];
      captures.push({
        label,
        selector: meta.selector ?? "",
        theme: meta.theme,
        state: meta.state,
        capturedAt: meta.capturedAt,
        width: meta.rect?.w,
        height: meta.rect?.h,
        parentWidth: meta.parentWidth,
        scale: meta.scale ?? 1,
        rules,
        elements: geometry.filter((g) => !g.hidden).length,
        context: (meta.ancestors ?? [])
          .slice(0, 4)
          .map((a) => a.classes.trim().split(/\s+/)[0] || a.tag)
          .reverse()
          .join(" › "),
        usedBy: components
          .filter(
            (c) => c.cssCaptures.includes(label) || c.references.some((r) => r.capture === label),
          )
          .map((c) => ({
            name: c.name,
            tag: c.tag,
            as: [
              ...(c.cssCaptures.includes(label) ? ["css"] : []),
              ...(c.references.some((r) => r.capture === label) ? ["reference"] : []),
            ],
          })),
      });
    }
    return { captures };
  },
  format: (out) =>
    out.captures
      .map(
        (c) =>
          `${c.label.padEnd(30)} ${Math.round(c.width ?? 0)}×${Math.round(c.height ?? 0)}  ${c.rules} rules  ${c.usedBy.map((u) => u.tag).join(", ")}`,
      )
      .join("\n") || "No captures yet",
});

export const systemCommands = [
  systemList,
  systemGet,
  systemActivity,
  captureList,
  systemCreate,
  systemUpdate,
  systemBuild,
  systemExportSkill,
  systemWriteFile,
  systemCoverage,
  tokenSearch,
  tokenImport,
  componentList,
  componentSearch,
  componentGet,
  componentCreate,
  componentUpdate,
  componentWriteFile,
  componentReadFile,
  componentRemove,
  skillsInstall,
];

export { DIST_DIR };
