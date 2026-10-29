import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CoreError } from "../errors.ts";
import { FileEncodingSchema } from "../schemas.ts";
import { REF_PATTERN, refKey } from "../refs.ts";
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
  ComponentTagSchema,
  FrameworkSchema,
  LibrarySchema,
  SystemKindSchema,
  TagSchema,
  ThemeSchema,
  TokenSchema,
  TokenTypeSchema,
  VerificationSchema,
  type DesignComponent,
  type DesignSystem,
} from "./schemas.ts";

const SystemRef = z
  .string()
  .regex(REF_PATTERN, "Use id or project/id")
  .describe(
    "Design system id (its folder name under projects/<project>/systems/), or project/id when several projects have that id",
  );

/** Sandbox URL of a system's build output. */
export function systemBaseUrl(core: Core, system: { project: string; id: string }): string {
  return `${core.projectSandboxUrl(system.project)}/systems/${encodeURIComponent(system.id)}`;
}

function systemUrls(core: Core, ref: string) {
  const system = core.systems.get(ref);
  const base = systemBaseUrl(core, system);
  return {
    css: `${base}/system.css`,
    js: `${base}/system.js`,
    specimen: `${base}/specimen.html`,
    browse: `${core.urls.app}/projects/${encodeURIComponent(system.project)}/systems/${encodeURIComponent(system.id)}`,
    /** Paths to use in a prototype's entry HTML (`prototypes/<id>/index.html`) in the same project. */
    prototypeCss: `../../systems/${system.id}/system.css`,
    prototypeJs: `../../systems/${system.id}/system.js`,
  };
}

/** Where 'github' / 'claude' / a path puts skills, relative to a project folder. */
function skillsDir(projectDir: string, target: string): string {
  if (target === "github") return path.join(projectDir, ".github", "skills");
  if (target === "claude") return path.join(projectDir, ".claude", "skills");
  return path.resolve(projectDir, target);
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
    story: c.story,
    examples: c.examples.length,
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
    "List the design systems (codified component and token libraries) in this workspace, optionally only those of one project.",
  kind: "query",
  input: z.object({
    project: SystemIdSchema.optional().describe("Only systems that belong to this project"),
  }),
  handler: async (input, core) => ({
    systems: await Promise.all(
      core.systems.list(input.project).map(async (s) => {
        const ref = refKey(s.project, s.id);
        const components = core.systems.components(ref);
        return {
          id: s.id,
          project: s.project,
          name: s.name,
          description: s.description,
          sourceId: s.sourceId,
          kind: s.kind,
          framework: s.framework,
          library: s.library,
          prefix: s.prefix,
          components: components.length,
          previews: components.slice(0, 4).map((component) => ({
            name: component.name,
            title: component.title,
          })),
          tokens: (await core.systems.tokens(ref).catch(() => [])).length,
          skill: skillName(s.id),
          urls: systemUrls(core, ref),
          issues: s.issues,
        };
      }),
    ),
  }),
  format: (out) =>
    out.systems.length
      ? out.systems
          .map(
            (s) =>
              `${`${s.project}/${s.id}`.padEnd(32)} ${s.name}  (${s.components} components, ${s.tokens} tokens)`,
          )
          .join("\n")
      : "No design systems yet. Create one with `sp system create`.",
});

export const systemGet = defineCommand({
  name: "system.get",
  title: "Get design system",
  description:
    "Overview of a design system: themes, root context, how to include it in a prototype, components grouped by kind/category, token groups, notes for agents, and the last build. Start here before building a prototype with a design system.",
  kind: "query",
  positional: ["id"],
  input: z.object({ id: SystemRef }),
  handler: async ({ id: input }, core) => {
    const system = core.systems.get(input);
    const id = refKey(system.project, system.id);
    const tokens = await core.systems.tokens(id);
    const groups: Record<string, number> = {};
    for (const t of tokens) groups[t.group ?? "other"] = (groups[t.group ?? "other"] ?? 0) + 1;
    const components = core.systems.components(id).map(summarize);
    return {
      system,
      urls: systemUrls(core, id),
      include:
        system.kind === "package"
          ? `prototype.create { project: "${system.project}", framework: "react", system: "${system.id}" }\n// main.tsx\nimport "@/${(system.styles ?? "src/index.css").replace(/^src\//, "")}";`
          : `<!-- in prototypes/<id>/index.html of project ${system.project} -->\n<link rel="stylesheet" href="../../systems/${system.id}/system.css" />\n<script type="module" src="../../systems/${system.id}/system.js"></script>`,
      components,
      tokens: { total: tokens.length, groups },
      skill: skillName(system.id),
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
    .nullable()
    .optional()
    .describe("Workspace source (codebase) this system is audited from (null to unset)"),
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
  library: LibrarySchema.optional().describe("Package systems: the library it's based on"),
  styles: z
    .string()
    .optional()
    .describe(
      "Package systems: global stylesheet with the theme variables (default src/index.css)",
    ),
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
    "Create a new, empty design system. kind 'captured' (default): components codified from a running product as custom elements (follow the design-system-audit skill). kind 'package': an existing library such as shadcn/ui or Primer, configured in the system's folder (a Vite + React project scaffolded for you: package.json, vite.config.ts, src/index.css); run `npm install` there, add the library and its customizations, then describe components with stories.",
  kind: "mutation",
  input: z.object({
    id: SystemIdSchema.describe(
      "Design system id (its folder name under projects/<project>/systems/)",
    ),
    project: SystemIdSchema.optional().describe(
      "Project it goes into. Required unless the workspace has exactly one project",
    ),
    ...SystemFields,
    kind: SystemKindSchema.default("captured"),
    framework: FrameworkSchema.optional().describe("Package systems: defaults to react"),
    name: z.string().min(1),
    prefix: z
      .string()
      .regex(/^[a-z][a-z0-9]*$/)
      .optional()
      .describe("Captured systems: custom element tag prefix, e.g. 'vsc' (required)"),
    themes: z.array(ThemeSchema).min(1).optional(),
  }),
  handler: async ({ id, project, sourceId, kind, framework, prefix, themes, ...rest }, core) => {
    if (sourceId) core.workspace.getSource(sourceId);
    if (kind === "captured" && !prefix)
      throw new CoreError(
        "INVALID_INPUT",
        "Captured design systems need a tag prefix, e.g. 'acme'",
      );
    const input = {
      ...rest,
      kind,
      ...(kind === "package"
        ? { framework: framework ?? "react", styles: rest.styles ?? "src/index.css" }
        : {}),
      prefix: prefix ?? id.toLowerCase().match(/[a-z][a-z0-9]*/)?.[0] ?? "ds",
      // Package systems: shadcn-style theming, light variables on :root and dark ones under .dark.
      themes:
        themes ??
        (kind === "package"
          ? [
              { id: "light", label: "Light", kind: "light" as const, classes: "" },
              { id: "dark", label: "Dark", kind: "dark" as const, classes: "dark" },
            ]
          : [
              { id: "light", label: "Light", kind: "light" as const, classes: "" },
              { id: "dark", label: "Dark", kind: "dark" as const, classes: "" },
            ]),
      ...(sourceId ? { sourceId } : {}),
    };
    const projectId = core.resolveProject(project);
    const system = await core.systems.create(projectId, id, {
      ...input,
      defaultTheme: input.defaultTheme ?? input.themes[0]!.id,
      themeSelector: input.themeSelector ?? '[data-theme="{theme}"]',
      sheetOrder: input.sheetOrder ?? [],
      themeSheets: input.themeSheets ?? [],
      attribution: input.attribution ?? [],
    });
    return { system, urls: systemUrls(core, refKey(projectId, id)) };
  },
  format: (out) => `Created design system ${out.system.project}/${out.system.id}`,
});

export const systemUpdate = defineCommand({
  name: "system.update",
  title: "Update design system",
  description: "Update design system metadata (themes, root context, notes, attribution, …).",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: SystemRef, ...SystemFields }),
  handler: async ({ id, ...patch }, core) => {
    if (patch.sourceId) core.workspace.getSource(patch.sourceId);
    return {
      system: await core.systems.update(
        id,
        Object.fromEntries(
          Object.entries(patch)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, v === null ? undefined : v]),
        ),
      ),
    };
  },
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
      ...(out.files.includes("system.css")
        ? [
            `  system.css ${(out.css.bytes / 1024).toFixed(1)} KB (${out.css.captured} captured rules, ${out.css.duplicates} duplicates merged)`,
            `  system.js  ${(out.js.bytes / 1024).toFixed(1)} KB`,
          ]
        : [
            `  specimen   ${(out.js.bytes / 1024).toFixed(1)} KB JS, ${(out.css.bytes / 1024).toFixed(1)} KB CSS`,
          ]),
      ...out.warnings.map((w) => `  ⚠ ${w}`),
    ].join("\n"),
});

export const systemExportSkill = defineCommand({
  name: "system.exportSkill",
  title: "Export design system skill",
  description:
    "Install the generated agent skill for a design system where agents load skills: 'github' (.github/skills) or 'claude' (.claude/skills) in its project folder, or a folder path (absolute, or relative to the project folder). Builds first.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({
    id: SystemRef,
    target: z
      .string()
      .default("github")
      .describe(
        "'github', 'claude', or a folder path (absolute, or relative to the project folder)",
      ),
  }),
  handler: async ({ id, target }, core) => {
    const { scope, store, id: local } = core.systems.locate(id);
    await core.buildSystem(refKey(scope.id, local));
    const dir = skillsDir(scope.dir, target);
    const result = await exportSkill(store, local, dir);
    return { ...result, relative: path.relative(scope.dir, result.path) };
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
    tag: ComponentTagSchema.optional().describe("Or the custom element tag"),
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
    const snippet =
      sys.kind === "package"
        ? [component.import, example.trim()].filter(Boolean).join("\n\n")
        : wrapInContexts(sys, component, example);
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
    const base = `${systemBaseUrl(core, sys)}/specimen.html?component=${encodeURIComponent(component.name)}`;
    return {
      component,
      snippet,
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
  tag: ComponentTagSchema.optional(),
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
    .array(ComponentTagSchema)
    .optional()
    .describe("Context elements that must wrap this one, outermost first"),
  tokens: z.array(z.string()).optional(),
  uses: z.array(ComponentTagSchema).optional(),
  sources: z.array(SourceRefSchema).optional(),
  examples: z.array(ExampleSchema).optional(),
  references: z
    .array(ReferenceSchema)
    .optional()
    .describe("Captures to verify against: [{capture, example?, theme?, width?, root?, ignore?}]"),
  status: z.enum(["draft", "stable", "deprecated"]).optional(),
  verification: VerificationSchema.optional(),
  import: z
    .string()
    .optional()
    .describe('Package systems: import line, e.g. import { Button } from "@/components/ui/button"'),
  story: z
    .string()
    .optional()
    .describe(
      "Package systems: module (relative to the system folder, e.g. stories/button.stories.tsx) exporting one React component per example; examples[].story names the export",
    ),
  docsUrl: z.string().url().optional().describe("Official documentation for this component"),
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
    tag: ComponentTagSchema,
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

export const systemDelete = defineCommand({
  name: "system.delete",
  title: "Delete design system",
  description:
    "Move a design system folder (components, tokens, captures, build) to the workspace trash. Prototypes that include its system.css/system.js stop rendering it.",
  kind: "mutation",
  positional: ["id"],
  input: z.object({ id: SystemRef }),
  handler: async ({ id }, core) => {
    const result = await core.systems.remove(id);
    core.events.emit("system.changed", {
      project: result.project,
      id: result.id,
      exists: false,
      paths: [],
    });
    return result;
  },
  format: (out) => `Moved ${out.id} to ${out.trashedTo}`,
});

export const componentRemove = defineCommand({
  name: "component.remove",
  title: "Remove component",
  description:
    "Remove a component from a design system (moved to the workspace trash, so it's recoverable).",
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
    "Install Scratchpad's agent skills where agents load them: the 'design-system-audit' skill (how to audit a codebase into a design system) and, optionally, the generated skill of every design system in a project. Target: 'github' (.github/skills) or 'claude' (.claude/skills) in the project folder, or a folder path (absolute, or relative to the project folder).",
  kind: "mutation",
  input: z.object({
    project: SystemIdSchema.optional().describe(
      "Project whose systems to export (and where 'github'/'claude' go). Required unless there's exactly one project",
    ),
    target: z.string().default("github"),
    systems: z
      .boolean()
      .default(true)
      .describe("Also export every design system's generated skill"),
  }),
  handler: async ({ project, target, systems }, core) => {
    const scope = core.projects.scope(core.resolveProject(project));
    const dir = skillsDir(scope.dir, target);
    await atomicWrite(path.join(dir, AUDIT_SKILL_NAME, "SKILL.md"), AUDIT_SKILL);
    const installed = [AUDIT_SKILL_NAME];
    if (systems) {
      for (const system of scope.systems.list()) {
        await core.buildSystem(refKey(scope.id, system.id));
        installed.push((await exportSkill(scope.systems, system.id, dir)).name);
      }
    }
    return { dir: path.relative(scope.dir, dir) || dir, installed };
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
  systemDelete,
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
