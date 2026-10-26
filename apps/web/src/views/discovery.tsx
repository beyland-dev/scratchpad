import { useEffect, useRef, useState } from "preact/hooks";
import { VerificationBadge } from "../components/Specimen.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemEventOf, workspace } from "../store.ts";
import type { ActivityEntry, CaptureSummary, ComponentSummary, DesignSystem } from "../types.ts";
import { relativeTime } from "../util.ts";

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  system: "System",
  tokens: "Tokens",
  capture: "Capture",
  component: "Component",
  verify: "Verify",
  build: "Build",
};

export function captureBase(system: string, label: string): string {
  const sandbox = workspace.value?.urls.sandbox ?? "";
  return `${sandbox}/s/${encodeURIComponent(system)}/~captures/${encodeURIComponent(label)}`;
}

export function captureHref(system: string, label: string): string {
  return `/systems/${encodeURIComponent(system)}/captures/${encodeURIComponent(label)}`;
}

export function componentHref(system: string, name: string): string {
  return `/systems/${encodeURIComponent(system)}/c/${encodeURIComponent(name)}`;
}

/** Re-render periodically so relative times stay fresh. */
function useTick(ms: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
}

export function useCaptures(system: string) {
  return useCommand<{ captures: CaptureSummary[] }>("capture.list", { system }, [
    systemEventOf(system),
  ]);
}

/** Captures of the same element in different themes, e.g. `chat-input-dark` + `chat-input-light`. */
export interface CaptureGroup {
  base: string;
  captures: CaptureSummary[];
}

export function groupCaptures(captures: CaptureSummary[], sys: DesignSystem): CaptureGroup[] {
  const themeOrder = sys.themes.map((t) => t.id);
  const groups = new Map<string, CaptureSummary[]>();
  for (const c of captures) {
    const base =
      c.theme && /-[a-z0-9]+$/.test(c.label) ? c.label.replace(/-[a-z0-9]+$/, "") : c.label;
    groups.set(base, [...(groups.get(base) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([base, list]) => ({
      base,
      captures: list.sort(
        (a, b) => themeOrder.indexOf(a.theme ?? "") - themeOrder.indexOf(b.theme ?? ""),
      ),
    }))
    .sort((a, b) => latest(b) - latest(a));
}

function latest(group: CaptureGroup): number {
  return Math.max(...group.captures.map((c) => Date.parse(c.capturedAt ?? "") || 0));
}

export function CaptureThumb({
  system,
  capture,
  maxHeight = 180,
}: {
  system: string;
  capture: CaptureSummary;
  maxHeight?: number;
}) {
  const stamp = encodeURIComponent(capture.capturedAt ?? "");
  return (
    <div class="capture-thumb" style={{ maxHeight: `${maxHeight}px` }}>
      <img
        src={`${captureBase(system, capture.label)}/screenshot.png?v=${stamp}`}
        alt={capture.label}
        loading="lazy"
        style={{ width: capture.width ? `${capture.width}px` : undefined }}
      />
    </div>
  );
}

// ---- Pipeline ---------------------------------------------------------------

export function DiscoveryPipeline({
  system,
  tokens,
  components,
  captures,
  warnings,
}: {
  system: DesignSystem;
  tokens: { total: number; groups: Record<string, number> };
  components: ComponentSummary[];
  captures: CaptureSummary[] | undefined;
  warnings: number;
}) {
  const withRefs = components.filter((c) => c.verification !== "unverified").length;
  const verified = components.filter((c) => c.verification === "verified").length;
  const drift = components.filter((c) => c.verification === "drift").length;
  const used = captures?.filter((c) => c.usedBy.length).length ?? 0;
  const groups = captures ? groupCaptures(captures, system).length : 0;
  const byKind = (k: string) => components.filter((c) => c.kind === k).length;
  const stages = [
    {
      label: "Tokens",
      value: tokens.total.toLocaleString(),
      sub: `${Object.keys(tokens.groups).length} groups · ${system.themes.length} themes`,
      progress: tokens.total ? 1 : 0,
    },
    {
      label: "Captures",
      value: captures ? String(captures.length) : "…",
      sub: `${groups} elements · ${used} used by components`,
      progress: captures?.length ? used / captures.length : 0,
    },
    {
      label: "Components",
      value: String(components.length),
      sub: `${byKind("context")} contexts · ${byKind("component")} widgets · ${byKind("pattern")} patterns`,
      progress: components.length ? 1 : 0,
    },
    {
      label: "Verified",
      value: `${verified}/${components.length}`,
      sub: drift
        ? `${drift} drifting · ${components.length - withRefs} unchecked`
        : `${components.length - withRefs} unchecked`,
      progress: components.length ? verified / components.length : 0,
      tone: drift ? "warn" : verified && verified === components.length ? "ok" : "",
    },
    {
      label: "Build",
      value: warnings ? `${warnings} ⚠` : "✓",
      sub: warnings ? "warnings in last build" : "dist/system.css · system.js",
      progress: components.length ? 1 : 0,
      tone: warnings ? "warn" : "ok",
    },
  ];
  return (
    <ol class="pipeline">
      {stages.map((s) => (
        <li class={`pipeline-stage ${s.tone ?? ""}`} key={s.label}>
          <span class="pipeline-label">{s.label}</span>
          <strong class="pipeline-value">{s.value}</strong>
          <span class="pipeline-sub">{s.sub}</span>
          <span class="pipeline-bar">
            <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---- Activity -----------------------------------------------------------------

export function ActivityFeed({ system, limit = 80 }: { system: string; limit?: number }) {
  useTick(20_000);
  const { data, error } = useCommand<{ entries: ActivityEntry[] }>(
    "system.activity",
    { id: system, limit },
    [systemEventOf(system)],
  );
  const seen = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const entries = data?.entries ?? [];
  const keyOf = (e: ActivityEntry) => `${e.at}|${e.title}`;
  const fresh = new Set<string>();
  if (data) {
    if (seen.current) for (const e of entries) if (!seen.current.has(keyOf(e))) fresh.add(keyOf(e));
  }
  useEffect(() => {
    if (!data) return;
    seen.current = new Set([...(seen.current ?? []), ...entries.map(keyOf)]);
  });

  if (error) return <p class="muted small">{error}</p>;
  if (!data) return <p class="muted small">Loading activity…</p>;
  if (!entries.length)
    return (
      <p class="muted small">
        No activity yet. Captures, token imports, component edits, verifications and builds show up
        here as an agent audits the codebase.
      </p>
    );
  return (
    <ol class="activity">
      {entries.map((e) => {
        const key = keyOf(e);
        const href =
          e.ref && e.kind === "capture"
            ? captureHref(system, e.ref)
            : e.ref && (e.kind === "component" || e.kind === "verify")
              ? componentHref(system, e.ref)
              : undefined;
        const expanded = open === key;
        return (
          <li
            key={key}
            class={`activity-item kind-${e.kind} ${e.status ? `status-${e.status}` : ""} ${fresh.has(key) ? "fresh" : ""}`}
          >
            <span class="activity-dot" aria-hidden="true" />
            <div class="activity-main">
              <div class="activity-row">
                <span class="activity-kind">{KIND_LABEL[e.kind]}</span>
                {href ? (
                  <a class="activity-title" href={href}>
                    {e.title}
                  </a>
                ) : (
                  <span class="activity-title">{e.title}</span>
                )}
                <span class="activity-time" title={e.at}>
                  {relativeTime(e.at)}
                </span>
              </div>
              {e.detail && (
                <button
                  type="button"
                  class={`activity-detail ${expanded ? "open" : ""}`}
                  onClick={() => setOpen(expanded ? null : key)}
                  title={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? e.detail : e.detail.split("\n")[0]}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---- Overview -------------------------------------------------------------------

export function DiscoveryOverview({
  id,
  system,
  components,
  captures,
  theme,
}: {
  id: string;
  system: DesignSystem;
  components: ComponentSummary[];
  captures: CaptureSummary[] | undefined;
  theme: string;
}) {
  const groups = captures ? groupCaptures(captures, system).slice(0, 8) : [];
  const ordered = [...components].sort(
    (a, b) => rank(a.verification) - rank(b.verification) || a.tag.localeCompare(b.tag),
  );
  return (
    <div class="discovery">
      <div class="discovery-main">
        <section>
          <h2 class="section-heading">
            Latest captures <span class="muted">{captures?.length ?? 0}</span>
          </h2>
          {groups.length ? (
            <div class="capture-strip">
              {groups.map((g) => (
                <a class="capture-mini" key={g.base} href={captureHref(id, g.captures[0]!.label)}>
                  <CaptureThumb system={id} capture={g.captures[0]!} maxHeight={110} />
                  <span class="capture-mini-label">{g.base}</span>
                  <span class="muted small">{relativeTime(g.captures[0]!.capturedAt ?? "")}</span>
                </a>
              ))}
            </div>
          ) : (
            <p class="muted small">
              No captures yet. <code>capture.element</code> stores a reference element's DOM,
              matched CSS rules, geometry and screenshot.
            </p>
          )}
        </section>
        <section>
          <h2 class="section-heading">
            Components <span class="muted">{components.length}</span>
          </h2>
          {components.length ? (
            <table class="status-table">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Kind</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <a href={`${componentHref(id, c.name)}?theme=${theme}`}>
                        <code class="tag">&lt;{c.tag}&gt;</code>
                      </a>{" "}
                      <span class="muted small">{c.title}</span>
                    </td>
                    <td class="muted small">{c.kind}</td>
                    <td>
                      <VerificationBadge status={c.verification} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p class="muted small">No components codified yet.</p>
          )}
        </section>
      </div>
      <aside class="discovery-side">
        <h2 class="section-heading">
          Activity <span class="activity-live" title="Updates live" />
        </h2>
        <ActivityFeed system={id} />
      </aside>
    </div>
  );
}

function rank(v: string): number {
  return v === "drift" ? 0 : v === "unverified" ? 1 : 2;
}

// ---- Captures tab ------------------------------------------------------------------

export function CapturesTab({
  id,
  system,
  captures,
}: {
  id: string;
  system: DesignSystem;
  captures: CaptureSummary[] | undefined;
}) {
  const [search, setSearch] = useState("");
  if (!captures) return <p class="page-message">Loading captures…</p>;
  if (!captures.length) return <p class="page-message">No captures yet.</p>;
  const q = search.trim().toLowerCase();
  const groups = groupCaptures(captures, system).filter(
    (g) =>
      !q ||
      g.captures.some((c) =>
        `${c.label} ${c.selector} ${c.context} ${c.usedBy.map((u) => u.tag).join(" ")}`
          .toLowerCase()
          .includes(q),
      ),
  );
  const themeLabel = (t?: string) => system.themes.find((x) => x.id === t)?.label ?? t ?? "";
  return (
    <div>
      <div class="toolbar">
        <input
          class="input"
          type="search"
          placeholder="Search label, selector or component"
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
          aria-label="Search captures"
        />
        <span class="toolbar-spacer" />
        <span class="muted">
          {groups.length} elements · {captures.length} captures
        </span>
      </div>
      <div class="capture-grid">
        {groups.map((g) => {
          const first = g.captures[0]!;
          const usedBy = [
            ...new Map(g.captures.flatMap((c) => c.usedBy).map((u) => [u.name, u])).values(),
          ];
          return (
            <article class="card capture-card" key={g.base}>
              <div class={`capture-pair n${g.captures.length}`}>
                {g.captures.map((c) => (
                  <a key={c.label} href={captureHref(id, c.label)} title={themeLabel(c.theme)}>
                    <CaptureThumb system={id} capture={c} />
                  </a>
                ))}
              </div>
              <div class="card-body">
                <div class="card-title-row">
                  <a class="card-title" href={captureHref(id, first.label)}>
                    {g.base}
                  </a>
                  <span class="muted small">{relativeTime(first.capturedAt ?? "")}</span>
                </div>
                <code class="selector" title={first.selector}>
                  {first.selector}
                </code>
                <div class="muted small">
                  {Math.round(first.width ?? 0)}×{Math.round(first.height ?? 0)} · {first.elements}{" "}
                  elements · {first.rules} rules
                  {g.captures.length > 1
                    ? ` · ${g.captures.map((c) => themeLabel(c.theme)).join(" / ")}`
                    : ""}
                </div>
                <div class="used-by">
                  {usedBy.length ? (
                    usedBy.map((u) => (
                      <a
                        class="chip"
                        key={u.name}
                        href={componentHref(id, u.name)}
                        title={u.as.join(" + ")}
                      >
                        &lt;{u.tag}&gt;
                      </a>
                    ))
                  ) : (
                    <span class="chip muted">not used yet</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
