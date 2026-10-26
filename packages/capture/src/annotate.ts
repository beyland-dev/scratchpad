import type { CapturedRule, ExtractResult } from "./extract.ts";

/** Escape private-use characters (icon font glyphs) so CSS files stay ASCII-safe. */
export function escapeGlyphs(css: string): string {
  return css.replace(
    /[\u{e000}-\u{f8ff}\u{f0000}-\u{ffffd}]/gu,
    (c) => `\\${c.codePointAt(0)!.toString(16)}`,
  );
}

function block(selectors: string[], css: string, wrappers: string[]): string {
  let out = `${selectors.join(",\n")} {\n  ${escapeGlyphs(css).replace(/;\s(?=[-a-zA-Z])/g, ";\n  ")}\n}`;
  for (const w of [...wrappers].reverse()) out = `${w} {\n${out.replace(/^/gm, "  ")}\n}`;
  return out;
}

/**
 * Render captured rules as CSS annotated with `@capture <sheet>@<path>` provenance, the format
 * `system.build` uses to deduplicate and keep cascade order across components.
 */
export function rulesToCss(
  result: Pick<ExtractResult, "rules" | "keyframes">,
  header?: string,
): string {
  const parts: string[] = [];
  if (header) parts.push(`/*\n${header.replace(/^/gm, " * ")}\n */`);
  const all: { sheet: string; path: number[]; text: string }[] = [
    ...result.rules.map((r: CapturedRule) => ({
      sheet: r.sheet,
      path: r.path,
      text: block(r.selectors, r.css, r.wrappers),
    })),
    ...result.keyframes.map((k) => ({ sheet: k.sheet, path: k.path, text: escapeGlyphs(k.css) })),
  ];
  for (const r of all) parts.push(`/* @capture ${r.sheet}@${r.path.join(".")} */\n${r.text}`);
  return `${parts.join("\n\n")}\n`;
}
