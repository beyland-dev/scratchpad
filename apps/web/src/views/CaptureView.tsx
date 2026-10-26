import { Code } from "../components/Code.tsx";
import { useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { useCommand } from "../hooks/useCommand.ts";
import { systemEventOf } from "../store.ts";
import type { DesignSystem } from "../types.ts";
import { relativeTime } from "../util.ts";
import {
  captureBase,
  captureHref,
  componentHref,
  groupCaptures,
  useCaptures,
} from "./discovery.tsx";

interface CaptureMeta {
  url?: string;
  selector?: string;
  theme?: string;
  capturedAt?: string;
  rect?: { w: number; h: number };
  parentWidth?: number;
  scale?: number;
  exclude?: string[];
  ancestors?: { tag: string; classes: string; w: number; h: number; display: string }[];
  inherited?: Record<string, string>;
  vars?: Record<string, string>;
  fontFaces?: { family: string }[];
}

interface GeometryEntry {
  path: string;
  w: number;
  h: number;
  x: number;
  y: number;
  hidden?: boolean;
  bg?: string;
  color?: string;
  font?: string;
}

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "source", "col", "wbr"]);

/** Indent captured markup for reading (one tag per line). */
export function prettyHtml(html: string): string {
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  const out: string[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      out.push(`${"  ".repeat(depth)}${token}`);
    } else if (token.startsWith("<")) {
      out.push(`${"  ".repeat(depth)}${token}`);
      const tag = /^<([a-zA-Z0-9-]+)/.exec(token)?.[1]?.toLowerCase() ?? "";
      if (!token.endsWith("/>") && !VOID.has(tag) && !token.startsWith("<!")) depth++;
    } else if (token.trim()) {
      out.push(`${"  ".repeat(depth)}${token.trim()}`);
    }
  }
  return out.join("\n");
}

function useText(url: string, deps: unknown[]): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setText(""));
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  return text;
}

const TABS = [
  { id: "dom", label: "DOM" },
  { id: "css", label: "Matched CSS" },
  { id: "geometry", label: "Geometry" },
  { id: "context", label: "Context" },
];

export function CaptureView() {
  const { params } = useRoute();
  const id = params.id ?? "";
  const label = params.label ?? "";
  const rev = systemEventOf(id);
  const { data: sys } = useCommand<{ system: DesignSystem }>("system.get", { id }, []);
  const { data: list, error } = useCaptures(id);
  const [tab, setTab] = useState("dom");
  const base = captureBase(id, label);
  const capture = list?.captures.find((c) => c.label === label);
  const stamp = capture?.capturedAt ?? String(rev);
  const metaText = useText(`${base}/capture.json?v=${stamp}`, [stamp]);
  const dom = useText(`${base}/dom.html?v=${stamp}`, [stamp]);
  const css = useText(`${base}/rules.css?v=${stamp}`, [stamp]);
  const geometryText = useText(`${base}/geometry.json?v=${stamp}`, [stamp]);

  if (error) return <p class="page-message error">{error}</p>;
  if (!list || !sys) return <p class="page-message">Loading…</p>;
  if (!capture) return <p class="page-message">No capture {label}.</p>;
  const meta = metaText ? (JSON.parse(metaText) as CaptureMeta) : undefined;
  const geometry = geometryText ? (JSON.parse(geometryText) as GeometryEntry[]) : [];
  const siblings =
    groupCaptures(list.captures, sys.system).find((g) => g.captures.some((c) => c.label === label))
      ?.captures ?? [];
  const themeLabel = (t?: string) => sys.system.themes.find((x) => x.id === t)?.label ?? t ?? "—";

  return (
    <div class="page capture-page">
      <div class="page-head">
        <div class="crumbs">
          <a href="/systems">Design systems</a> /{" "}
          <a href={`/systems/${encodeURIComponent(id)}?tab=captures`}>{sys.system.name}</a> /
          captures /
        </div>
        <div class="page-title-row">
          <h1>{capture.label}</h1>
          <span class="toolbar-spacer" />
          {siblings.length > 1 && (
            <div class="segmented" aria-label="Theme">
              {siblings.map((c) => (
                <a
                  key={c.label}
                  class={`segmented-link ${c.label === label ? "active" : ""}`}
                  href={captureHref(id, c.label)}
                >
                  {themeLabel(c.theme)}
                </a>
              ))}
            </div>
          )}
        </div>
        <code class="selector big">{capture.selector}</code>
        <div class="card-meta">
          <span class="chip">
            {Math.round(capture.width ?? 0)}×{Math.round(capture.height ?? 0)} px
          </span>
          <span class="chip">{capture.elements} elements</span>
          <span class="chip">{capture.rules} matched rules</span>
          {meta?.vars && <span class="chip">{Object.keys(meta.vars).length} variables</span>}
          <span class="chip muted">{themeLabel(capture.theme)}</span>
          <span class="chip muted" title={capture.capturedAt}>
            captured {relativeTime(capture.capturedAt ?? "")}
          </span>
        </div>
      </div>

      <div class="capture-detail">
        <figure class="capture-shot">
          <img
            src={`${base}/screenshot.png?v=${encodeURIComponent(stamp)}`}
            alt={capture.label}
            style={{ width: capture.width ? `${capture.width}px` : undefined }}
          />
        </figure>
        <aside class="capture-facts">
          <h3>Used by</h3>
          {capture.usedBy.length ? (
            <ul class="plain">
              {capture.usedBy.map((u) => (
                <li key={u.name}>
                  <a href={componentHref(id, u.name)}>
                    <code class="tag">&lt;{u.tag}&gt;</code>
                  </a>{" "}
                  <span class="muted small">{u.as.join(" + ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted small">Not used by a component yet.</p>
          )}
          <h3>Rendered inside</h3>
          <p class="small">
            {capture.context || "—"}
            {capture.parentWidth ? (
              <span class="muted"> · parent {Math.round(capture.parentWidth)}px wide</span>
            ) : null}
          </p>
          {meta?.exclude?.length ? (
            <>
              <h3>Excluded</h3>
              <ul class="plain small">
                {meta.exclude.map((x) => (
                  <li key={x}>
                    <code>{x}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {meta?.fontFaces?.length ? (
            <>
              <h3>Fonts</h3>
              <p class="small">{meta.fontFaces.map((f) => f.family).join(", ")}</p>
            </>
          ) : null}
          {meta?.url && (
            <>
              <h3>Source</h3>
              <p class="small muted break">{meta.url}</p>
            </>
          )}
        </aside>
      </div>

      <div class="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            class={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dom" && (
        <Code scroll lang="html" code={dom === null ? "Loading…" : prettyHtml(dom)} />
      )}
      {tab === "css" && <Code scroll lang="css" code={css ?? "Loading…"} />}
      {tab === "geometry" && (
        <table class="token-table geometry-table">
          <thead>
            <tr>
              <th>Element (class path)</th>
              <th>Box</th>
              <th>Background</th>
              <th>Font</th>
            </tr>
          </thead>
          <tbody>
            {geometry
              .filter((g) => !g.hidden)
              .map((g) => {
                const segments = g.path.split(" > ");
                return (
                  <tr key={g.path}>
                    <td>
                      <code style={{ paddingLeft: `${(segments.length - 1) * 12}px` }}>
                        {segments.at(-1)}
                      </code>
                    </td>
                    <td class="small">
                      {round(g.w)}×{round(g.h)} @ {round(g.x)},{round(g.y)}
                    </td>
                    <td class="small">
                      {g.bg && g.bg !== "rgba(0, 0, 0, 0)" ? (
                        <>
                          <span class="swatch" style={{ "--swatch": g.bg }} /> {g.bg}
                        </>
                      ) : (
                        <span class="muted">—</span>
                      )}
                    </td>
                    <td class="small muted">{g.font}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
      {tab === "context" && (
        <div class="capture-context">
          <h3>Ancestors (nearest first)</h3>
          <ol class="ancestors">
            {(meta?.ancestors ?? []).map((a, i) => (
              <li key={i}>
                <code>
                  {a.tag}
                  {a.classes.trim() ? `.${a.classes.trim().split(/\s+/).join(".")}` : ""}
                </code>{" "}
                <span class="muted small">
                  {round(a.w)}×{round(a.h)} · {a.display}
                </span>
              </li>
            ))}
          </ol>
          {meta?.inherited && (
            <>
              <h3>Inherited styles</h3>
              <Code
                lang="css"
                code={Object.entries(meta.inherited)
                  .map(([k, v]) => `${k}: ${v};`)
                  .join("\n")}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
