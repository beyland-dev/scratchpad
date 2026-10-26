import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { HighlighterCore, ThemedToken } from "shiki/core";

export type CodeLang = "html" | "css" | "javascript" | "json" | "shellscript";

/** Larger inputs render as plain text (tokenizing them would block the UI). */
const MAX_HIGHLIGHT_CHARS = 60_000;
const CACHE_LIMIT = 40;

let highlighter: Promise<HighlighterCore> | undefined;

/** One shared, lazily loaded highlighter: core + JS regex engine (no WASM) + only the languages we show. */
function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
      langs: [
        import("shiki/langs/html.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/shellscript.mjs"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighter;
}

const cache = new Map<string, ThemedToken[][]>();

async function tokenize(code: string, lang: CodeLang): Promise<ThemedToken[][]> {
  const key = `${lang}\u0000${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hl = await getHighlighter();
  const { tokens } = hl.codeToTokens(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  cache.set(key, tokens);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return tokens;
}

function useTokens(code: string, lang: CodeLang): ThemedToken[][] | null {
  const tooBig = code.length > MAX_HIGHLIGHT_CHARS;
  const [state, setState] = useState<{ key: string; tokens: ThemedToken[][] } | null>(null);
  const key = `${lang}\u0000${code}`;
  useEffect(() => {
    if (tooBig) return;
    let cancelled = false;
    tokenize(code, lang)
      .then((tokens) => !cancelled && setState({ key, tokens }))
      .catch((error: unknown) => console.warn("[design-tool] highlighting failed", error));
    return () => {
      cancelled = true;
    };
  }, [key, tooBig]);
  return state?.key === key ? state.tokens : null;
}

/** A syntax-highlighted code block (light/dark themes follow the app's color scheme). */
export function Code({
  code,
  lang,
  scroll = false,
  class: className,
}: {
  code: string;
  lang: CodeLang;
  scroll?: boolean;
  class?: string;
}) {
  const tokens = useTokens(code, lang);
  return (
    <pre
      class={["code", "shiki-code", scroll ? "code-scroll" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-lang={lang}
    >
      <code>
        {tokens
          ? tokens.map((line, i) => (
              <Fragment key={i}>
                {line.map((token, j) => (
                  <span key={j} style={token.htmlStyle as Record<string, string>}>
                    {token.content}
                  </span>
                ))}
                {i < tokens.length - 1 ? "\n" : null}
              </Fragment>
            ))
          : code}
      </code>
    </pre>
  );
}
