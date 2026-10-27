import { Fragment } from "preact";
import { Code } from "../components/Code.tsx";
import { useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { Icon } from "../components/Icon.tsx";
import { SearchInput } from "../components/SearchInput.tsx";
import { Specimen, VerificationBadge } from "../components/Specimen.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemEventOf, systemRevisionOf, systems, systemsListHref, workspace } from "../store.ts";
import { AgentHandoff } from "../components/AgentHandoff.tsx";
import { DeleteSystemDialog, SystemDialog } from "../components/Dialogs.tsx";
import { MenuButton } from "../components/Menu.tsx";
import { packageSetupPrompt, systemAuditPrompt } from "../prompts.ts";
import { ActivityTab, useCaptures } from "./discovery.tsx";
import { TokensTab } from "./TokensView.tsx";
import type { ComponentSummary, DesignSystem } from "../types.ts";

export interface SystemDetails {
  system: DesignSystem;
  components: ComponentSummary[];
  tokens: { total: number; groups: Record<string, number> };
  include: string;
  skill: string;
  urls: { css: string; js: string };
  lastBuild?: { ok: boolean; at: string; error?: string; result?: { warnings: string[] } };
}

type TabId = "components" | "tokens" | "usage" | "activity";

const DEFAULT_TAB: TabId = "components";

/** Earlier tab ids, kept so old links still land somewhere sensible. */
const TAB_ALIASES: Record<string, { tab: TabId; extra?: Record<string, string> }> = {
  overview: { tab: "activity" },
  captures: { tab: "activity", extra: { captures: "all" } },
  colors: { tab: "tokens", extra: { tokens: "color" } },
  setup: { tab: "usage" },
};

export function systemTabHref(system: string, tab: TabId, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ ...(tab === DEFAULT_TAB ? {} : { tab }), ...query });
  const qs = params.toString();
  return `/systems/${encodeURIComponent(system)}${qs ? `?${qs}` : ""}`;
}

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
  allOption = false,
}: {
  system: DesignSystem;
  theme: string;
  onChange: (t: string) => void;
  /** Adds an "All" option (value "all") that shows every theme side by side. */
  allOption?: boolean;
}) {
  const options = [
    ...(allOption ? [{ id: "all", label: "All themes" }] : []),
    ...system.themes.map((t) => ({ id: t.id, label: t.label })),
  ];
  return (
    <div class="segmented" role="group" aria-label="Theme">
      {options.map((t) => (
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
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [theme, setTheme] = useSystemTheme(data?.system);
  const alias = TAB_ALIASES[query.tab ?? ""];
  const tab: TabId = alias?.tab ?? (query.tab as TabId | undefined) ?? DEFAULT_TAB;
  const q = { ...query, ...alias?.extra };

  if (error) return <p class="page-message error">{error}</p>;
  if (!data) return <p class="page-message">Loading…</p>;
  const { system } = data;
  const summary = systems.value.find((s) => s.id === id);

  const setQuery = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(q);
    if (alias) p.set("tab", alias.tab);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (p.get("tab") === DEFAULT_TAB) p.delete("tab");
    const qs = p.toString();
    route(qs ? `${path}?${qs}` : path, true);
  };

  // Activity is last in the tab order, so flag problems that need a person's eye.
  const needsLook =
    data.components.some((c) => c.verification === "drift" || c.issues?.length) ||
    data.lastBuild?.ok === false;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "components", label: "Components", count: data.components.length },
    { id: "tokens", label: "Tokens" },
    { id: "usage", label: "Usage" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div class="page system-page">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href={systemsListHref(id)}>Design systems</a>
        </nav>
        <div class="page-title-row">
          <h1>{system.name}</h1>
          {system.library &&
            (system.library.docsUrl ? (
              <a
                class="chip library-chip"
                href={system.library.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${system.library.name} documentation`}
              >
                {system.library.name} <Icon name="external" size={12} />
              </a>
            ) : (
              <span class="chip library-chip">{system.library.name}</span>
            ))}
          {data.lastBuild && !data.lastBuild.ok && (
            <span class="chip warn" title={data.lastBuild.error}>
              <Icon name="alert" size={12} /> Build failed
            </span>
          )}
          <span class="toolbar-spacer" />
          {summary && (
            <MenuButton
              label={`${system.name} options`}
              items={[
                { label: "Edit details…", onSelect: () => setDialog("edit") },
                {
                  label: "Delete design system…",
                  danger: true,
                  onSelect: () => setDialog("delete"),
                },
              ]}
            />
          )}
        </div>
      </div>
      <div class="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            class={tab === t.id ? "active" : ""}
            onClick={() =>
              setQuery({ tab: t.id, tokens: undefined, token: undefined, captures: undefined })
            }
          >
            {t.label}
            {t.count !== undefined && <span class="tab-count">{t.count.toLocaleString()}</span>}
            {t.id === "activity" && needsLook && (
              <span class="tab-dot" title="Something needs attention" />
            )}
          </button>
        ))}
      </div>
      {dialog === "edit" && summary && (
        <SystemDialog system={summary} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && summary && (
        <DeleteSystemDialog system={summary} onClose={() => setDialog(null)} />
      )}
      {tab === "components" && (
        <ComponentsTab
          id={id}
          system={system}
          components={data.components}
          theme={theme}
          onTheme={setTheme}
        />
      )}
      {tab === "tokens" && (
        <TokensTab
          id={id}
          data={data}
          category={q.tokens}
          selected={q.token}
          onCategory={(c) => setQuery({ tokens: c, token: undefined })}
          onSelect={(t) => setQuery({ token: t })}
        />
      )}
      {tab === "usage" && <UsageTab data={data} />}
      {tab === "activity" && (
        <ActivityTab
          id={id}
          data={data}
          captures={captureData?.captures}
          theme={theme}
          allCaptures={q.captures === "all"}
          onAllCaptures={(all) => setQuery({ captures: all ? "all" : undefined })}
        />
      )}
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  context: "Contexts",
  component: "Components",
  pattern: "Patterns",
};

export function componentPageHref(system: string, name: string, theme: string): string {
  return `/systems/${encodeURIComponent(system)}/c/${encodeURIComponent(name)}?theme=${encodeURIComponent(theme)}`;
}

function ComponentsTab({
  id,
  system,
  components,
  theme,
  onTheme,
}: {
  id: string;
  system: DesignSystem;
  components: ComponentSummary[];
  theme: string;
  onTheme: (t: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = components.filter(
    (c) => !q || `${c.tag} ${c.title} ${c.category} ${c.summary}`.toLowerCase().includes(q),
  );
  if (!components.length) {
    const source = workspace.value?.sources.find((s) => s.id === system.sourceId);
    return (
      <AgentHandoff
        title={
          system.kind === "package"
            ? `Set up ${system.library?.name ?? "the library"}`
            : "Fill it from your product"
        }
        prompt={
          system.kind === "package"
            ? packageSetupPrompt(system, source, workspace.value?.designDir)
            : systemAuditPrompt(system, source, workspace.value?.designDir)
        }
      >
        {system.kind === "package" ? (
          <>
            This design system is empty. Give this prompt to an agent connected over MCP: it
            installs {system.library?.name ?? "the library"}, applies your product's customizations,
            and writes a story for each component. Progress shows up live under Activity.
          </>
        ) : (
          <>
            This design system is empty. Give this prompt to an agent connected over MCP: it imports
            the product's tokens, captures reference UI, and codifies verified{" "}
            <code>&lt;{system.prefix}-…&gt;</code> components. Progress shows up live under
            Activity.
          </>
        )}
      </AgentHandoff>
    );
  }
  return (
    <div>
      <div class="toolbar">
        <SearchInput value={search} onInput={setSearch} placeholder="Search components" />
        {q && (
          <span class="result-count" role="status">
            {visible.length} of {components.length}
          </span>
        )}
        <span class="toolbar-spacer" />
        {system.themes.length > 1 && (
          <ThemePicker system={system} theme={theme} onChange={onTheme} />
        )}
      </div>
      {visible.length === 0 && <p class="page-message">No components match “{search}”.</p>}
      {(["pattern", "component", "context"] as const).map((kind) => {
        const items = visible.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} class="component-section">
            <h2 class="section-heading">
              {KIND_LABELS[kind]} <span class="count">{items.length}</span>
            </h2>
            <div class="grid component-grid">
              {items.map((c) => {
                const href = componentPageHref(id, c.name, theme);
                return (
                  <article class="component-card" key={c.name}>
                    <a class="component-preview" href={href} tabIndex={-1} aria-hidden="true">
                      {kind !== "context" ? (
                        <Specimen
                          system={id}
                          component={c.name}
                          theme={theme}
                          fill
                          interactive={false}
                          title={`${c.title} preview`}
                        />
                      ) : (
                        <code class="context-placeholder">
                          &lt;{c.tag}&gt; … &lt;/{c.tag}&gt;
                        </code>
                      )}
                    </a>
                    <div class="component-card-body">
                      <div class="card-title-row">
                        <a class="card-title" href={href}>
                          {c.title}
                        </a>
                        {system.kind !== "package" && c.verification !== "verified" && (
                          <VerificationBadge status={c.verification} />
                        )}
                        {c.issues?.length ? (
                          <span class="warn-count" title={c.issues.join("\n")}>
                            <Icon name="alert" size={12} />
                            {c.issues.length}
                          </span>
                        ) : null}
                      </div>
                      <code class="tag">&lt;{c.tag}&gt;</code>
                      <p class="summary">{c.summary}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UsageTab({ data }: { data: SystemDetails }) {
  const { system } = data;
  const warnings = data.lastBuild?.result?.warnings ?? [];
  const from = system.capturedFrom;
  const isPackage = system.kind === "package";
  const snippet = isPackage
    ? `// A React prototype built with ${system.name}:\n// prototype_create { title, framework: "react", system: "${system.id}" }\n\n// main.tsx\nimport { createRoot } from "react-dom/client";\nimport "@/${(system.styles ?? "src/index.css").replace(/^src\//, "")}";\nimport { Button } from "@/components/ui/button";\n\ncreateRoot(document.getElementById("root")!).render(<Button>Hello</Button>);`
    : system.rootContext
      ? `${data.include}\n\n<${system.rootContext} theme="${system.defaultTheme}">\n  …\n</${system.rootContext}>`
      : data.include;
  return (
    <div class="usage">
      <section>
        <h2 class="section-heading">Add it to a prototype</h2>
        {isPackage && (
          <p>
            Prototypes that use {system.name} are React prototypes: an <code>index.html</code> shell
            loading <code>main.tsx</code>, built with this system's Vite and its shared{" "}
            <code>node_modules</code>.
          </p>
        )}
        <Code code={snippet} lang={isPackage ? "tsx" : "html"} />
        {system.themes.length > 1 && (
          <p class="muted small">
            Themes:{" "}
            {system.themes.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                <code>{t.id}</code>
              </span>
            ))}
          </p>
        )}
      </section>
      <section>
        <h2 class="section-heading">For agents</h2>
        <p>
          Install the generated skill <code>{data.skill}</code> with <code>dt skills install</code>,
          or use the MCP tools <code>system_get</code>, <code>component_search</code>,{" "}
          <code>component_get</code> and <code>token_search</code>.
        </p>
      </section>
      {warnings.length > 0 && (
        <section>
          <h2 class="section-heading">
            Build warnings <span class="count">{warnings.length}</span>
          </h2>
          <ul class="warning-list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 class="section-heading">About</h2>
        <dl class="meta wide">
          {system.library && (
            <>
              <dt>Library</dt>
              <dd>
                {system.library.docsUrl ? (
                  <a href={system.library.docsUrl} target="_blank" rel="noopener noreferrer">
                    {system.library.name}
                  </a>
                ) : (
                  system.library.name
                )}
                {system.library.package && (
                  <span class="muted">
                    {" · "}
                    <code>{system.library.package}</code>
                  </span>
                )}
              </dd>
              <dt>Folder</dt>
              <dd>
                <code class="small">{`${workspace.value?.designDir ?? ".design"}/systems/${system.id}`}</code>
              </dd>
            </>
          )}
          {from?.product && (
            <>
              <dt>Captured from</dt>
              <dd>
                {from.product}
                {from.version ? ` ${from.version}` : ""}
                {from.commit && <code class="small"> {from.commit.slice(0, 8)}</code>}
              </dd>
            </>
          )}
          {system.attribution.map((a, i) => (
            <Fragment key={a.name}>
              <dt>{i === 0 ? "Attribution" : ""}</dt>
              <dd>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.name}
                  </a>
                ) : (
                  a.name
                )}{" "}
                <span class="muted">· {a.license}</span>
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>
      {system.notes && (
        <details class="notes">
          <summary>Capture notes</summary>
          <pre>{system.notes}</pre>
        </details>
      )}
    </div>
  );
}
