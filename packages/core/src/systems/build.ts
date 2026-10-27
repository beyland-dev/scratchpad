import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import { NODE_MODULES_DIR, buildInto, buildPackageSystemDist } from "./package.ts";
import path from "node:path";
import vm from "node:vm";
import { atomicWrite, nowIso, pathExists, writeJson } from "../fs-utils.ts";
import {
  mergeStylesheets,
  prepareCapturedCss,
  referencedVars,
  type ThemeScope,
  widenTypeSelectors,
} from "./css.ts";
import { RUNTIME_JS } from "./runtime.ts";
import type { DesignComponent, DesignSystem, Theme, Token } from "./schemas.ts";
import { writeSkill } from "./skill.ts";
import { DIST_DIR, SKILL_DIR, type SystemStore } from "./store.ts";

export interface BuildResult {
  system: string;
  builtAt: string;
  components: number;
  tokens: number;
  files: string[];
  css: { bytes: number; captured: number; duplicates: number; authored: number };
  js: { bytes: number };
  warnings: string[];
}

export function themeSelector(system: DesignSystem, theme: Theme): string {
  return system.themeSelector
    .replaceAll("{theme}", theme.id)
    .replaceAll("{classes}", classesOf(theme));
}

function classesOf(theme: Theme): string {
  return theme.classes
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => `.${c}`)
    .join("");
}

export function themeScope(system: DesignSystem, theme: Theme): ThemeScope {
  const t = system.themeSelector;
  return {
    id: theme.id,
    selector: themeSelector(system, theme),
    root: t.includes("{classes}") && !t.includes("{theme}") ? t.replaceAll("{classes}", "") : "",
    classes: classesOf(theme),
  };
}

function tokensCss(system: DesignSystem, tokens: Token[]): string {
  const lines: string[] = [];
  const shared = tokens.filter((t) => t.value !== undefined);
  if (shared.length) {
    lines.push(":root {", ...shared.map((t) => `  ${t.cssVar}: ${t.value};`), "}");
  }
  for (const theme of system.themes) {
    const themed = tokens.filter((t) => t.values[theme.id] !== undefined);
    if (!themed.length) continue;
    lines.push(
      "",
      `/* ${theme.label} */`,
      `${themeSelector(system, theme)} {`,
      ...themed.map((t) => `  ${t.cssVar}: ${t.values[theme.id]};`),
      "}",
    );
  }
  return lines.join("\n");
}

/** Catalog consumed by the UI, the specimen page, and agents. */
export function catalogOf(system: DesignSystem, components: DesignComponent[], tokens: Token[]) {
  const groups = new Map<string, number>();
  for (const t of tokens) groups.set(t.group ?? "other", (groups.get(t.group ?? "other") ?? 0) + 1);
  return {
    system: {
      id: system.id,
      name: system.name,
      description: system.description,
      prefix: system.prefix,
      themes: system.themes,
      defaultTheme: system.defaultTheme,
      rootContext: system.rootContext,
      capturedFrom: system.capturedFrom,
    },
    components: components.map(({ issues: _issues, ...c }) => c),
    tokens: {
      total: tokens.length,
      groups: Object.fromEntries([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    },
  };
}

const SPECIMEN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Specimen</title>
    <link rel="stylesheet" href="system.css" />
    <style>
      /* Zero specificity so the system's own styles always win over the specimen frame. */
      :where(html, body) { margin: 0; }
      :where(body > .dt-specimen-root) { box-sizing: border-box; min-height: 100vh; padding: 16px; }
      :where(body.bare > .dt-specimen-root) { min-height: 0; padding: 0; }
      :where(body.framed > .dt-specimen-root) { min-height: 0; }
      /* ?fill: fill the frame (e.g. a fixed-height card preview); a script centers the content. */
      :where(body.fill > .dt-specimen-root) { min-height: 0; }
    </style>
    <script type="module" src="system.js"></script>
    <script type="module">
      // ?component=<name>&example=<n>&theme=<id>[&bare][&fill][&width=px][&frame=<id>] or ?html=<markup>
      const params = new URLSearchParams(location.search);
      const catalog = await (await fetch("catalog.json", { cache: "no-store" })).json();
      const { system } = catalog;
      const component = catalog.components.find((c) => c.name === params.get("component"));
      const theme = params.get("theme") || system.defaultTheme;
      let html = params.get("html");
      if (html === null && component) {
        const example = component.examples[Number(params.get("example") || 0)];
        html = example ? example.html : "<" + component.tag + "></" + component.tag + ">";
      }
      html = html || "";
      const contexts = component ? [...component.requires] : [];
      if (system.rootContext && component?.tag !== system.rootContext && !contexts.includes(system.rootContext)) contexts.unshift(system.rootContext);
      for (const tag of [...contexts].reverse()) {
        if (!new RegExp("<" + tag + "[\\\\s>/]").test(html)) html = "<" + tag + ">" + html + "</" + tag + ">";
      }
      if (params.has("bare")) document.body.classList.add("bare");
      else if (params.has("fill")) document.body.classList.add("fill");
      document.body.innerHTML = html;
      const root = document.body.firstElementChild;
      if (root) {
        root.classList.add("dt-specimen-root");
        if (system.rootContext && root.localName === system.rootContext) root.setAttribute("theme", theme);
        else root.setAttribute("data-theme", theme);
        if (params.get("width")) root.style.width = params.get("width") + "px";
      }
      // Paint the page with the specimen's own background (the first opaque one from the root
      // down), so any space around it in the frame matches instead of showing through.
      const paint = () => {
        for (let el = root; el; el = el.firstElementChild) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== "transparent" && !/^rgba\\(.*,\\s*0\\)$/.test(bg)) {
            document.documentElement.style.background = bg;
            return;
          }
        }
      };
      // Center vertically by the content's full extent (absolutely positioned parts like menus
      // overflow the root), falling back to top alignment when it's taller than the frame.
      const center = () => {
        document.body.style.paddingTop = "0px";
        let bottom = 0;
        for (const el of document.body.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          if (rect.height && rect.bottom > bottom) bottom = rect.bottom;
        }
        const offset = Math.floor((innerHeight - bottom) / 2);
        document.body.style.paddingTop = Math.max(0, offset) + "px";
      };
      const settle = () => {
        paint();
        if (params.has("fill")) center();
      };
      if (!params.has("bare")) {
        settle();
        requestAnimationFrame(settle);
        if (root && params.has("fill")) {
          new ResizeObserver(center).observe(root);
          addEventListener("resize", center);
        }
      }
      const frame = params.get("frame");
      if (frame) document.body.classList.add("framed");
      if (frame && parent !== window) {
        const report = () => parent.postMessage({ type: "dt-specimen-size", frame, height: Math.ceil(document.documentElement.scrollHeight) }, "*");
        new ResizeObserver(report).observe(document.body);
        report();
      }
      document.documentElement.dataset.ready = "true";
    </script>
  </head>
  <body></body>
</html>
`;

export async function buildSystem(store: SystemStore, id: string): Promise<BuildResult> {
  const system = store.get(id);
  const components = store.components(id);
  const tokens = await store.tokens(id);
  const dir = store.dirOf(id);
  if (system.kind === "package") {
    // Freshly scaffolded systems aren't installed yet: that's a setup step, not a failed build.
    if (!(await pathExists(path.join(dir, NODE_MODULES_DIR, "vite", "package.json")))) {
      await writeSkill(store, id, path.join(dir, SKILL_DIR));
      return {
        system: id,
        builtAt: nowIso(),
        components: components.length,
        tokens: tokens.length,
        files: [],
        css: { bytes: 0, captured: 0, duplicates: 0, authored: 0 },
        js: { bytes: 0 },
        warnings: [`Dependencies aren't installed yet: run \`npm install\` in ${dir}`],
      };
    }
    let result: Omit<BuildResult, "system" | "builtAt"> | undefined;
    await buildInto(path.join(dir, DIST_DIR), async (outDir) => {
      result = await buildPackageSystemDist(
        system,
        components,
        tokens,
        dir,
        outDir,
        catalogOf(system, components, tokens),
      );
    });
    await writeSkill(store, id, path.join(dir, SKILL_DIR));
    return { system: id, builtAt: nowIso(), ...result! };
  }
  // Unique staging folders: the server and other processes (CLI, agents) may build concurrently.
  const stamp = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const next = path.join(dir, `${DIST_DIR}.next-${stamp}`);
  const warnings: string[] = [];
  await mkdir(next, { recursive: true });

  // ---- CSS
  const inputs: { origin: string; css: string }[] = [];
  const tokenVars = new Set(tokens.map((t) => t.cssVar));
  const base = (await pathExists(path.join(dir, "base.css")))
    ? await readFile(path.join(dir, "base.css"), "utf8")
    : "";
  for (const c of components) {
    const parts: string[] = [];
    for (const label of c.cssCaptures) {
      const capDir = store.captureDirOf(id, label);
      const rules = await readFile(path.join(capDir, "rules.css"), "utf8").catch(() => undefined);
      if (rules === undefined) {
        warnings.push(`<${c.tag}> cssCaptures: capture ${JSON.stringify(label)} not found`);
        continue;
      }
      const meta = JSON.parse(
        await readFile(path.join(capDir, "capture.json"), "utf8").catch(() => "{}"),
      ) as { theme?: string };
      const theme = system.themes.find((t) => t.id === meta.theme);
      parts.push(
        prepareCapturedCss(rules, {
          themeSheets: system.themeSheets,
          tokenVars,
          ...(theme ? { theme: themeScope(system, theme) } : {}),
        }),
      );
    }
    const css = await store.readComponentFile(id, c.name, "component.css");
    if (css) parts.push(css.toString("utf8"));
    if (parts.length) inputs.push({ origin: `${c.tag} (${c.name})`, css: parts.join("\n") });
  }
  const merged = mergeStylesheets(inputs, system.sheetOrder);
  const typeMap = new Map<string, string[]>();
  for (const c of components)
    if (c.hostTag) typeMap.set(c.hostTag, [...(typeMap.get(c.hostTag) ?? []), c.tag]);
  merged.css = widenTypeSelectors(merged.css, typeMap);
  const hostDisplay = components
    .filter((c) => c.hostDisplay !== "inline")
    .map((c) => `:where(${c.tag}) { display: ${c.hostDisplay}; }`)
    .join("\n");
  const notice = system.attribution.map(
    (a) => ` * ${a.name} — ${a.license}${a.url ? ` (${a.url})` : ""}${a.note ? `: ${a.note}` : ""}`,
  );
  const css = [
    `/*\n * ${system.name} design system — generated by design-tool. Do not edit; edit the system sources and rebuild.\n${notice.length ? ` *\n${notice.join("\n")}\n` : ""} */`,
    "/* ---- Tokens ---- */",
    tokensCss(system, tokens),
    base ? `/* ---- base.css ---- */\n${base.trim()}` : "",
    hostDisplay ? `/* ---- Host elements ---- */\n${hostDisplay}` : "",
    merged.css,
  ]
    .filter(Boolean)
    .join("\n\n");
  await atomicWrite(path.join(next, "system.css"), css);

  // ---- JS
  const runtime = RUNTIME_JS.replace(
    "__SYSTEM__",
    JSON.stringify({
      id,
      name: system.name,
      prefix: system.prefix,
      themes: system.themes,
      defaultTheme: system.defaultTheme,
      rootContext: system.rootContext,
    }),
  );
  const parts = [
    `// ${system.name} design system — generated by design-tool. Do not edit.`,
    runtime,
  ];
  for (const c of components) {
    const js = await store.readComponentFile(id, c.name, "component.js");
    if (!js) {
      warnings.push(`<${c.tag}> has no component.js`);
      continue;
    }
    const source = js.toString("utf8").trim();
    try {
      // Syntax-check each component on its own so one bad file can't break the whole bundle.
      new vm.Script(source, { filename: `${c.name}/component.js` });
    } catch (error) {
      const message = `<${c.tag}> component.js has a syntax error and was skipped: ${(error as Error).message}`;
      warnings.push(message);
      parts.push(
        `// ---- <${c.tag}> (${c.name}) skipped\nconsole.error(${JSON.stringify(`[${id}] ${message}`)});`,
      );
      continue;
    }
    parts.push(
      `// ---- <${c.tag}> (${c.name})\ntry {\n${source}\n} catch (error) {\n  console.error("[${id}] failed to define <${c.tag}>", error);\n}`,
    );
  }
  const js = `${parts.join("\n\n")}\n`;
  await atomicWrite(path.join(next, "system.js"), js);

  // ---- Assets, catalog, specimen, notice
  if (await pathExists(path.join(dir, "assets")))
    await cp(path.join(dir, "assets"), path.join(next, "assets"), { recursive: true });
  await writeJson(path.join(next, "catalog.json"), catalogOf(system, components, tokens));
  await atomicWrite(path.join(next, "specimen.html"), SPECIMEN_HTML);
  if (system.attribution.length) {
    await atomicWrite(
      path.join(next, "NOTICE.txt"),
      system.attribution
        .map(
          (a) =>
            `${a.name}\nLicense: ${a.license}${a.url ? `\n${a.url}` : ""}${a.note ? `\n${a.note}` : ""}\n`,
        )
        .join("\n"),
    );
  }

  // ---- Checks
  const known = new Set(tokens.map((t) => t.cssVar));
  const defined = new Set(
    [...(base + merged.css).matchAll(/(?:^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]!),
  );
  const undefinedVars = referencedVars(merged.css + base).filter(
    (v) => !known.has(v) && !defined.has(v),
  );
  if (undefinedVars.length) {
    warnings.push(
      `${undefinedVars.length} CSS variable(s) used by components are not tokens (their fallbacks apply): ${undefinedVars.slice(0, 15).join(", ")}${undefinedVars.length > 15 ? ", …" : ""}`,
    );
  }
  for (const c of components) {
    for (const tag of c.requires)
      if (!components.some((x) => x.tag === tag))
        warnings.push(`<${c.tag}> requires <${tag}>, which is not defined`);
    if (!c.examples.length) warnings.push(`<${c.tag}> has no examples`);
  }

  // ---- Swap in atomically
  const dist = path.join(dir, DIST_DIR);
  const old = path.join(dir, `${DIST_DIR}.old-${stamp}`);
  for (let attempt = 0; ; attempt++) {
    try {
      if (await pathExists(dist)) await rename(dist, old).catch(() => undefined);
      await rename(next, dist);
      break;
    } catch (error) {
      // Another build swapped its output in between; retry, then give up keeping theirs.
      if (attempt >= 5) {
        await rm(next, { recursive: true, force: true });
        break;
      }
      void error;
    }
  }
  await rm(old, { recursive: true, force: true });

  await writeSkill(store, id, path.join(dir, SKILL_DIR));

  const files = ["system.css", "system.js", "catalog.json", "specimen.html"];
  return {
    system: id,
    builtAt: nowIso(),
    components: components.length,
    tokens: tokens.length,
    files,
    css: {
      bytes: Buffer.byteLength(css),
      captured: merged.captured,
      duplicates: merged.duplicates,
      authored: merged.authored,
    },
    js: { bytes: Buffer.byteLength(js) },
    warnings,
  };
}
