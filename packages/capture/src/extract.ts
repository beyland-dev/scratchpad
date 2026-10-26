/// <reference lib="dom" />
/* In-page functions: serialized by Playwright and run in the browser, so they must be self-contained. */

export interface GeometryEntry {
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  bg: string;
  border: string;
  radius: string;
  font: string;
  padding: string;
  display: string;
  opacity: string;
  before: string;
  text: string;
  hidden: boolean;
}

export interface CapturedRule {
  sheet: string;
  path: number[];
  wrappers: string[];
  selectors: string[];
  css: string;
  /** The rule's full selector text (before matching/state stripping). */
  selectorText?: string;
}

export interface ExtractOptions {
  selector: string;
  /** Descendants to leave out of rule matching and geometry (e.g. a third-party editor's internals). */
  exclude: string[];
  /** State classes ignored when matching selectors, so rules for those states are kept. */
  stateClasses: string[];
  /** Also return every custom property with this prefix, resolved on the root element. */
  allVarsPrefix?: string;
}

export interface ExtractResult {
  url: string;
  title: string;
  html: string;
  rect: { x: number; y: number; w: number; h: number };
  parentWidth: number;
  ancestors: {
    tag: string;
    id: string;
    classes: string;
    w: number;
    h: number;
    display: string;
    bg: string;
  }[];
  rules: CapturedRule[];
  keyframes: { sheet: string; path: number[]; name: string; css: string }[];
  fontFaces: { family: string; css: string; urls: string[] }[];
  vars: Record<string, string>;
  allVars?: Record<string, string>;
  inherited: Record<string, string>;
  geometry: GeometryEntry[];
}

/** Collect geometry/computed styles for `root` and its descendants, keyed by tag-agnostic class paths. */
export function collectGeometry(args: { selector: string; exclude: string[] }): GeometryEntry[] {
  const { selector, exclude } = args;
  const root = document.querySelector(selector);
  if (!root) throw new Error(`No element matches ${selector}`);
  const excluded = new Set<Element>();
  for (const sel of exclude)
    for (const el of root.querySelectorAll(sel))
      for (const d of [el, ...el.querySelectorAll("*")]) excluded.add(d);
  const rr = root.getBoundingClientRect();
  const segOf = (el: Element) => {
    const classes = [...el.classList].filter((c) => !c.startsWith("dt-")).sort();
    return classes.length ? classes.join(".") : el.localName.includes("-") ? "*" : el.localName;
  };
  // Classless custom elements (component wrappers around native controls, display: contents)
  // are layout-transparent: they get no geometry entry and no path segment.
  const transparent = (el: Element) =>
    el !== root &&
    el.localName.includes("-") &&
    ![...el.classList].some((c) => !c.startsWith("dt-"));
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
      if (transparent(n)) continue;
      const seg = segOf(n);
      let index = 0;
      let count = 0;
      let parent: Element | null = n.parentElement;
      while (parent && parent !== root && transparent(parent)) parent = parent.parentElement;
      if (parent) {
        const siblings: Element[] = [];
        const collect = (container: Element) => {
          for (const child of Array.from(container.children) as Element[])
            if (transparent(child)) collect(child);
            else siblings.push(child);
        };
        collect(parent);
        for (const sib of siblings) {
          if (segOf(sib) !== seg) continue;
          if (sib === n) index = count;
          count++;
        }
      }
      parts.unshift(count > 1 ? `${seg}[${index}]` : seg);
    }
    return parts.join(" > ") || "ROOT";
  };
  const out: GeometryEntry[] = [];
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (excluded.has(el) || transparent(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, "::before").content;
    const leaf = el.children.length === 0;
    out.push({
      path: pathOf(el),
      x: Math.round((r.x - rr.x) * 100) / 100,
      y: Math.round((r.y - rr.y) * 100) / 100,
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      color: cs.color,
      bg: cs.backgroundColor,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      radius: cs.borderTopLeftRadius,
      font: `${cs.fontSize} ${cs.fontWeight} ${cs.lineHeight}`,
      padding: cs.padding,
      display: cs.display,
      opacity: cs.opacity,
      before: before === "none" || before === "normal" ? "" : before,
      text: leaf ? (el.textContent ?? "").trim().slice(0, 80) : "",
      hidden:
        cs.display === "none" || cs.visibility === "hidden" || (r.width === 0 && r.height === 0),
    });
  }
  return out;
}

export function extractElement(options: ExtractOptions): ExtractResult {
  const root = document.querySelector(options.selector);
  if (!root) throw new Error(`No element matches ${options.selector}`);
  const excluded = new Set<Element>();
  for (const sel of options.exclude)
    for (const el of root.querySelectorAll(sel))
      for (const d of [el, ...el.querySelectorAll("*")]) excluded.add(d);
  const els = [root, ...root.querySelectorAll("*")].filter((e) => !excluded.has(e));

  const stateRe = options.stateClasses.length
    ? new RegExp(
        `\\.(${options.stateClasses.map((c) => c.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})(?![\\w-])`,
        "g",
      )
    : null;
  const strip = (sel: string) => {
    let s = sel
      .replace(
        /::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g,
        "",
      )
      .replace(
        /:(hover|focus-visible|focus-within|focus|active|visited|checked|disabled|enabled)\b/g,
        "",
      );
    if (stateRe) s = s.replace(stateRe, "");
    return s.replace(/:not\(\s*\)/g, "").replace(/:is\(\s*\)/g, "*");
  };
  const matches = (sel: string) => {
    const s = strip(sel).trim();
    if (!s) return false;
    try {
      return els.some((e) => e.matches(s));
    } catch {
      return false;
    }
  };
  const splitSelectors = (text: string) => {
    const out: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of text) {
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  // Inline <style> sheets are named by content, so labels stay stable as sheets come and go.
  const contentHash = (text: string) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  };
  const rules: CapturedRule[] = [];
  const keyframesAll: { sheet: string; path: number[]; name: string; css: string }[] = [];
  const fontFacesAll: { family: string; css: string; urls: string[]; base: string }[] = [];
  const walk = (
    list: CSSRuleList,
    wrappers: string[],
    parentSel: string | null,
    sheet: string,
    base: string,
    order: number[],
  ) => {
    Array.from(list).forEach((rule, i) => {
      const o = [...order, i];
      if (rule instanceof CSSStyleRule) {
        let sels = splitSelectors(rule.selectorText);
        if (parentSel)
          sels = sels.map((s) =>
            s.includes("&") ? s.replaceAll("&", `:is(${parentSel})`) : `:is(${parentSel}) ${s}`,
          );
        const matched = sels.filter(matches);
        if (matched.length && rule.style.length)
          rules.push({
            sheet,
            path: o,
            wrappers,
            selectors: matched,
            css: rule.style.cssText,
            selectorText: rule.selectorText,
          });
        if (rule.cssRules && rule.cssRules.length)
          walk(rule.cssRules, wrappers, sels.join(", "), sheet, base, o);
      } else if (rule instanceof CSSMediaRule)
        walk(
          rule.cssRules,
          [...wrappers, `@media ${rule.conditionText}`],
          parentSel,
          sheet,
          base,
          o,
        );
      else if (rule instanceof CSSSupportsRule)
        walk(
          rule.cssRules,
          [...wrappers, `@supports ${rule.conditionText}`],
          parentSel,
          sheet,
          base,
          o,
        );
      else if (typeof CSSContainerRule !== "undefined" && rule instanceof CSSContainerRule)
        walk(
          rule.cssRules,
          [
            ...wrappers,
            `@container ${rule.containerName ? `${rule.containerName} ` : ""}${rule.containerQuery}`,
          ],
          parentSel,
          sheet,
          base,
          o,
        );
      else if (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)
        walk(rule.cssRules, [...wrappers, `@layer ${rule.name}`], parentSel, sheet, base, o);
      else if (rule instanceof CSSKeyframesRule)
        keyframesAll.push({ sheet, path: o, name: rule.name, css: rule.cssText });
      else if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        const src = rule.style.getPropertyValue("src");
        const urls = [...src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => {
          try {
            return new URL(m[1]!, base).href;
          } catch {
            return m[1]!;
          }
        });
        fontFacesAll.push({ family, css: rule.cssText, urls, base });
      }
    });
  };
  Array.from(document.styleSheets).forEach((sheet, index) => {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      return;
    }
    const owner = sheet.ownerNode as Element | null;
    const label = sheet.href
      ? (sheet.href.split(/[?#]/)[0]!.split("/").pop() ?? `sheet-${index}`)
      : owner?.id ||
        (owner?.getAttribute?.("class") ?? "").split(/\s+/)[0] ||
        `inline-${contentHash(owner?.textContent ?? String(index))}`;
    walk(list, [], null, label, sheet.href ?? location.href, []);
  });

  const joined = rules.map((r) => r.css).join(";");
  const usedAnimations = new Set(
    [...joined.matchAll(/animation(?:-name)?:\s*([^;]+)/g)].flatMap((m) => m[1]!.split(/[\s,]+/)),
  );
  const keyframes = keyframesAll.filter((k) => usedAnimations.has(k.name));

  const families = new Set<string>();
  for (const e of els)
    for (const f of getComputedStyle(e).fontFamily.split(","))
      families.add(f.replace(/["']/g, "").trim());
  for (const m of joined.matchAll(/font(?:-family)?:\s*([^;]+)/g))
    for (const f of m[1]!.split(","))
      families.add(f.replace(/["']/g, "").trim().split(/\s+/).pop()!);
  const fontFaces = fontFacesAll
    .filter((f) => families.has(f.family))
    .map(({ family, css, urls }) => ({ family, css, urls }));

  const rootCS = getComputedStyle(root);
  const vars: Record<string, string> = {};
  for (const m of joined.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    const value = rootCS.getPropertyValue(m[1]!).trim();
    if (value) vars[m[1]!] = value;
  }
  let allVars: Record<string, string> | undefined;
  if (options.allVarsPrefix !== undefined) {
    allVars = {};
    for (let i = 0; i < rootCS.length; i++) {
      const p = rootCS[i]!;
      if (p.startsWith("--") && p.startsWith(options.allVarsPrefix))
        allVars[p] = rootCS.getPropertyValue(p).trim();
    }
  }
  const inherited: Record<string, string> = {};
  for (const p of [
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "-webkit-font-smoothing",
    "user-select",
  ]) {
    inherited[p] = rootCS.getPropertyValue(p);
  }
  const ancestors: ExtractResult["ancestors"] = [];
  for (let e = root.parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    ancestors.push({
      tag: e.localName,
      id: e.id,
      classes: e.getAttribute("class") ?? "",
      w: r.width,
      h: r.height,
      display: cs.display,
      bg: cs.backgroundColor,
    });
  }
  const rr = root.getBoundingClientRect();
  const parent = root.parentElement;
  const parentWidth = parent ? parent.getBoundingClientRect().width : rr.width;

  // Geometry is collected by a separate collectGeometry() call (serialized functions can't call each other).
  return {
    url: location.href,
    title: document.title,
    html: root.outerHTML,
    rect: { x: rr.x, y: rr.y, w: rr.width, h: rr.height },
    parentWidth,
    ancestors,
    rules,
    keyframes,
    fontFaces,
    vars,
    ...(allVars ? { allVars } : {}),
    inherited,
    geometry: [],
  };
}

/** Outline of a DOM subtree for finding selectors in a running app. */
export function outlineElement(args: {
  selector: string;
  depth: number;
  maxNodes: number;
  includeHidden: boolean;
}): string {
  const root = document.querySelector(args.selector);
  if (!root) throw new Error(`No element matches ${args.selector}`);
  const lines: string[] = [];
  const visit = (el: Element, level: number) => {
    if (lines.length >= args.maxNodes) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hidden =
      cs.display === "none" || cs.visibility === "hidden" || (r.width === 0 && r.height === 0);
    if (hidden && !args.includeHidden) return;
    const classes = [...el.classList]
      .slice(0, 8)
      .map((c) => `.${c}`)
      .join("");
    const role = el.getAttribute("role");
    const label = el.getAttribute("aria-label");
    const text = el.children.length === 0 ? (el.textContent ?? "").trim().slice(0, 40) : "";
    lines.push(
      `${"  ".repeat(level)}${el.localName}${el.id ? `#${el.id}` : ""}${classes}${role ? ` [role=${role}]` : ""}${label ? ` [aria-label="${label.slice(0, 40)}"]` : ""}${text ? ` "${text}"` : ""} ${Math.round(r.width)}×${Math.round(r.height)}${hidden ? " (hidden)" : ""}`,
    );
    if (level < args.depth) for (const child of el.children) visit(child, level + 1);
    else if (el.children.length)
      lines.push(`${"  ".repeat(level + 1)}… ${el.querySelectorAll("*").length} descendants`);
  };
  visit(root, 0);
  if (lines.length >= args.maxNodes) lines.push(`… truncated at ${args.maxNodes} nodes`);
  return lines.join("\n");
}

/** Read computed custom properties on an element. */
export function readCustomProperties(args: {
  selector: string;
  prefix: string;
}): Record<string, string> {
  const el = document.querySelector(args.selector) ?? document.documentElement;
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    if (p.startsWith("--") && p.startsWith(args.prefix)) out[p] = cs.getPropertyValue(p).trim();
  }
  return out;
}

/** Declarations serialized with an empty value (`border-top-color: ;`). */
export const EMPTY_DECLARATION_RE = /(^|;)\s*[-a-zA-Z]+:\s*(!important\s*)?(;|$)/;

/**
 * In-page (async): recover a rule's declaration block from its stylesheet's source text. Chrome
 * can't serialize a var()-based shorthand whose longhands were partly overridden (e.g.
 * `border: 1px solid var(--x); border-left-color: …`) and reports the longhands as empty values.
 */
export async function sourceDeclarations(args: {
  requests: { sheet: string; selector: string }[];
}): Promise<(string | null)[]> {
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/['"]/g, "");
  const contentHash = (text: string) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  };
  const texts = new Map<string, Promise<string>>();
  const sheetText = (label: string): Promise<string> => {
    let cached = texts.get(label);
    if (cached) return cached;
    cached = (async () => {
      const sheets = Array.from(document.styleSheets);
      for (let index = 0; index < sheets.length; index++) {
        const sheet = sheets[index]!;
        const owner = sheet.ownerNode as Element | null;
        const name = sheet.href
          ? (sheet.href.split(/[?#]/)[0]!.split("/").pop() ?? `sheet-${index}`)
          : owner?.id ||
            (owner?.getAttribute?.("class") ?? "").split(/\s+/)[0] ||
            `inline-${contentHash(owner?.textContent ?? String(index))}`;
        if (name !== label) continue;
        if (sheet.href) return fetch(sheet.href).then((r) => r.text());
        return owner?.textContent ?? "";
      }
      return "";
    })().then((t) => t.replace(/\/\*[\s\S]*?\*\//g, ""));
    texts.set(label, cached);
    return cached;
  };
  const out: (string | null)[] = [];
  for (const req of args.requests) {
    const text = await sheetText(req.sheet).catch(() => "");
    const want = norm(req.selector);
    let found: string | null = null;
    let start = 0;
    for (let i = 0; i < text.length && found === null; i++) {
      const ch = text[i];
      if (ch === "}" || ch === ";") start = i + 1;
      else if (ch === "{") {
        if (norm(text.slice(start, i)) === want) {
          let depth = 1;
          let j = i + 1;
          while (j < text.length && depth) {
            if (text[j] === "{") depth++;
            else if (text[j] === "}") depth--;
            j++;
          }
          const body = text.slice(i + 1, j - 1).trim();
          if (!body.includes("{")) found = body;
        }
        start = i + 1;
      }
    }
    out.push(found);
  }
  return out;
}
