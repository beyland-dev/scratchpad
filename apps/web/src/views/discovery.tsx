import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../components/Icon.tsx";
import { SearchInput } from "../components/SearchInput.tsx";
import { VerificationBadge } from "../components/Specimen.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemEventOf, workspace } from "../store.ts";
import type { ActivityEntry, CaptureSummary, ComponentSummary, DesignSystem } from "../types.ts";
import { relativeTime } from "../util.ts";
import type { SystemDetails } from "./SystemView.tsx";

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

// ---- Stats -------------------------------------------------------------------

/** One compact strip summarizing the audit: what's been codified and how much of it is verified. */
function AuditStats({
  data,
  captures,
}: {
  data: SystemDetails;
  captures: CaptureSummary[] | undefined;
}) {
  const { components, tokens, system } = data;
  if (system.kind === "package") {
    const withStories = components.filter((c) => c.story).length;
    const ratio = components.length ? withStories / components.length : 0;
    return (
      <div class="stats">
        <div class="stat">
          <strong>{tokens.total.toLocaleString()}</strong>
          <span>Tokens</span>
        </div>
        <div class="stat">
          <strong>{components.length}</strong>
          <span>Components</span>
        </div>
        <div class={`stat stat-progress ${ratio === 1 ? "ok" : ""}`}>
          <strong>
            {withStories}
            <span class="muted">/{components.length}</span>
          </strong>
          <span>With stories</span>
          <span class="stat-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        </div>
      </div>
    );
  }
  const verified = components.filter((c) => c.verification === "verified").length;
  const drift = components.filter((c) => c.verification === "drift").length;
  const elements = captures ? groupCaptures(captures, system).length : undefined;
  const progress = components.length ? verified / components.length : 0;
  const stats = [
    { label: "Tokens", value: tokens.total.toLocaleString() },
    { label: "Captured elements", value: elements === undefined ? "…" : String(elements) },
    { label: "Components", value: String(components.length) },
  ];
  return (
    <div class="stats">
      {stats.map((s) => (
        <div class="stat" key={s.label}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
      <div class={`stat stat-progress ${drift ? "warn" : progress === 1 ? "ok" : ""}`}>
        <strong>
          {verified}
          <span class="muted">/{components.length}</span>
        </strong>
        <span>Verified{drift ? ` · ${drift} drifting` : ""}</span>
        <span class="stat-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </div>
    </div>
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
        Captures, token imports, component edits, verifications and builds appear here as an agent
        audits the product.
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
            <span class="activity-dot" title={KIND_LABEL[e.kind]} aria-hidden="true" />
            <div class="activity-main">
              <div class="activity-row">
                {href ? (
                  <a class="activity-title" href={href}>
                    {e.title}
                  </a>
                ) : (
                  <span class="activity-title">{e.title}</span>
                )}
                <time class="activity-time" dateTime={e.at} title={new Date(e.at).toLocaleString()}>
                  {relativeTime(e.at)}
                </time>
              </div>
              {e.detail && (
                <button
                  type="button"
                  class={`activity-detail ${expanded ? "open" : ""}`}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : key)}
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

// ---- Activity tab -------------------------------------------------------------------

/** Long text clamped to two lines; click to expand. */
function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      class={`expandable ${open ? "open" : ""}`}
      aria-expanded={open}
      title={open ? "Collapse" : "Show all"}
      onClick={() => setOpen(!open)}
    >
      {text}
    </button>
  );
}

export function ActivityTab({
  id,
  data,
  captures,
  theme,
  allCaptures,
  onAllCaptures,
}: {
  id: string;
  data: SystemDetails;
  captures: CaptureSummary[] | undefined;
  theme: string;
  /** Show every capture (searchable) instead of the latest few. */
  allCaptures: boolean;
  onAllCaptures: (all: boolean) => void;
}) {
  const { system, components } = data;
  const captureGroups = captures ? groupCaptures(captures, system) : [];
  const latest = captureGroups.slice(0, LATEST_CAPTURES);
  const drift = components.filter((c) => c.verification === "drift");
  const isPackage = system.kind === "package";
  // Package systems aren't verified against captures; what's missing there is a story to render.
  const unverified = isPackage
    ? components.filter((c) => !c.story)
    : components.filter((c) => c.verification === "unverified");
  const withIssues = components.filter((c) => c.issues?.length);
  const warnings = data.lastBuild?.result?.warnings ?? [];
  const attention = drift.length + unverified.length + withIssues.length + warnings.length;
  const link = (c: ComponentSummary) => (
    <a
      key={c.name}
      class="chip tag-chip"
      href={`${componentHref(id, c.name)}?theme=${encodeURIComponent(theme)}`}
      title={c.title}
    >
      &lt;{c.tag}&gt;
    </a>
  );

  return (
    <div class="discovery">
      <div class="discovery-main">
        {system.description && <p class="lede">{system.description}</p>}
        <AuditStats data={data} captures={captures} />

        <section>
          <h2 class="section-heading">
            Needs attention {attention > 0 && <span class="count">{attention}</span>}
          </h2>
          {components.length === 0 ? (
            <p class="muted small">Nothing to check yet: no components have been codified.</p>
          ) : attention === 0 ? (
            <p class="all-clear">
              <Icon name="check" size={15} />{" "}
              {isPackage
                ? "Every component has a story."
                : "Every component is verified against the product."}
            </p>
          ) : (
            <div class="attention">
              {drift.length > 0 && (
                <div class="attention-row">
                  <div class="attention-label">
                    <VerificationBadge status="drift" />
                    <span class="muted small">Differs from the captured product</span>
                  </div>
                  <div class="tag-list">{drift.map(link)}</div>
                </div>
              )}
              {withIssues.length > 0 && (
                <div class="attention-row">
                  <div class="attention-label">
                    <span class="chip warn">
                      <Icon name="alert" size={12} /> Issues
                    </span>
                    <span class="muted small">Invalid or incomplete definitions</span>
                  </div>
                  <div class="tag-list">{withIssues.map(link)}</div>
                </div>
              )}
              {unverified.length > 0 && (
                <div class="attention-row">
                  <div class="attention-label">
                    {isPackage ? (
                      <span class="badge">No story</span>
                    ) : (
                      <VerificationBadge status="unverified" />
                    )}
                    <span class="muted small">
                      {isPackage
                        ? "Nothing renders it in the app yet"
                        : "No reference capture compared yet"}
                    </span>
                  </div>
                  <div class="tag-list">{unverified.map(link)}</div>
                </div>
              )}
              {warnings.length > 0 && (
                <div class="attention-row">
                  <div class="attention-label">
                    <span class="chip warn">
                      <Icon name="alert" size={12} /> Build
                    </span>
                    <span class="muted small">
                      {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`} in the
                      last build
                    </span>
                  </div>
                  <ul class="warning-list">
                    {warnings.map((w) => (
                      <li key={w}>
                        <Expandable text={w} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {!isPackage && (
          <section id="captures">
            <div class="section-heading">
              <h2>{allCaptures ? "Captures" : "Latest captures"}</h2>
              {allCaptures && <span class="count">{captureGroups.length}</span>}
              <span class="toolbar-spacer" />
              {captureGroups.length > LATEST_CAPTURES && (
                <button
                  type="button"
                  class="link-button"
                  aria-expanded={allCaptures}
                  aria-controls="captures"
                  onClick={() => onAllCaptures(!allCaptures)}
                >
                  {allCaptures ? "Show latest" : `View all ${captureGroups.length}`}
                </button>
              )}
            </div>
            {!captures ? (
              <p class="muted small">Loading captures…</p>
            ) : !captureGroups.length ? (
              <p class="muted small">
                No captures yet. <code>capture.element</code> stores a reference element's DOM,
                matched CSS rules, geometry and screenshot.
              </p>
            ) : allCaptures ? (
              <CaptureBrowser id={id} system={system} groups={captureGroups} />
            ) : (
              <div class="capture-strip">
                {latest.map((g) => (
                  <a class="capture-mini" key={g.base} href={captureHref(id, g.captures[0]!.label)}>
                    <CaptureThumb system={id} capture={g.captures[0]!} maxHeight={110} />
                    <span class="capture-mini-label">{g.base}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <aside class="discovery-side" aria-label="Activity">
        <h2 class="section-heading">
          Activity <span class="activity-live" title="Updates live" />
        </h2>
        <ActivityFeed system={id} />
      </aside>
    </div>
  );
}

// ---- Capture browser ---------------------------------------------------------------

const LATEST_CAPTURES = 6;

/** Every captured element (theme variants grouped), searchable. */
function CaptureBrowser({
  id,
  system,
  groups: all,
}: {
  id: string;
  system: DesignSystem;
  groups: CaptureGroup[];
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const groups = all.filter(
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
        <SearchInput
          value={search}
          onInput={setSearch}
          placeholder="Search label, selector or component"
        />
        {q && (
          <span class="result-count" role="status">
            {groups.length} of {all.length}
          </span>
        )}
      </div>
      <div class="capture-grid">
        {groups.map((g) => {
          const first = g.captures[0]!;
          const usedBy = [
            ...new Map(g.captures.flatMap((c) => c.usedBy).map((u) => [u.name, u])).values(),
          ];
          return (
            <article class="capture-card" key={g.base}>
              <div class={`capture-pair n${g.captures.length}`}>
                {g.captures.map((c) => (
                  <a
                    key={c.label}
                    href={captureHref(id, c.label)}
                    title={`${g.base} · ${themeLabel(c.theme)}`}
                    tabIndex={-1}
                  >
                    <CaptureThumb system={id} capture={c} />
                  </a>
                ))}
              </div>
              <div class="capture-card-body">
                <a class="card-title" href={captureHref(id, first.label)} title={first.selector}>
                  {g.base}
                </a>
                <div class="tag-list">
                  {usedBy.length ? (
                    usedBy.map((u) => (
                      <a
                        class="chip tag-chip"
                        key={u.name}
                        href={componentHref(id, u.name)}
                        title={`Used as ${u.as.join(" + ")}`}
                      >
                        &lt;{u.tag}&gt;
                      </a>
                    ))
                  ) : (
                    <span class="muted small">Not used by a component</span>
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
