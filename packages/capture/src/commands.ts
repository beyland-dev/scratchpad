/// <reference lib="dom" />
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  CoreError,
  defineCommand,
  type Core,
  type TokenInput,
  type TokenType,
} from "@design-tool/core";
import { installBrowser, settle, TargetSchema, withPage } from "./browser.ts";
import {
  captureElement,
  describeDiffs,
  storeCapture,
  verifyComponent,
  DEFAULT_STATE_CLASSES,
} from "./capture.ts";
import { outlineElement, readCustomProperties } from "./extract.ts";

const png = (data: Buffer) => ({ mimeType: "image/png", data: data.toString("base64") });

export function inferTokenType(name: string, value: string): TokenType {
  const v = value.trim();
  if (
    /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color\(|color-mix\(|transparent$|currentcolor$)/i.test(
      v,
    )
  )
    return "color";
  if (
    /font-?family/i.test(name) ||
    (/(^|,\s*)(["']?[A-Z][\w ]+["']?|system-ui|sans-serif|monospace|serif)\s*(,|$)/.test(v) &&
      v.includes(","))
  )
    return "fontFamily";
  if (/font-?weight/i.test(name) && /^\d{3}$|^(normal|bold)$/.test(v)) return "fontWeight";
  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw)$/.test(v))
    return /font-?size/i.test(name)
      ? "fontSize"
      : /line-?height/i.test(name)
        ? "lineHeight"
        : "dimension";
  if (/^-?\d*\.?\d+m?s$/.test(v)) return "duration";
  if (/shadow/i.test(name)) return "shadow";
  if (/^-?\d*\.?\d+$/.test(v)) return "number";
  return "other";
}

export const captureSetup = defineCommand({
  name: "capture.setup",
  title: "Install capture browser",
  description: "Download the headless Chromium used by capture commands (one-time).",
  kind: "mutation",
  input: z.object({}),
  handler: () => installBrowser(),
  format: (out) => out.output || "Installed.",
});

export const captureOutline = defineCommand({
  name: "capture.outline",
  title: "Outline page DOM",
  description:
    "Open a page (or attach to a running app over CDP), optionally run setup steps, and return an indented outline of a DOM subtree: tags, classes, roles, labels, text and sizes. Use it to find selectors for components to capture.",
  kind: "query",
  input: z.object({
    target: TargetSchema,
    selector: z.string().default("body"),
    depth: z.number().int().positive().max(40).default(8),
    maxNodes: z.number().int().positive().max(5000).default(400),
    includeHidden: z.boolean().default(false),
  }),
  handler: ({ target, selector, depth, maxNodes, includeHidden }) =>
    withPage(target, async (page) => ({
      outline: await page.evaluate(outlineElement, { selector, depth, maxNodes, includeHidden }),
    })),
  format: (out) => out.outline,
});

export const captureElementCommand = defineCommand({
  name: "capture.element",
  title: "Capture element",
  description:
    "Capture an element from a running app: its DOM, every CSS rule that applies to it or its descendants (including :hover/:focus/::before and state-class variants like .focused/.disabled) in cascade order with provenance annotations, resolved CSS variables, fonts, the ancestor chain, per-element geometry and a screenshot. With `system` + `label`, stores everything in .design/systems/<system>/captures/<label>/ (rules.css is ready to become a component's component.css; geometry.json is what capture.verify compares against).",
  kind: "mutation",
  input: z.object({
    target: TargetSchema,
    selector: z.string().describe("CSS selector of the element to capture (first match)"),
    system: z.string().optional().describe("Store the capture in this design system"),
    label: z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/)
      .optional()
      .describe("Capture name, e.g. 'button-primary-dark' (required with system)"),
    theme: z.string().optional().describe("Theme id the page was in (recorded for verification)"),
    state: z.string().optional().describe("State the element was in, e.g. 'hover', 'disabled'"),
    exclude: z
      .array(z.string())
      .default([])
      .describe("Descendant selectors to skip (e.g. third-party internals)"),
    stateClasses: z
      .array(z.string())
      .default(DEFAULT_STATE_CLASSES)
      .describe("Classes ignored when matching selectors so their state rules are kept"),
    allVarsPrefix: z
      .string()
      .optional()
      .describe("Also record every custom property with this prefix (e.g. '--vscode-')"),
    screenshot: z.boolean().default(true),
    inline: z
      .boolean()
      .default(false)
      .describe("Return the full CSS/HTML/geometry in the result (always true without system)"),
  }),
  handler: async (input, core) => {
    if (input.system && !input.label)
      throw new CoreError("INVALID_INPUT", "label is required when storing a capture in a system");
    const result = await captureElement({
      target: input.target,
      selector: input.selector,
      exclude: input.exclude,
      stateClasses: input.stateClasses,
      ...(input.allVarsPrefix !== undefined ? { allVarsPrefix: input.allVarsPrefix } : {}),
      screenshot: input.screenshot,
    });
    const summary = {
      url: result.url,
      size: { width: result.rect.w, height: result.rect.h, parentWidth: result.parentWidth },
      rules: result.rules.length,
      keyframes: result.keyframes.length,
      variables: Object.keys(result.vars).length,
      fonts: result.fontFaces.map((f) => ({ family: f.family, urls: f.urls })),
      ancestors: result.ancestors
        .slice(0, 12)
        .map((a) => `${a.tag}${a.classes ? `.${a.classes.trim().split(/\s+/).join(".")}` : ""}`),
      elements: result.geometry.filter((g) => !g.hidden).length,
    };
    const images = result.screenshot ? [png(result.screenshot)] : [];
    if (input.system && input.label) {
      const stored = await storeCapture(core, input.system, input.label, result, {
        selector: input.selector,
        scale: input.target.scale ?? 2,
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.state ? { state: input.state } : {}),
      });
      await core.systems.logActivity(input.system, {
        kind: "capture",
        title: `Captured ${input.label}`,
        detail: `${input.selector} · ${Math.round(result.rect.w)}×${Math.round(result.rect.h)} · ${summary.elements} elements · ${summary.rules} rules`,
        ref: input.label,
      });
      return {
        ...summary,
        label: input.label,
        dir: path.relative(core.workspace.root, stored.dir),
        files: stored.files,
        ...(input.inline ? { css: result.css, html: result.html, vars: result.vars } : {}),
        images,
      };
    }
    return {
      ...summary,
      css: result.css,
      html: result.html,
      vars: result.vars,
      inherited: result.inherited,
      geometry: result.geometry,
      images,
    };
  },
  format: (out) =>
    [
      `Captured ${out.size.width}×${out.size.height} element from ${out.url}`,
      `  ${out.rules} rules, ${out.variables} variables, ${out.elements} visible elements`,
      "dir" in out && out.dir
        ? `  stored in ${out.dir}: ${(out.files as string[]).join(", ")}`
        : "",
      `  ancestors: ${out.ancestors.slice(0, 6).join(" < ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
});

export const captureTokens = defineCommand({
  name: "capture.tokens",
  title: "Capture tokens",
  description:
    "Read the resolved CSS custom properties on an element of a running app (e.g. all '--vscode-' variables on the workbench) for the current theme. With `system` + `theme`, imports them as token values for that theme (merged with existing tokens by CSS variable; new tokens get a name derived from the variable and an inferred type). Run once per theme.",
  kind: "mutation",
  input: z.object({
    target: TargetSchema,
    selector: z.string().default(":root"),
    prefix: z
      .string()
      .default("--")
      .describe("Only variables starting with this, e.g. '--vscode-'"),
    system: z.string().optional(),
    theme: z
      .string()
      .optional()
      .describe("Theme id the values belong to (required with system unless themeIndependent)"),
    themeIndependent: z
      .boolean()
      .default(false)
      .describe("Store as theme-independent values (sizes, fonts)"),
    stripPrefix: z
      .string()
      .optional()
      .describe("Prefix removed when deriving token names (defaults to `prefix`)"),
  }),
  handler: async (input, core) => {
    const vars = await withPage(input.target, (page) =>
      page.evaluate(readCustomProperties, { selector: input.selector, prefix: input.prefix }),
    );
    if (!input.system) return { count: Object.keys(vars).length, vars };
    core.systems.get(input.system);
    if (!input.themeIndependent) {
      if (!input.theme)
        throw new CoreError("INVALID_INPUT", "theme is required (or set themeIndependent)");
      if (!core.systems.get(input.system).themes.some((t) => t.id === input.theme))
        throw new CoreError("INVALID_INPUT", `Unknown theme ${input.theme}`);
    }
    const existing = new Map((await core.systems.tokens(input.system)).map((t) => [t.cssVar, t]));
    const strip = input.stripPrefix ?? input.prefix;
    const tokens: TokenInput[] = Object.entries(vars).map(([cssVar, value]) => {
      const prev = existing.get(cssVar);
      const base = cssVar.startsWith(strip)
        ? cssVar.slice(strip.length)
        : cssVar.replace(/^--/, "");
      return {
        name: prev?.name ?? base.replace(/-/g, "."),
        cssVar,
        type: prev?.type ?? inferTokenType(cssVar, value),
        ...(input.themeIndependent ? { value } : { values: { [input.theme!]: value } }),
      };
    });
    const result = await core.systems.importTokens(input.system, tokens);
    return { count: tokens.length, ...result };
  },
  format: (out) =>
    "added" in out
      ? `Imported ${out.count} variables: ${out.added} added, ${out.updated} updated (${out.total} tokens)`
      : `${out.count} variables`,
});

export const captureVerify = defineCommand({
  name: "capture.verify",
  title: "Verify component",
  description:
    "Render a design-system component's example and compare it element-by-element (position, size, colors, border, radius, font, padding, opacity, icon glyph, text) with its captured reference(s) from the real app. Records the result in the component's `verification` and returns the differences plus a screenshot.",
  kind: "mutation",
  positional: ["system", "component"],
  input: z.object({
    system: z.string(),
    component: z.string().describe("Component name"),
    reference: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Index into the component's references (default: all)"),
    tolerance: z.number().nonnegative().default(0.5).describe("Allowed geometry difference in px"),
  }),
  handler: async ({ system, component: name, reference, tolerance }, core: Core) => {
    const component = core.systems.component(system, name);
    if (!component.references.length)
      throw new CoreError(
        "INVALID_INPUT",
        `<${component.tag}> has no references; set component.references to captures first`,
      );
    const refs =
      reference === undefined
        ? component.references
        : [component.references[reference]!].filter(Boolean);
    if (!refs.length) throw new CoreError("NOT_FOUND", `No reference #${reference}`);
    const results = [];
    for (const ref of refs)
      results.push(await verifyComponent(core, system, component, ref, tolerance));
    const diffs = results.reduce((n, r) => n + r.diffs.length + r.missing.length, 0);
    const compared = results.reduce((n, r) => n + r.compared, 0);
    const status = results.every((r) => r.status === "verified") ? "verified" : "drift";
    const summary = results
      .flatMap((r) => describeDiffs(r, 15).map((line) => `[${r.reference.capture}] ${line}`))
      .slice(0, 40);
    await core.systems.logActivity(system, {
      kind: "verify",
      title: `${status === "verified" ? "Verified" : "Drift in"} <${component.tag}>`,
      detail:
        status === "verified"
          ? `${compared} elements match ${results.map((r) => r.reference.capture).join(", ")}`
          : `${diffs} difference(s) across ${results.length} reference(s)\n${summary.slice(0, 6).join("\n")}`,
      ref: name,
      status: status === "verified" ? "ok" : "warn",
    });
    await core.systems.updateComponent(system, name, {
      verification: {
        status,
        checkedAt: new Date().toISOString(),
        compared,
        diffs,
        theme: results[0]?.theme,
        summary,
      },
    });
    return {
      status,
      compared,
      diffs,
      references: results.map(({ screenshot: _s, ...r }) => ({
        ...r,
        diffs: r.diffs.slice(0, 50),
        missing: r.missing.slice(0, 50),
        extra: r.extra.slice(0, 20),
      })),
      summary,
      images: results.flatMap((r) => (r.screenshot ? [png(r.screenshot)] : [])),
    };
  },
  format: (out) =>
    [
      `${out.status === "verified" ? "✓ verified" : "✗ drift"}: ${out.compared} elements compared, ${out.diffs} difference(s)`,
      ...out.summary.map((s) => `  ${s}`),
    ].join("\n"),
});

export const captureScreenshot = defineCommand({
  name: "capture.screenshot",
  title: "Screenshot a page",
  description:
    "Screenshot a page (or an element in it) after optional setup steps. Returns the image; optionally saves it into a design system capture folder.",
  kind: "query",
  input: z.object({
    target: TargetSchema,
    selector: z.string().optional(),
    fullPage: z.boolean().default(false),
  }),
  handler: async ({ target, selector, fullPage }) => {
    const shot = await withPage(target, (page) =>
      selector ? page.locator(selector).first().screenshot() : page.screenshot({ fullPage }),
    );
    return { bytes: shot.byteLength, images: [png(shot)] };
  },
  format: (out) => `Screenshot: ${out.bytes} bytes`,
});

export const prototypeScreenshot = defineCommand({
  name: "prototype.screenshot",
  title: "Screenshot prototype",
  description:
    "Render a prototype in a real browser and return a screenshot, so you can check your work. Choose the viewport (width/height), optional query string (e.g. '?theme=light'), and optionally an element selector.",
  kind: "query",
  positional: ["id"],
  input: z.object({
    id: z.string(),
    width: z.number().int().positive().default(1280),
    height: z.number().int().positive().default(800),
    query: z.string().default("").describe("Appended to the URL, e.g. '?theme=light'"),
    selector: z.string().optional(),
    fullPage: z.boolean().default(false),
    save: z
      .string()
      .optional()
      .describe(
        "Also save the PNG into the prototype folder at this path (e.g. 'screenshots/desktop.png')",
      ),
  }),
  handler: async ({ id, width, height, query, selector, fullPage, save }, core) => {
    const proto = core.prototypes.get(id);
    const sandbox = await core.sandboxUrl();
    const url = `${sandbox}/p/${encodeURIComponent(id)}/${proto.entry.split("/").map(encodeURIComponent).join("/")}${query}`;
    const shot = await withPage({ url, width, height, scale: 1 }, async (page) => {
      await settle(page);
      return selector ? page.locator(selector).first().screenshot() : page.screenshot({ fullPage });
    });
    if (save) await core.prototypes.writeFile(id, save, shot.toString("base64"), "base64");
    return { url, bytes: shot.byteLength, ...(save ? { saved: save } : {}), images: [png(shot)] };
  },
  format: (out) =>
    `Screenshot of ${out.url} (${out.bytes} bytes)${out.saved ? ` saved to ${out.saved}` : ""}`,
});

export const componentScreenshot = defineCommand({
  name: "component.screenshot",
  title: "Screenshot component",
  description:
    "Render a design-system component example (in its required context and a theme) and return a screenshot.",
  kind: "query",
  positional: ["system", "name"],
  input: z.object({
    system: z.string(),
    name: z.string(),
    example: z.number().int().nonnegative().default(0),
    theme: z.string().optional(),
    width: z.number().int().positive().default(480),
  }),
  handler: async ({ system, name, example, theme, width }, core) => {
    const component = core.systems.component(system, name);
    await core.buildSystem(system);
    const sandbox = await core.sandboxUrl();
    const t = theme ?? core.systems.get(system).defaultTheme;
    const url = `${sandbox}/s/${encodeURIComponent(system)}/specimen.html?component=${encodeURIComponent(name)}&example=${example}&theme=${encodeURIComponent(t)}&width=${width}`;
    const shot = await withPage(
      { url, width: width + 32, height: 600, waitFor: "html[data-ready]" },
      async (page) => {
        await settle(page);
        return page.locator(".dt-specimen-root").first().screenshot();
      },
    );
    return { tag: component.tag, theme: t, url, images: [png(shot)] };
  },
  format: (out) => `Screenshot of <${out.tag}> (${out.theme})`,
});

/** Read a stored capture's files (for agents building components). */
export const captureGet = defineCommand({
  name: "capture.get",
  title: "Get capture",
  description:
    "Read a stored capture: metadata (selector, size, ancestors, variables, fonts) and optionally its rules.css, dom.html and screenshot. Without label, lists captures.",
  kind: "query",
  positional: ["system", "label"],
  input: z.object({
    system: z.string(),
    label: z.string().optional(),
    include: z.array(z.enum(["css", "html", "geometry", "screenshot"])).default(["html"]),
  }),
  handler: async ({ system, label, include }, core) => {
    if (!label) return { captures: await core.systems.listCaptures(system) };
    const dir = core.systems.captureDirOf(system, label);
    const read = (file: string) => readFile(path.join(dir, file)).catch(() => undefined);
    const meta = await read("capture.json");
    if (!meta) throw new CoreError("NOT_FOUND", `No capture ${JSON.stringify(label)} in ${system}`);
    const out: Record<string, unknown> = { capture: JSON.parse(meta.toString("utf8")) };
    if (include.includes("css")) out.css = (await read("rules.css"))?.toString("utf8");
    if (include.includes("html")) out.html = (await read("dom.html"))?.toString("utf8");
    if (include.includes("geometry"))
      out.geometry = JSON.parse((await read("geometry.json"))?.toString("utf8") ?? "[]");
    const shot = include.includes("screenshot") ? await read("screenshot.png") : undefined;
    return { ...out, ...(shot ? { images: [png(shot)] } : {}) };
  },
  format: (out) => JSON.stringify(out, null, 2),
});

export const captureEvaluate = defineCommand({
  name: "capture.evaluate",
  title: "Evaluate in page",
  description:
    "Run a JavaScript expression in a running app's page (after optional setup steps) and return its JSON-serializable result. Use for inspection the other capture tools don't cover, e.g. reading a whole stylesheet, listing elements, or checking computed values.",
  kind: "query",
  input: z.object({
    target: TargetSchema,
    expression: z
      .string()
      .describe(
        "Expression or async IIFE evaluated in the page; its result must be JSON-serializable",
      ),
  }),
  handler: ({ target, expression }) =>
    withPage(target, async (page) => ({ result: (await page.evaluate(expression)) as unknown })),
  format: (out) =>
    typeof out.result === "string" ? out.result : JSON.stringify(out.result, null, 2),
});

export const captureCommands = [
  captureSetup,
  captureOutline,
  captureEvaluate,
  captureElementCommand,
  captureTokens,
  captureGet,
  captureVerify,
  captureScreenshot,
  prototypeScreenshot,
  componentScreenshot,
];
