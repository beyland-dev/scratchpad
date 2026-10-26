import { Code } from "../components/Code.tsx";
import { useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { Specimen, VerificationBadge } from "../components/Specimen.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemRevisionOf, workspace } from "../store.ts";
import type { ComponentSummary, DesignComponent, DesignSystem, Token } from "../types.ts";
import { copyText } from "../util.ts";
import { ThemePicker, TokenSwatch, useSystemTheme } from "./SystemView.tsx";

interface ComponentDetails {
  component: DesignComponent;
  snippet: string;
  files: { path: string; size: number }[];
  code?: { css: string; js: string };
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class="button small"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

const ALL_THEMES_KEY = "dt.component.allThemes";

export function ComponentView() {
  const { params } = useRoute();
  const id = params.id ?? "";
  const name = params.name ?? "";
  const revision = systemRevisionOf(id);
  const system = useCommand<{ system: DesignSystem; components: ComponentSummary[] }>(
    "system.get",
    { id },
    [revision],
  );
  const details = useCommand<ComponentDetails>(
    "component.get",
    { system: id, name, includeCode: true },
    [revision],
  );
  const tokens = useCommand<{ tokens: Token[] }>("token.search", { system: id, limit: 10000 }, [
    revision,
  ]);
  const [theme, setTheme] = useSystemTheme(system.data?.system);
  const [allThemes, setAllThemesState] = useState(
    () => localStorage.getItem(ALL_THEMES_KEY) !== "false",
  );
  const setAllThemes = (on: boolean) => {
    localStorage.setItem(ALL_THEMES_KEY, String(on));
    setAllThemesState(on);
  };
  const [codeTab, setCodeTab] = useState<"js" | "css">("js");

  if (details.error) return <p class="page-message error">{details.error}</p>;
  if (!details.data || !system.data) return <p class="page-message">Loading…</p>;
  const { component: c, snippet, code } = details.data;
  const sys = system.data.system;
  const byTag = new Map(system.data.components.map((x) => [x.tag, x]));
  const usedBy = system.data.components.filter(
    (x) => x.name !== c.name && (x.uses.includes(c.tag) || x.requires.includes(c.tag)),
  );
  const tokenByVar = new Map((tokens.data?.tokens ?? []).map((t) => [t.cssVar, t]));
  const themes = allThemes ? sys.themes.map((t) => t.id) : [theme];
  const sandbox = workspace.value?.urls.sandbox;
  const link = (tag: string) => {
    const target = byTag.get(tag);
    return target ? (
      <a
        href={`/systems/${encodeURIComponent(id)}/c/${encodeURIComponent(target.name)}?theme=${theme}`}
      >
        <code>&lt;{tag}&gt;</code>
      </a>
    ) : (
      <code>&lt;{tag}&gt;</code>
    );
  };

  return (
    <div class="page component-page">
      <div class="page-head">
        <div class="crumbs">
          <a href="/systems">Design systems</a> /{" "}
          <a href={`/systems/${encodeURIComponent(id)}?theme=${theme}`}>{sys.name}</a> /
        </div>
        <div class="page-title-row">
          <h1>{c.title}</h1>
          <code class="tag big">&lt;{c.tag}&gt;</code>
          <VerificationBadge status={c.verification?.status ?? "unverified"} />
          <span class="toolbar-spacer" />
          <label class="check">
            <input
              type="checkbox"
              checked={allThemes}
              onChange={(e) => setAllThemes(e.currentTarget.checked)}
            />{" "}
            All themes
          </label>
          {!allThemes && <ThemePicker system={sys} theme={theme} onChange={setTheme} />}
        </div>
        <div class="card-meta">
          <span class="chip">{c.kind}</span>
          <span class="chip muted">{c.category}</span>
          <span class="chip muted">{c.status}</span>
        </div>
        {c.description && <p>{c.description}</p>}
        {c.usage && (
          <p class="muted">
            <strong>Usage:</strong> {c.usage}
          </p>
        )}
        {c.issues?.length ? <p class="error">{c.issues.join("; ")}</p> : null}
      </div>

      <section>
        <h2 class="section-heading">Examples</h2>
        {c.examples.length === 0 && <p class="muted">No examples yet.</p>}
        {c.examples.map((example, i) => (
          <div class="example" key={i}>
            <div class="example-head">
              <strong>{example.title}</strong>
              {example.description && <span class="muted"> — {example.description}</span>}
              <span class="toolbar-spacer" />
              <CopyButton text={example.html} label="Copy HTML" />
            </div>
            <div class={`example-specimens ${themes.length > 1 ? "split" : ""}`}>
              {themes.map((t) => (
                <div key={t} class="example-specimen">
                  {themes.length > 1 && (
                    <div class="muted small">{sys.themes.find((x) => x.id === t)?.label}</div>
                  )}
                  <Specimen
                    system={id}
                    component={c.name}
                    example={i}
                    theme={t}
                    width={example.width}
                    title={`${example.title} (${t})`}
                  />
                </div>
              ))}
            </div>
            <Code code={example.html} lang="html" />
          </div>
        ))}
        <div class="example-head">
          <strong>Snippet with required context</strong>
          <span class="toolbar-spacer" />
          <CopyButton text={snippet} />
        </div>
        <Code code={snippet} lang="html" />
      </section>

      <div class="api-grid">
        <section>
          <h2 class="section-heading">Attributes</h2>
          {c.attributes.length ? (
            <table class="token-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {c.attributes.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <code>{a.name}</code>
                    </td>
                    <td class="small">
                      {a.type === "enum" && a.values ? a.values.join(" | ") : a.type}
                    </td>
                    <td>{a.default !== undefined && <code>{a.default}</code>}</td>
                    <td class="small">{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p class="muted">None.</p>
          )}
          {c.slots.length > 0 && (
            <>
              <h3>Slots</h3>
              <ul>
                {c.slots.map((s) => (
                  <li key={s.name}>
                    {s.name ? <code>slot="{s.name}"</code> : "default (children)"}{" "}
                    <span class="muted">{s.description}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {c.states.length > 0 && (
            <>
              <h3>States</h3>
              <ul>
                {c.states.map((s) => (
                  <li key={s.name}>
                    <code>{s.name}</code>
                    {s.trigger && <span class="muted"> ({s.trigger})</span>} {s.description}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h2 class="section-heading">Relationships</h2>
          <dl class="meta">
            <dt>Must be inside</dt>
            <dd>
              {c.requires.length ? (
                c.requires.map((t, i) => (
                  <span key={t}>
                    {i > 0 && " › "}
                    {link(t)}
                  </span>
                ))
              ) : (
                <span class="muted">—</span>
              )}
            </dd>
            <dt>Composed of</dt>
            <dd>
              {c.uses.length ? (
                c.uses.map((t) => <span key={t}>{link(t)} </span>)
              ) : (
                <span class="muted">—</span>
              )}
            </dd>
            <dt>Used by</dt>
            <dd>
              {usedBy.length ? (
                usedBy.map((x) => <span key={x.name}>{link(x.tag)} </span>)
              ) : (
                <span class="muted">—</span>
              )}
            </dd>
            <dt>Sources</dt>
            <dd>
              {c.sources.length ? (
                c.sources.map((s) => (
                  <div key={`${s.path}:${s.line}`}>
                    <code class="small">
                      {s.path}
                      {s.line ? `:${s.line}` : ""}
                    </code>
                    {s.note && <span class="muted small"> {s.note}</span>}
                  </div>
                ))
              ) : (
                <span class="muted">—</span>
              )}
            </dd>
          </dl>
          {c.tokens.length > 0 && (
            <>
              <h3>Tokens</h3>
              <ul class="token-list">
                {c.tokens.map((v) => {
                  const t = tokenByVar.get(v);
                  return (
                    <li key={v}>
                      {t?.type === "color" && <TokenSwatch value={t.values[theme] ?? t.value} />}
                      <code>{v}</code>
                      {t?.description && <span class="muted small"> {t.description}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <section>
        <h2 class="section-heading">
          Verification <VerificationBadge status={c.verification?.status ?? "unverified"} />
        </h2>
        {c.verification ? (
          <p class="muted small">
            Checked {new Date(c.verification.checkedAt).toLocaleString()} ·{" "}
            {c.verification.compared ?? 0} elements compared · {c.verification.diffs ?? 0}{" "}
            difference(s)
          </p>
        ) : (
          <p class="muted">
            Not verified yet. Run <code>capture_verify</code> once the component has references.
          </p>
        )}
        {c.verification?.summary?.length ? (
          <ul class="diff-list">
            {c.verification.summary.map((line) => (
              <li key={line}>
                <code class="small">{line}</code>
              </li>
            ))}
          </ul>
        ) : null}
        {c.references.map((ref, i) => (
          <div class="reference" key={i}>
            <div class="muted small">
              Reference <code>{ref.capture}</code> · example {ref.example}
              {ref.theme ? ` · ${ref.theme}` : ""}
            </div>
            <div class="reference-compare">
              <figure>
                <figcaption>Captured from the product</figcaption>
                {sandbox && (
                  <CaptureImage
                    base={`${sandbox}/s/${encodeURIComponent(id)}/~captures/${encodeURIComponent(ref.capture)}`}
                    alt={`Captured ${ref.capture}`}
                  />
                )}
              </figure>
              <figure>
                <figcaption>Library component</figcaption>
                <Specimen
                  system={id}
                  component={c.name}
                  example={ref.example}
                  theme={ref.theme ?? theme}
                  bare
                  width={ref.width}
                  title="Library rendering"
                />
              </figure>
            </div>
          </div>
        ))}
      </section>

      {code && (
        <section>
          <h2 class="section-heading">Code</h2>
          <div class="segmented">
            <button
              type="button"
              class={codeTab === "js" ? "active" : ""}
              onClick={() => setCodeTab("js")}
            >
              component.js
            </button>
            <button
              type="button"
              class={codeTab === "css" ? "active" : ""}
              onClick={() => setCodeTab("css")}
            >
              component.css
            </button>
          </div>
          <Code
            scroll
            lang={codeTab === "js" ? "javascript" : "css"}
            code={codeTab === "js" ? code.js || "// none" : code.css || "/* none */"}
          />
        </section>
      )}
    </div>
  );
}

/** A capture screenshot shown at CSS size (screenshots are taken at the capture's device scale). */
function CaptureImage({ base, alt }: { base: string; alt: string }) {
  const [scale, setScale] = useState(2);
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/capture.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((meta: { scale?: number } | null) => !cancelled && meta?.scale && setScale(meta.scale))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [base]);
  return (
    <img
      src={`${base}/screenshot.png`}
      alt={alt}
      onLoad={(e) => {
        e.currentTarget.style.width = `${e.currentTarget.naturalWidth / scale}px`;
      }}
    />
  );
}
