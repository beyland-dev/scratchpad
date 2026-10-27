/**
 * Package design systems: an existing library (e.g. shadcn/ui) installed and configured in the
 * system's folder. The folder is a small Vite project; its node_modules are shared by every
 * prototype built against it. design-tool runs the system's own Vite (in a child process) to build
 * its specimen page and framework prototypes.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { CoreError } from "../errors.ts";
import { atomicWrite, pathExists, walkFiles, writeJson } from "../fs-utils.ts";
import type { BuildResult } from "./build.ts";
import type { DesignComponent, DesignSystem, Theme, Token, TokenType } from "./schemas.ts";

export const NODE_MODULES_DIR = "node_modules";
export const DEFAULT_STYLES = "src/index.css";

// ---- Scaffold ---------------------------------------------------------------

/** Versions current when this template was written; `npm install` resolves the latest compatible ones. */
const REACT_PACKAGE_JSON = (name: string) => ({
  name,
  private: true,
  type: "module",
  dependencies: {
    react: "^19.3.1",
    "react-dom": "^19.3.1",
  },
  devDependencies: {
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.1.2",
    tailwindcss: "^4.3.3",
    typescript: "^5.9.0",
    vite: "^8.3.5",
  },
});

const VITE_CONFIG = `import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Used by design-tool to build this system's specimen page and every React prototype that uses it.
// "@/…" resolves to src/ in components, stories and prototypes alike.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
`;

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: ".",
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src", "stories"],
};

/** Write the starter Vite + React + Tailwind project a package system is configured in. */
export async function scaffoldPackageSystem(dir: string, id: string): Promise<string[]> {
  const files: [string, string][] = [
    ["package.json", `${JSON.stringify(REACT_PACKAGE_JSON(`design-system-${id}`), null, 2)}\n`],
    ["vite.config.ts", VITE_CONFIG],
    ["tsconfig.json", `${JSON.stringify(TSCONFIG, null, 2)}\n`],
    [DEFAULT_STYLES, `@import "tailwindcss";\n`],
    [".gitignore", `${NODE_MODULES_DIR}/\nsource/\ndist/\n`],
  ];
  const written: string[] = [];
  for (const [rel, content] of files) {
    const file = path.join(dir, rel);
    if (await pathExists(file)) continue;
    await atomicWrite(file, content);
    written.push(rel);
  }
  return written;
}

// ---- Tokens from the theme stylesheet ------------------------------------------

/** The selector a theme's variables live under: `:root` for the default theme, else its classes. */
function themeSelectors(theme: Theme, isDefault: boolean): string[] {
  const classes = theme.classes.split(/\s+/).filter(Boolean);
  if (classes.length) return [classes.map((c) => `.${c}`).join("")];
  return isDefault ? [":root", "html", ":host"] : [`[data-theme="${theme.id}"]`];
}

const COLOR =
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|color-mix)\(|transparent$|currentcolor$)/i;

function inferType(name: string, value: string): TokenType {
  if (COLOR.test(value.trim())) return "color";
  if (/font|family/i.test(name) && /[a-z]/i.test(value) && !/^\d/.test(value)) return "fontFamily";
  if (/shadow/i.test(name)) return "shadow";
  if (/^-?[\d.]+(px|rem|em|%|vh|vw)$/.test(value.trim()) || value.trim().startsWith("calc("))
    return "dimension";
  if (/^-?[\d.]+$/.test(value.trim())) return "number";
  return "other";
}

/** Top-level rules of a stylesheet as [selector, body] pairs (one level of nesting, e.g. @layer). */
function rulesOf(css: string): [string, string][] {
  const out: [string, string][] = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (text: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const head = text.slice(i, open).trim().split(";").pop()!.trim();
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
      }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith("@layer") || head.startsWith("@media")) walk(body);
      else out.push([head, body]);
      i = j;
    }
  };
  walk(source);
  return out;
}

/**
 * Theme variables declared in a package system's stylesheet (e.g. shadcn's `:root { --primary: … }`
 * and `.dark { … }`), as tokens with a value per theme. `@theme` blocks (Tailwind's mapping onto
 * these variables) are skipped.
 */
export function extractCssTokens(css: string, system: DesignSystem, file: string): Token[] {
  const byVar = new Map<string, Token>();
  const rules = rulesOf(css);
  system.themes.forEach((theme) => {
    const selectors = themeSelectors(theme, theme.id === system.defaultTheme);
    for (const [selector, body] of rules) {
      const parts = selector.split(",").map((s) => s.trim());
      if (!parts.some((p) => selectors.includes(p))) continue;
      for (const m of body.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g)) {
        const cssVar = m[1]!;
        const value = m[2]!.trim();
        const name = cssVar.slice(2);
        const token = byVar.get(cssVar) ?? {
          name,
          type: inferType(name, value),
          cssVar,
          values: {},
          group: name.split("-")[0],
          source: { path: file },
        };
        token.values[theme.id] = value;
        byVar.set(cssVar, token);
      }
    }
  });
  // Variables only set by the default theme apply to every theme.
  for (const token of byVar.values()) {
    for (const theme of system.themes)
      token.values[theme.id] ??=
        token.values[system.defaultTheme] ?? Object.values(token.values)[0]!;
  }
  return [...byVar.values()];
}

// ---- Running the system's Vite -------------------------------------------------

export interface ViteJob {
  systemDir: string;
  /** Prototype builds: the prototype folder (its HTML files are the entries). */
  root?: string;
  /** Specimen builds: source of the entry module (imports resolve from the system). */
  entrySource?: string;
  /** HTML entry files, relative to `root`. */
  inputs?: string[];
  outDir: string;
}

/**
 * Runs in a child process (plain JS, so no bundler or test runner can rewrite it): loads the
 * system's own Vite and vite.config, plus a bridge plugin that resolves bare imports from files
 * outside the system (prototypes, the generated specimen entry) against the system's
 * node_modules, and tells Tailwind to scan them. The job is passed as JSON in argv[1].
 */
const HARNESS = String.raw`
const job = JSON.parse(process.argv[1]);
const { createRequire } = await import("node:module");
const path = await import("node:path");
const fs = await import("node:fs");
const { pathToFileURL } = await import("node:url");
const systemDir = fs.realpathSync(job.systemDir);
const root = job.root ? fs.realpathSync(job.root) : systemDir;
const require = createRequire(path.join(systemDir, "package.json"));
// Only the system's own install counts (not a vite found further up the tree or globally).
if (!fs.existsSync(path.join(systemDir, "node_modules", "vite", "package.json"))) {
  console.error("DT_NOT_INSTALLED");
  process.exit(3);
}
const vitePath = require.resolve("vite");
const vite = await import(pathToFileURL(vitePath).href);
const inside = (dir, file) => {
  const rel = path.relative(dir, file);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
};
const ENTRY = "\0dt-entry";
const scanned = [...new Set([systemDir, root])];
const bridge = {
  name: "design-tool-bridge",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (source === "virtual:dt-entry") return ENTRY;
    if (!importer || source.startsWith("\0") || /^[./]/.test(source) || path.isAbsolute(source)) return null;
    if (!importer.startsWith("\0") && inside(systemDir, importer.split("?")[0])) return null;
    return this.resolve(source, path.join(systemDir, "package.json"), { ...options, skipSelf: true });
  },
  async load(id) {
    if (id === ENTRY) return job.entrySource;
    const file = id.split("?")[0];
    if (!file.endsWith(".css") || !inside(systemDir, file)) return null;
    const code = await fs.promises.readFile(file, "utf8");
    if (!/@import\s+["']tailwindcss/.test(code)) return null;
    return code + "\n" + scanned.map((dir) => "@source " + JSON.stringify(dir) + ";").join("\n") + "\n";
  },
};
const configFile = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]
  .map((f) => path.join(systemDir, f))
  .find((f) => fs.existsSync(f));
await vite.build({
  configFile: configFile ?? false,
  root,
  base: "./",
  logLevel: "error",
  clearScreen: false,
  plugins: [bridge],
  build: {
    outDir: job.outDir,
    emptyOutDir: true,
    target: "es2022",
    reportCompressedSize: false,
    rollupOptions: job.entrySource
      ? {
          input: { specimen: "virtual:dt-entry" },
          output: {
            entryFileNames: "specimen.js",
            chunkFileNames: "chunks/[name]-[hash].js",
            assetFileNames: (info) =>
              (info.names ?? []).some((n) => n.endsWith(".css")) ? "specimen.css" : "assets/[name]-[hash][extname]",
          },
        }
      : { input: (job.inputs ?? ["index.html"]).map((f) => path.join(root, f)) },
  },
});
`;

const VITE_TIMEOUT_MS = 3 * 60 * 1000;

export async function runVite(job: ViteJob): Promise<void> {
  const output = await new Promise<{ code: number | null; text: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", HARNESS, JSON.stringify(job)],
      {
        cwd: job.systemDir,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: VITE_TIMEOUT_MS,
      },
    );
    let text = "";
    child.stdout.on("data", (d: Buffer) => (text += d.toString()));
    child.stderr.on("data", (d: Buffer) => (text += d.toString()));
    child.on("error", reject);
    child.on("close", (exit) => resolve({ code: exit, text }));
  });
  if (output.code === 0) return;
  if (output.text.includes("DT_NOT_INSTALLED"))
    throw new CoreError(
      "INVALID_INPUT",
      `The design system's dependencies aren't installed. Run \`npm install\` in ${job.systemDir}.`,
    );
  const message = output.text
    // Strip ANSI colors from the build output.
    // oxlint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "")
    .trim()
    .split("\n")
    .slice(-25)
    .join("\n");
  throw new CoreError("INTERNAL", `Build failed:\n${message || `exit code ${output.code}`}`);
}

// ---- Specimen page ------------------------------------------------------------------

/** The specimen app: renders one example (a story export) with the same URL API and size reporting as captured systems. */
function specimenEntry(system: DesignSystem, components: DesignComponent[], dir: string): string {
  const stories = [...new Set(components.flatMap((c) => (c.story ? [c.story] : [])))];
  const imports = stories
    .map((s, i) => `import * as s${i} from ${JSON.stringify(path.join(dir, s))};`)
    .join("\n");
  const styles = path.join(dir, system.styles ?? DEFAULT_STYLES);
  return `import ${JSON.stringify(styles)};
import { Component, createElement } from "react";
import { createRoot } from "react-dom/client";
${imports}
const stories = { ${stories.map((s, i) => `${JSON.stringify(s)}: s${i}`).join(", ")} };

class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error
      ? createElement("pre", { style: { color: "#c22f3c", font: "12px ui-monospace, monospace", whiteSpace: "pre-wrap" } }, String(this.state.error?.stack ?? this.state.error))
      : this.props.children;
  }
}

const params = new URLSearchParams(location.search);
fetch("catalog.json", { cache: "no-store" }).then((r) => r.json()).then((catalog) => {
  const component = catalog.components.find((c) => c.name === params.get("component"));
  const themeId = params.get("theme") || catalog.system.defaultTheme;
  const theme = catalog.system.themes.find((t) => t.id === themeId);
  if (theme?.classes) document.documentElement.classList.add(...theme.classes.split(/\\s+/).filter(Boolean));
  const example = component?.examples[Number(params.get("example") || 0)];
  const module = component?.story ? stories[component.story] : undefined;
  const Story = module?.[example?.story ?? "default"] ?? module?.default;
  const host = document.createElement("div");
  host.className = "dt-specimen-root";
  if (params.get("width")) host.style.width = params.get("width") + "px";
  document.body.append(host);
  if (!params.has("bare")) host.style.padding = "16px";
  const fallback = createElement("p", { style: { font: "13px system-ui", color: "#888" } }, component ? "No story for this example yet." : "Unknown component.");
  createRoot(host).render(createElement(Boundary, null, Story ? createElement(Story) : fallback));

  const paint = () => {
    for (let el = host; el; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== "transparent" && !/^rgba\\(.*,\\s*0\\)$/.test(bg)) { document.documentElement.style.background = bg; return; }
    }
  };
  const center = () => {
    document.body.style.paddingTop = "0px";
    let bottom = 0;
    for (const el of document.body.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (r.height && r.bottom > bottom) bottom = r.bottom; }
    document.body.style.paddingTop = Math.max(0, Math.floor((innerHeight - bottom) / 2)) + "px";
  };
  const frame = params.get("frame");
  const report = () => frame && parent !== window && parent.postMessage({ type: "dt-specimen-size", frame, height: Math.ceil(document.documentElement.scrollHeight) }, "*");
  requestAnimationFrame(() => {
    if (!params.has("bare")) paint();
    if (params.has("fill")) { center(); new ResizeObserver(center).observe(host); addEventListener("resize", center); }
    new ResizeObserver(report).observe(document.body);
    report();
    document.documentElement.dataset.ready = "true";
  });
});
`;
}

const SPECIMEN_SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Specimen</title>
    <style>:where(html, body) { margin: 0; }</style>
    <link rel="stylesheet" href="specimen.css" />
    <script type="module" src="specimen.js"></script>
  </head>
  <body></body>
</html>
`;

/** Build a package system: its specimen app, catalog and (via the caller) skill. */
export async function buildPackageSystemDist(
  system: DesignSystem,
  components: DesignComponent[],
  tokens: Token[],
  dir: string,
  next: string,
  catalog: unknown,
): Promise<Omit<BuildResult, "system" | "builtAt">> {
  const warnings: string[] = [];
  for (const c of components) {
    if (!c.story) warnings.push(`<${c.tag}> has no story module`);
    else if (!(await pathExists(path.join(dir, c.story))))
      warnings.push(`<${c.tag}> story ${c.story} not found`);
  }
  const usable = components.filter(
    (c) => !warnings.some((w) => w.includes(`${c.story} not found`)),
  );
  await runVite({
    systemDir: dir,
    entrySource: specimenEntry(system, usable, dir),
    outDir: next,
  });
  await writeJson(path.join(next, "catalog.json"), catalog);
  await atomicWrite(path.join(next, "specimen.html"), SPECIMEN_SHELL);
  const sizeOf = async (f: string) =>
    (await stat(path.join(next, f)).catch(() => undefined))?.size ?? 0;
  return {
    components: components.length,
    tokens: tokens.length,
    files: ["specimen.html", "specimen.js", "specimen.css", "catalog.json"],
    css: { bytes: await sizeOf("specimen.css"), captured: 0, duplicates: 0, authored: 0 },
    js: { bytes: await sizeOf("specimen.js") },
    warnings,
  };
}

// ---- Prototype builds -----------------------------------------------------------

/** Files that affect a build, with sizes and mtimes, hashed into a cache key. */
export async function buildSignature(dirs: { dir: string; ignore?: (rel: string) => boolean }[]) {
  const hash = createHash("sha1");
  for (const { dir, ignore } of dirs) {
    hash.update(`\0${dir}`);
    for (const f of await walkFiles(dir, ignore ? { ignore } : {})) {
      const s = await stat(path.join(dir, f.path)).catch(() => undefined);
      hash.update(`${f.path}:${f.size}:${s ? Math.round(s.mtimeMs) : 0}\n`);
    }
  }
  return hash.digest("hex");
}

/** Build into `target` via a staging folder, so readers never see a half-written build. */
export async function buildInto(target: string, build: (outDir: string) => Promise<void>) {
  const stamp = `${process.pid}-${Date.now().toString(36)}`;
  const next = `${target}.next-${stamp}`;
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await build(next);
  } catch (error) {
    await rm(next, { recursive: true, force: true });
    throw error;
  }
  // Another process (the server's watcher, the CLI) may swap in its build at the same time; retry,
  // then keep theirs, since both are built from the same files.
  const old = `${target}.old-${stamp}`;
  for (let attempt = 0; ; attempt++) {
    try {
      if (await pathExists(target)) await rename(target, old).catch(() => undefined);
      await rename(next, target);
      break;
    } catch (error) {
      if (attempt >= 5) {
        await rm(next, { recursive: true, force: true });
        break;
      }
      void error;
    }
  }
  await rm(old, { recursive: true, force: true });
}

export async function readText(file: string): Promise<string | undefined> {
  return readFile(file, "utf8").catch(() => undefined);
}
