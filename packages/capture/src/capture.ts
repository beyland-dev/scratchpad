/// <reference lib="dom" />
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CoreError,
  type ComponentReference,
  type Core,
  type DesignComponent,
} from "@beyland/scratchpad-core";
import { rulesToCss } from "./annotate.ts";
import { settle, withPage, type Target } from "./browser.ts";
import {
  collectGeometry,
  extractElement,
  EMPTY_DECLARATION_RE,
  sourceDeclarations,
  type ExtractResult,
  type GeometryEntry,
} from "./extract.ts";

export const DEFAULT_STATE_CLASSES = [
  "focused",
  "disabled",
  "checked",
  "selected",
  "active",
  "expanded",
  "collapsed",
  "hover",
  "pressed",
  "open",
];

export interface CaptureElementOptions {
  target: Target;
  selector: string;
  exclude?: string[];
  stateClasses?: string[];
  allVarsPrefix?: string;
  screenshot?: boolean;
}

export interface CaptureElementResult extends ExtractResult {
  css: string;
  screenshot?: Buffer;
  /** Viewport of the captured page (vw/vh-based styles depend on it). */
  viewport?: { width: number; height: number };
}

export async function captureElement(
  options: CaptureElementOptions,
): Promise<CaptureElementResult> {
  return withPage(options.target, async (page) => {
    await page
      .locator(options.selector)
      .first()
      .waitFor({ state: "attached", timeout: options.target.timeoutMs });
    const extracted = await page.evaluate(extractElement, {
      selector: options.selector,
      exclude: options.exclude ?? [],
      stateClasses: options.stateClasses ?? DEFAULT_STATE_CLASSES,
      ...(options.allVarsPrefix !== undefined ? { allVarsPrefix: options.allVarsPrefix } : {}),
    });
    const broken = extracted.rules.filter(
      (r) => r.selectorText && EMPTY_DECLARATION_RE.test(r.css),
    );
    if (broken.length) {
      const recovered = await page.evaluate(sourceDeclarations, {
        requests: broken.map((r) => ({ sheet: r.sheet, selector: r.selectorText! })),
      });
      broken.forEach((rule, i) => {
        const body = recovered[i];
        if (body) rule.css = body.replace(/\s*\n\s*/g, " ").replace(/;?\s*$/, ";");
      });
      const missing = [
        ...new Set(
          broken.flatMap((r) => [...r.css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!)),
        ),
      ].filter((v) => !(v in extracted.vars));
      if (missing.length) {
        const resolved = await page.evaluate(
          ({ selector, names }) => {
            const el = document.querySelector(selector);
            const cs = el ? getComputedStyle(el) : null;
            return names.map((n) => cs?.getPropertyValue(n).trim() ?? "");
          },
          { selector: options.selector, names: missing },
        );
        missing.forEach((name, i) => {
          if (resolved[i]) extracted.vars[name] = resolved[i]!;
        });
      }
    }
    extracted.geometry = await page.evaluate(collectGeometry, {
      selector: options.selector,
      exclude: options.exclude ?? [],
    });
    const screenshot =
      options.screenshot === false
        ? undefined
        : await page
            .locator(options.selector)
            .first()
            .screenshot({ timeout: options.target.timeoutMs })
            .catch(() => undefined);
    const header = `Captured from ${extracted.url}\nSelector: ${options.selector}\nOn: ${nowIsoSafe()}`;
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    return {
      ...extracted,
      viewport,
      css: rulesToCss(extracted, header),
      ...(screenshot ? { screenshot } : {}),
    };
  });
}

const nowIsoSafe = () => new Date().toISOString();

export interface StoredCapture {
  label: string;
  url: string;
  selector: string;
  theme?: string;
  state?: string;
  capturedAt: string;
  rect: ExtractResult["rect"];
  parentWidth: number;
  ancestors: ExtractResult["ancestors"];
  inherited: ExtractResult["inherited"];
  vars: Record<string, string>;
  fontFaces: ExtractResult["fontFaces"];
  rules: number;
  /** Device scale factor of screenshot.png. */
  scale: number;
  /** Viewport of the captured page; verification renders specimens at the same size. */
  viewport?: { width: number; height: number };
}

/** Persist a capture under `projects/<project>/systems/<id>/captures/<label>/`. */
export async function storeCapture(
  core: Core,
  system: string,
  label: string,
  capture: CaptureElementResult,
  meta: { selector: string; theme?: string; state?: string; scale?: number },
): Promise<{ dir: string; files: string[]; summary: StoredCapture }> {
  core.systems.get(system);
  const dir = core.systems.captureDirOf(system, label);
  await mkdir(dir, { recursive: true });
  const summary: StoredCapture = {
    label,
    url: capture.url,
    selector: meta.selector,
    ...(meta.theme ? { theme: meta.theme } : {}),
    ...(meta.state ? { state: meta.state } : {}),
    capturedAt: nowIsoSafe(),
    rect: capture.rect,
    parentWidth: capture.parentWidth,
    ancestors: capture.ancestors,
    inherited: capture.inherited,
    vars: capture.vars,
    fontFaces: capture.fontFaces,
    rules: capture.rules.length,
    scale: meta.scale ?? 2,
    ...(capture.viewport ? { viewport: capture.viewport } : {}),
  };
  const files: [string, string | Buffer][] = [
    ["capture.json", `${JSON.stringify(summary, null, 2)}\n`],
    ["dom.html", `${capture.html}\n`],
    ["rules.css", capture.css],
    ["geometry.json", `${JSON.stringify(capture.geometry, null, 1)}\n`],
  ];
  if (capture.allVars) files.push(["vars.json", `${JSON.stringify(capture.allVars, null, 1)}\n`]);
  if (capture.screenshot) files.push(["screenshot.png", capture.screenshot]);
  for (const [name, data] of files) await writeFile(path.join(dir, name), data);
  return { dir, files: files.map(([name]) => name), summary };
}

export interface GeometryDiff {
  path: string;
  property: string;
  expected: string | number;
  actual: string | number | undefined;
}

const COMPARED: (keyof GeometryEntry)[] = [
  "x",
  "y",
  "w",
  "h",
  "color",
  "bg",
  "border",
  "radius",
  "font",
  "padding",
  "opacity",
  "before",
  "text",
];

export function compareGeometry(
  expected: GeometryEntry[],
  actual: GeometryEntry[],
  tolerance = 0.5,
): { compared: number; diffs: GeometryDiff[]; missing: string[]; extra: string[] } {
  const actualByPath = new Map(actual.map((g) => [g.path, g]));
  const expectedPaths = new Set(expected.map((g) => g.path));
  const diffs: GeometryDiff[] = [];
  const missing: string[] = [];
  let compared = 0;
  for (const exp of expected) {
    if (exp.hidden) continue;
    const act = actualByPath.get(exp.path);
    if (!act || act.hidden) {
      missing.push(exp.path);
      continue;
    }
    compared++;
    for (const prop of COMPARED) {
      const e = exp[prop];
      const a = act[prop];
      const same = typeof e === "number" ? Math.abs(e - (a as number)) <= tolerance : e === a;
      if (!same)
        diffs.push({
          path: exp.path,
          property: prop,
          expected: e as string | number,
          actual: a as string | number,
        });
    }
  }
  const extra = actual.filter((g) => !g.hidden && !expectedPaths.has(g.path)).map((g) => g.path);
  return { compared, diffs, missing, extra };
}

export interface VerifyResult {
  component: string;
  tag: string;
  reference: ComponentReference;
  theme: string;
  width: number;
  compared: number;
  diffs: GeometryDiff[];
  missing: string[];
  extra: string[];
  status: "verified" | "drift";
  screenshot?: Buffer;
}

/** Render a component's specimen and compare it with a stored capture. */
export async function verifyComponent(
  core: Core,
  system: string,
  component: DesignComponent,
  reference: ComponentReference,
  tolerance = 0.5,
): Promise<VerifyResult> {
  const sys = core.systems.get(system);
  const dir = core.systems.captureDirOf(system, reference.capture);
  let capture: StoredCapture;
  let expected: GeometryEntry[];
  try {
    capture = JSON.parse(await readFile(path.join(dir, "capture.json"), "utf8")) as StoredCapture;
    expected = JSON.parse(
      await readFile(path.join(dir, "geometry.json"), "utf8"),
    ) as GeometryEntry[];
  } catch {
    throw new CoreError(
      "NOT_FOUND",
      `Capture ${JSON.stringify(reference.capture)} not found in ${system} (run capture.element first)`,
    );
  }
  await core.buildSystem(system);
  const theme = reference.theme ?? capture.theme ?? sys.defaultTheme;
  const width = reference.width ?? capture.parentWidth;
  const sandbox = await core.sandboxUrl();
  const url = `${sandbox}/projects/${encodeURIComponent(sys.project)}/systems/${encodeURIComponent(sys.id)}/specimen.html?component=${encodeURIComponent(component.name)}&example=${reference.example}&theme=${encodeURIComponent(theme)}&bare&width=${Math.round(width * 100) / 100}`;
  const rootSelector = reference.root ?? component.tag;
  const ignore = reference.ignore ?? [];
  const actual = await withPage(
    {
      url,
      // Same viewport as the capture, so vw/vh-based sizes match.
      width: capture.viewport?.width ?? Math.max(1280, Math.ceil(width) + 40),
      height: capture.viewport?.height ?? 900,
      scale: 1,
      waitFor: "html[data-ready]",
    },
    async (page) => {
      await settle(page);
      const geometry = await page.evaluate(collectGeometry, {
        selector: rootSelector,
        exclude: ignore,
      });
      const shot = await page
        .locator(rootSelector)
        .first()
        .screenshot()
        .catch(() => undefined);
      return { geometry, shot };
    },
  );
  // Ignored subtrees are excluded on the specimen side; drop the same class paths from the reference.
  const ignoredClasses = ignore.map((sel) => sel.replace(/^\./, "").split(".").sort().join("."));
  const filteredExpected = ignoredClasses.length
    ? expected.filter(
        (g) =>
          !g.path.split(" > ").some((seg) =>
            ignoredClasses.some(
              (c) =>
                seg
                  .replace(/\[\d+\]$/, "")
                  .split(".")
                  .includes(c) || seg.replace(/\[\d+\]$/, "") === c,
            ),
          ),
      )
    : expected;
  const result = compareGeometry(filteredExpected, actual.geometry, tolerance);
  return {
    component: component.name,
    tag: component.tag,
    reference,
    theme,
    width,
    ...result,
    status: result.diffs.length === 0 && result.missing.length === 0 ? "verified" : "drift",
    ...(actual.shot ? { screenshot: actual.shot } : {}),
  };
}

export function describeDiffs(
  result: Pick<VerifyResult, "diffs" | "missing" | "extra">,
  limit = 25,
): string[] {
  const lines = [
    ...result.missing.slice(0, limit).map((p) => `missing: ${p}`),
    ...result.diffs
      .slice(0, limit)
      .map(
        (d) =>
          `${d.path} ${d.property}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual)}`,
      ),
  ];
  if (result.extra.length)
    lines.push(
      `extra (not in reference): ${result.extra.slice(0, 10).join(", ")}${result.extra.length > 10 ? ", …" : ""}`,
    );
  return lines;
}
