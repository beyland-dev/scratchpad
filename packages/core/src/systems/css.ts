/**
 * Minimal CSS statement splitter and provenance-aware merge.
 *
 * Captured rules are annotated with `/* @capture <sheet>@<path> *\/` where `<path>` is the
 * dotted index path of the rule in the source stylesheet (e.g. `workbench.css@0.4.12`).
 * When several components include the same captured rule it is emitted once, and all
 * captured rules are emitted in their original cascade order.
 */

export interface CssBlock {
  /** The statement text, including any leading comments. */
  text: string;
  /** Provenance key from a leading `@capture` comment, if present. */
  capture?: { sheet: string; path: number[]; key: string };
}

const CAPTURE_RE = /\/\*\s*@capture\s+([^\s@*]+)@([0-9.]+)\s*\*\//;

/** Split a stylesheet into top-level statements (rules and at-rules), keeping leading comments attached. */
export function splitCssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let start = 0;
  let depth = 0;
  let i = 0;
  const push = (end: number) => {
    const text = css.slice(start, end).trim();
    start = end;
    if (!text) return;
    const match = CAPTURE_RE.exec(text);
    blocks.push({
      text,
      ...(match
        ? {
            capture: {
              sheet: match[1]!,
              path: match[2]!.split(".").map(Number),
              key: `${match[1]}@${match[2]}`,
            },
          }
        : {}),
    });
  };
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close === -1 ? css.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) i += css[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        push(i + 1);
      }
    } else if (ch === ";" && depth === 0) {
      push(i + 1);
    }
    i++;
  }
  const rest = css.slice(start).trim();
  if (rest && !/^(\/\*[\s\S]*?\*\/\s*)*$/.test(rest)) blocks.push({ text: rest });
  return blocks;
}

function comparePaths(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

export interface MergeInput {
  /** Label for provenance comments of uncaptured blocks (e.g. the component name). */
  origin: string;
  css: string;
}

export interface MergeResult {
  css: string;
  captured: number;
  duplicates: number;
  authored: number;
}

/** Locate the selector list of a block's (innermost) style rule. */
function selectorSpan(text: string): { start: number; end: number } | undefined {
  const firstClose = text.indexOf("}");
  if (firstClose === -1) return undefined;
  const open = text.lastIndexOf("{", firstClose);
  if (open === -1 || !/^[\s}]*$/.test(text.slice(firstClose + 1))) return undefined;
  const before = text.lastIndexOf("{", open - 1);
  const commentEnd = text.lastIndexOf("*/", open);
  const start = Math.max(before + 1, commentEnd === -1 ? 0 : commentEnd + 2);
  return { start, end: open };
}

/** Whether two blocks have the same wrappers and declarations (ignoring their selector lists). */
function sameDeclarations(a: string, b: string): boolean {
  const sa = selectorSpan(a);
  const sb = selectorSpan(b);
  if (!sa || !sb) return false;
  const strip = (text: string, span: { start: number; end: number }) =>
    (text.slice(0, span.start) + text.slice(span.end))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, "");
  return strip(a, sa) === strip(b, sb);
}

/** Merge the selector lists of two copies of the same captured rule. */
export function unionSelectors(a: string, b: string): string {
  const sa = selectorSpan(a);
  const sb = selectorSpan(b);
  if (!sa || !sb) return a.length >= b.length ? a : b;
  const list = (text: string, span: { start: number; end: number }) =>
    splitTopLevel(text.slice(span.start, span.end), ",")
      .map((x) => x.trim())
      .filter(Boolean);
  const mine = list(a, sa);
  const extra = list(b, sb).filter((x) => !mine.includes(x));
  if (!extra.length) return a;
  const indent = /\n([ \t]*)\S[^\n]*$/.exec(a.slice(0, sa.end))?.[1] ?? "";
  return `${a.slice(0, sa.start)}${a.slice(sa.start, sa.end).match(/^\s*/)![0]}${[...mine, ...extra].join(`,\n${indent}`)} ${a.slice(sa.end)}`;
}

/**
 * Merge stylesheets: captured blocks (deduplicated, in cascade order, sheets ordered by
 * `sheetOrder` then alphabetically) first, then authored blocks in input order.
 */
export function mergeStylesheets(inputs: MergeInput[], sheetOrder: string[] = []): MergeResult {
  const captured = new Map<string, CssBlock>();
  const authored: { origin: string; block: CssBlock }[] = [];
  let duplicates = 0;
  for (const input of inputs) {
    for (const block of splitCssBlocks(input.css)) {
      if (block.capture) {
        // Captures keep only the selectors that matched their element, so copies of the same
        // source rule can list different selectors: keep their union. Copies whose declarations
        // differ are different rules that happen to share a label (e.g. a regenerated inline
        // sheet), so both are kept.
        let key = block.capture.key;
        for (let n = 2; ; n++) {
          const existing = captured.get(key);
          if (!existing) {
            captured.set(key, block);
            break;
          }
          if (existing.text === block.text || sameDeclarations(existing.text, block.text)) {
            duplicates++;
            if (existing.text !== block.text)
              captured.set(key, { ...existing, text: unionSelectors(existing.text, block.text) });
            break;
          }
          key = `${block.capture.key}#${n}`;
        }
      } else {
        authored.push({ origin: input.origin, block });
      }
    }
  }
  const rank = (sheet: string) => {
    const i = sheetOrder.indexOf(sheet.split("~")[0]!);
    return i === -1 ? sheetOrder.length : i;
  };
  const ordered = [...captured.values()].sort(
    (a, b) =>
      rank(a.capture!.sheet) - rank(b.capture!.sheet) ||
      a.capture!.sheet.localeCompare(b.capture!.sheet) ||
      comparePaths(a.capture!.path, b.capture!.path),
  );
  const parts: string[] = [];
  if (ordered.length)
    parts.push("/* ---- Captured rules (cascade order) ---- */", ...ordered.map((b) => b.text));
  let lastOrigin = "";
  for (const { origin, block } of authored) {
    if (origin !== lastOrigin) {
      parts.push(`/* ---- ${origin} ---- */`);
      lastOrigin = origin;
    }
    parts.push(block.text);
  }
  return {
    css: `${parts.join("\n\n")}\n`,
    captured: ordered.length,
    duplicates,
    authored: authored.length,
  };
}

const VAR_RE = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/** CSS custom properties referenced by a stylesheet. */
export function referencedVars(css: string): string[] {
  return [...new Set([...css.matchAll(VAR_RE)].map((m) => m[1]!))].sort();
}

/** Split on a separator character at the top level (outside parentheses, brackets and strings). */
export function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"' || ch === "'") {
      i++;
      while (i < text.length && text[i] !== ch) i += text[i] === "\\" ? 2 : 1;
    } else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === sep && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/** End index of a selector's first compound (its first top-level combinator, or the end). */
function firstCompoundEnd(selector: string): number {
  let depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!;
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && /[\s>+~]/.test(ch)) return i;
  }
  return selector.length;
}

const SIMPLE_RE = /[.#][A-Za-z0-9_-]+|\[[^\]]+\]/g;

export interface ThemeScope {
  /** Theme id, appended to the provenance sheet name (`<sheet>~<theme>`). */
  id: string;
  /** Full selector of the theme root, e.g. `.monaco-workbench.vs-dark`. */
  selector: string;
  /** The theme root without the theme's classes, e.g. `.monaco-workbench` ("" if not class-based). */
  root: string;
  /** The theme's classes as a compound, e.g. `.vs-dark.vscode-theme-x`. */
  classes: string;
}

/** Restrict a selector to a theme without changing its specificity. */
export function scopeSelectorToTheme(selector: string, scope: ThemeScope): string {
  const sel = selector.trim();
  const end = firstCompoundEnd(sel);
  const first = sel.slice(0, end);
  const rootParts = scope.root.match(SIMPLE_RE) ?? [];
  const firstParts = new Set(first.match(SIMPLE_RE) ?? []);
  if (scope.root && scope.classes && rootParts.every((p) => firstParts.has(p))) {
    const pseudo = first.indexOf("::");
    const at = pseudo === -1 ? end : pseudo;
    return `${sel.slice(0, at)}:where(${scope.classes})${sel.slice(at)}`;
  }
  return `:where(${scope.selector}) ${sel}`;
}

const DECLS_RE = /\{([\s\S]*)\}\s*$/;

/**
 * Prepare a capture's annotated rules for inclusion in a component: drops comments other than
 * provenance, and — for rules from `themeSheets` — scopes them to the capture's theme (renaming the
 * sheet to `<sheet>~<theme>` so other themes' rules don't deduplicate against them) or drops
 * them when they only set token variables.
 */
export function prepareCapturedCss(
  css: string,
  opts: { themeSheets: string[]; theme?: ThemeScope; tokenVars: Set<string> },
): string {
  const out: string[] = [];
  for (const block of splitCssBlocks(css)) {
    if (!block.capture) continue;
    const text = block.text.slice(block.text.search(CAPTURE_RE));
    if (!opts.themeSheets.includes(block.capture.sheet) || !opts.theme) {
      out.push(text);
      continue;
    }
    const body = text.replace(CAPTURE_RE, "").trim();
    if (body.startsWith("@")) {
      out.push(text);
      continue;
    }
    const decls = splitTopLevel(DECLS_RE.exec(body)?.[1] ?? "", ";")
      .map((d) => d.trim())
      .filter(Boolean);
    const props = decls.map((d) => d.slice(0, d.indexOf(":")).trim());
    if (props.length && props.every((p) => p.startsWith("--") && opts.tokenVars.has(p))) continue;
    const prelude = body.slice(0, body.indexOf("{"));
    const scoped = splitTopLevel(prelude, ",")
      .map((s) => scopeSelectorToTheme(s, opts.theme!))
      .join(",\n");
    const { sheet, path } = block.capture;
    out.push(
      `/* @capture ${sheet}~${opts.theme.id}@${path.join(".")} */\n${scoped} ${body.slice(body.indexOf("{"))}`,
    );
  }
  return out.length ? `${out.join("\n\n")}\n` : "";
}

/** Rewrite type selectors in one selector list, e.g. `li` → `:is(li, vsc-action)`. */
function widenSelector(selector: string, map: Map<string, string[]>): string {
  let out = "";
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i]!;
    if (ch === '"' || ch === "'" || ch === "[") {
      const close = ch === "[" ? "]" : ch;
      let j = i + 1;
      while (j < selector.length && selector[j] !== close) j += selector[j] === "\\" ? 2 : 1;
      out += selector.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const prev = i === 0 ? "" : selector[i - 1]!;
    if (/[A-Za-z]/.test(ch) && (prev === "" || /[\s>+~,(]/.test(prev))) {
      const m = /^[A-Za-z][A-Za-z0-9-]*/.exec(selector.slice(i))!;
      const word = m[0];
      const next = selector[i + word.length];
      const tags = map.get(word.toLowerCase());
      out += tags && next !== "(" ? `:is(${[word, ...tags].join(", ")})` : word;
      i += word.length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Widen type selectors for native elements that components stand in for (`hostTag`), so
 * captured rules like `.actions-container > li` also match `<vsc-action>` hosts. Specificity is
 * unchanged (`:is()` takes its most specific argument, a type selector).
 */
export function widenTypeSelectors(css: string, map: Map<string, string[]>): string {
  if (!map.size) return css;
  let out = "";
  let start = 0;
  const stack: ("rule" | "at")[] = [];
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close === -1 ? css.length : close + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) i += css[i] === "\\" ? 2 : 1;
      continue;
    }
    if (ch === "{") {
      const prelude = css.slice(start, i);
      const commentEnd = prelude.lastIndexOf("*/") + 1;
      const head = commentEnd ? prelude.slice(0, commentEnd + 1) : "";
      const selector = prelude.slice(head.length);
      const isAt = selector.trim().startsWith("@");
      const inRule = stack.includes("rule");
      out += head + (isAt || inRule ? selector : widenSelector(selector, map)) + "{";
      stack.push(isAt ? "at" : "rule");
      start = i + 1;
    } else if (ch === "}" || ch === ";") {
      out += css.slice(start, i + 1);
      if (ch === "}") stack.pop();
      start = i + 1;
    }
  }
  return out + css.slice(start);
}
