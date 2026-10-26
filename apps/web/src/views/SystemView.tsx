import { Code } from "../components/Code.tsx";
import { useMemo, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { Specimen, VerificationBadge } from "../components/Specimen.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemEventOf, systemRevisionOf } from "../store.ts";
import { CapturesTab, DiscoveryOverview, DiscoveryPipeline, useCaptures } from "./discovery.tsx";
import type { ComponentSummary, DesignSystem, Token } from "../types.ts";
import { copyText } from "../util.ts";

interface SystemDetails {
  system: DesignSystem;
  components: ComponentSummary[];
  tokens: { total: number; groups: Record<string, number> };
  include: string;
  skill: string;
  urls: { css: string; js: string };
  lastBuild?: { ok: boolean; at: string; error?: string; result?: { warnings: string[] } };
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "components", label: "Components" },
  { id: "captures", label: "Captures" },
  { id: "colors", label: "Colors" },
  { id: "tokens", label: "Tokens" },
  { id: "setup", label: "Setup & notes" },
];

export function useSystemTheme(
  system: DesignSystem | undefined,
): [string, (theme: string) => void] {
  const { query, path } = useRoute();
  const { route } = useLocation();
  const theme = query.theme ?? system?.defaultTheme ?? "";
  const setTheme = (t: string) => {
    const params = new URLSearchParams(query);
    params.set("theme", t);
    route(`${path}?${params.toString()}`, true);
  };
  return [theme, setTheme];
}

export function ThemePicker({
  system,
  theme,
  onChange,
}: {
  system: DesignSystem;
  theme: string;
  onChange: (t: string) => void;
}) {
  return (
    <div class="segmented" aria-label="Theme">
      {system.themes.map((t) => (
        <button
          type="button"
          key={t.id}
          class={t.id === theme ? "active" : ""}
          aria-pressed={t.id === theme}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SystemView() {
  const { params, query, path } = useRoute();
  const { route } = useLocation();
  const id = params.id ?? "";
  const revision = systemRevisionOf(id);
  const { data, error } = useCommand<SystemDetails>("system.get", { id }, [
    revision,
    systemEventOf(id),
  ]);
  const { data: captureData } = useCaptures(id);
  const [theme, setTheme] = useSystemTheme(data?.system);
  const tab = query.tab ?? "overview";

  if (error) return <p class="page-message error">{error}</p>;
  if (!data) return <p class="page-message">Loading…</p>;
  const { system } = data;
  const warnings = data.lastBuild?.result?.warnings ?? [];

  return (
    <div class="page system-page">
      <div class="page-head">
        <div class="crumbs">
          <a href="/systems">Design systems</a> /
        </div>
        <div class="page-title-row">
          <h1>{system.name}</h1>
          <span class="toolbar-spacer" />
          <ThemePicker system={system} theme={theme} onChange={setTheme} />
        </div>
        {system.description && <p class="muted">{system.description}</p>}
        <div class="card-meta">
          {system.capturedFrom?.product && (
            <span class="chip muted">
              from {system.capturedFrom.product}
              {system.capturedFrom.version ? ` ${system.capturedFrom.version}` : ""}
              {system.capturedFrom.commit ? ` @ ${system.capturedFrom.commit.slice(0, 8)}` : ""}
            </span>
          )}
          {data.lastBuild && !data.lastBuild.ok && (
            <span class="chip warn">build failed: {data.lastBuild.error}</span>
          )}
        </div>
        <DiscoveryPipeline
          system={system}
          tokens={data.tokens}
          components={data.components}
          captures={captureData?.captures}
          warnings={warnings.length}
        />
      </div>
      <div class="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            class={tab === t.id ? "active" : ""}
            onClick={() => {
              const p = new URLSearchParams(query);
              p.set("tab", t.id);
              route(`${path}?${p.toString()}`, true);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <DiscoveryOverview
          id={id}
          system={system}
          components={data.components}
          captures={captureData?.captures}
          theme={theme}
        />
      )}
      {tab === "components" && <ComponentsTab id={id} components={data.components} theme={theme} />}
      {tab === "captures" && (
        <CapturesTab id={id} system={system} captures={captureData?.captures} />
      )}
      {tab === "colors" && <TokensTab id={id} system={system} type="color" />}
      {tab === "tokens" && <TokensTab id={id} system={system} />}
      {tab === "setup" && <SetupTab data={data} />}
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  context: "Contexts",
  component: "Components",
  pattern: "Patterns",
};

function ComponentsTab({
  id,
  components,
  theme,
}: {
  id: string;
  components: ComponentSummary[];
  theme: string;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = components.filter(
    (c) => !q || `${c.tag} ${c.title} ${c.category} ${c.summary}`.toLowerCase().includes(q),
  );
  if (!components.length) return <p class="page-message">No components yet.</p>;
  return (
    <div>
      <div class="toolbar">
        <input
          class="input"
          type="search"
          placeholder="Search components"
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
          aria-label="Search components"
        />
        <span class="toolbar-spacer" />
        <span class="muted">
          {visible.length} of {components.length}
        </span>
      </div>
      {(["pattern", "component", "context"] as const).map((kind) => {
        const items = visible.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} class="component-section">
            <h2 class="section-heading">
              {KIND_LABELS[kind]} <span class="muted">{items.length}</span>
            </h2>
            <div class="grid component-grid">
              {items.map((c) => (
                <article class="card component-card" key={c.name}>
                  <a
                    class="component-preview"
                    href={`/systems/${encodeURIComponent(id)}/c/${encodeURIComponent(c.name)}?theme=${theme}`}
                  >
                    {kind !== "context" ? (
                      <Specimen
                        system={id}
                        component={c.name}
                        theme={theme}
                        maxHeight={260}
                        title={`${c.title} preview`}
                      />
                    ) : (
                      <div class="context-placeholder">context</div>
                    )}
                  </a>
                  <div class="card-body">
                    <div class="card-title-row">
                      <a
                        class="card-title"
                        href={`/systems/${encodeURIComponent(id)}/c/${encodeURIComponent(c.name)}?theme=${theme}`}
                      >
                        {c.title}
                      </a>
                      <VerificationBadge status={c.verification} />
                    </div>
                    <code class="tag">&lt;{c.tag}&gt;</code>
                    <p class="muted small">{c.summary}</p>
                    {c.issues?.length ? <span class="chip warn">⚠ {c.issues.length}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TokenSwatch({ value }: { value: string | undefined }) {
  if (!value) return <span class="swatch empty" title="not set" />;
  return <span class="swatch" title={value} style={{ "--swatch": value }} />;
}

function TokensTab({ id, system, type }: { id: string; system: DesignSystem; type?: "color" }) {
  const revision = systemRevisionOf(id);
  const { data, error } = useCommand<{ tokens: Token[]; total: number }>(
    "token.search",
    { system: id, ...(type ? { type } : {}), limit: 10000 },
    [revision],
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const tokens = useMemo(
    () => (data?.tokens ?? []).filter((t) => (type ? true : t.type !== "color")),
    [data, type],
  );
  const q = search.trim().toLowerCase();
  const filtered = q
    ? tokens.filter((t) =>
        `${t.name} ${t.cssVar} ${t.description ?? ""} ${Object.values(t.values).join(" ")} ${t.value ?? ""}`
          .toLowerCase()
          .includes(q),
      )
    : tokens;
  const groups = useMemo(() => {
    const map = new Map<string, Token[]>();
    for (const t of filtered) {
      const g = t.group ?? "other";
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (error) return <p class="page-message error">{error}</p>;
  if (!data) return <p class="page-message">Loading tokens…</p>;
  if (!tokens.length)
    return <p class="page-message">No {type === "color" ? "color " : ""}tokens yet.</p>;
  const expandAll = q.length > 0 || groups.length <= 3;
  const copy = async (text: string) => {
    if (await copyText(text)) {
      setCopied(text);
      setTimeout(() => setCopied(null), 1200);
    }
  };

  return (
    <div>
      <div class="toolbar">
        <input
          class="input"
          type="search"
          placeholder="Search name, variable, value or description"
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
          aria-label="Search tokens"
        />
        <span class="toolbar-spacer" />
        <span class="muted">
          {filtered.length} of {tokens.length} · {groups.length} groups
        </span>
      </div>
      <div class="token-groups">
        {groups.map(([group, list]) => {
          const isOpen = expandAll || open.has(group);
          return (
            <section class="token-group" key={group}>
              <button
                type="button"
                class="token-group-head"
                aria-expanded={isOpen}
                onClick={() => {
                  const next = new Set(open);
                  if (next.has(group)) next.delete(group);
                  else next.add(group);
                  setOpen(next);
                }}
              >
                <span class="caret">{isOpen ? "▾" : "▸"}</span>
                <strong>{group}</strong>
                <span class="muted">{list.length}</span>
                {type === "color" && (
                  <span class="swatch-strip">
                    {list.slice(0, 24).map((t) => (
                      <TokenSwatch
                        key={t.cssVar}
                        value={t.values[system.defaultTheme] ?? t.value}
                      />
                    ))}
                  </span>
                )}
              </button>
              {isOpen && (
                <table class="token-table">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      {system.themes.map((th) => (
                        <th key={th.id}>{th.label}</th>
                      ))}
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t) => (
                      <tr key={t.cssVar}>
                        <td>
                          <button
                            type="button"
                            class="token-var"
                            title="Copy var()"
                            onClick={() => void copy(`var(${t.cssVar})`)}
                          >
                            {copied === `var(${t.cssVar})` ? "Copied" : t.cssVar}
                          </button>
                          <div class="muted small">
                            {t.name} · {t.type}
                          </div>
                        </td>
                        {system.themes.map((th) => {
                          const v = t.values[th.id] ?? t.value;
                          return (
                            <td key={th.id} class="token-value">
                              {t.type === "color" && <TokenSwatch value={v} />}
                              <code>{v ?? "—"}</code>
                            </td>
                          );
                        })}
                        <td class="small">{t.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SetupTab({ data }: { data: SystemDetails }) {
  const { system } = data;
  return (
    <div class="setup">
      <h2>Use it in a prototype</h2>
      <Code code={data.include} lang="html" />
      {system.rootContext && (
        <Code
          lang="html"
          code={`<${system.rootContext} theme="${system.defaultTheme}">\n  …\n</${system.rootContext}>`}
        />
      )}
      <p class="muted">
        Agents: install the generated skill <code>{data.skill}</code> with{" "}
        <code>dt skills.install</code>, or use the MCP tools <code>system_get</code>,{" "}
        <code>component_search</code>, <code>component_get</code> and <code>token_search</code>.
      </p>
      <h2>Themes</h2>
      <ul>
        {system.themes.map((t) => (
          <li key={t.id}>
            <code>{t.id}</code> — {t.label} ({t.kind})
            {t.classes ? <span class="muted"> · classes: {t.classes}</span> : null}
          </li>
        ))}
      </ul>
      {system.notes && (
        <>
          <h2>Notes</h2>
          <pre class="notes">{system.notes}</pre>
        </>
      )}
      {system.attribution.length > 0 && (
        <>
          <h2>Attribution</h2>
          <ul>
            {system.attribution.map((a) => (
              <li key={a.name}>
                {a.name} — {a.license}
                {a.note ? <span class="muted"> · {a.note}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {(data.lastBuild?.result?.warnings.length ?? 0) > 0 && (
        <>
          <h2>Build warnings</h2>
          <ul>
            {data.lastBuild!.result!.warnings.map((w) => (
              <li key={w} class="small">
                {w}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
