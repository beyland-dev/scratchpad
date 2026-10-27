import { Fragment } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CopyCode } from "../components/Copyable.tsx";
import { Icon } from "../components/Icon.tsx";
import { SearchInput } from "../components/SearchInput.tsx";
import { useCommand } from "../hooks/useCommand.ts";
import { systemRevisionOf } from "../store.ts";
import type { DesignSystem, Token } from "../types.ts";
import { isTypingTarget } from "../util.ts";
import type { SystemDetails } from "./SystemView.tsx";

export type TokenCategory = "color" | "type" | "size" | "shadow" | "icon" | "other";

const CATEGORIES: { id: TokenCategory; label: string }[] = [
  { id: "color", label: "Colors" },
  { id: "type", label: "Typography" },
  { id: "size", label: "Spacing & radius" },
  { id: "shadow", label: "Shadows" },
  { id: "icon", label: "Icons" },
  { id: "other", label: "Other" },
];

const TYPE_TOKENS = new Set([
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
]);

/** One browsable item: a token, or an icon made of a glyph token plus its font-family token. */
interface Entry {
  key: string;
  label: string;
  name: string;
  group: string;
  category: TokenCategory;
  token: Token;
  fontToken?: Token;
  glyph?: string;
  haystack: string;
}

export function TokenSwatch({ value }: { value: string | undefined }) {
  if (!value) return <span class="swatch swatch-unset" title="not set" />;
  return <span class="swatch" title={value} style={{ "--swatch": value }} />;
}

function categoryOf(token: Token): TokenCategory {
  if (token.type === "color") return "color";
  if (TYPE_TOKENS.has(token.type)) return "type";
  if (token.type === "dimension") return "size";
  if (token.type === "shadow") return "shadow";
  return "other";
}

function unquote(value: string | undefined): string {
  return (value ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
}

/** CSS `content` value such as `'\eb99'` → the character it encodes. */
function glyphOf(value: string | undefined): string {
  return unquote(value).replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
}

function shortName(name: string, group: string): string {
  return name.startsWith(`${group}.`) ? name.slice(group.length + 1) : name;
}

function buildEntries(tokens: Token[]): Entry[] {
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const folded = new Set<string>();
  const used = new Set<Token>();
  const entries: Entry[] = [];
  for (const t of tokens) {
    if (t.name.endsWith(".content")) {
      const base = t.name.slice(0, -".content".length);
      const fontToken = byName.get(`${base}.fontFamily`);
      if (fontToken) {
        folded.add(fontToken.name);
        used.add(t);
        const label = shortName(base, t.group ?? "");
        entries.push({
          key: t.cssVar,
          label,
          name: base,
          group: /^[a-z]/i.test(label) ? label[0]!.toUpperCase() : "#",
          category: "icon",
          token: t,
          fontToken,
          glyph: glyphOf(Object.values(t.values)[0] ?? t.value),
          haystack: `${label} ${base} ${t.cssVar} ${t.description ?? ""}`.toLowerCase(),
        });
        continue;
      }
    }
  }
  for (const t of tokens) {
    if (folded.has(t.name) || used.has(t)) continue;
    const group = t.group ?? "other";
    entries.push({
      key: t.cssVar,
      label: shortName(t.name, group),
      name: t.name,
      group,
      category: categoryOf(t),
      token: t,
      haystack:
        `${t.name} ${t.cssVar} ${t.description ?? ""} ${Object.values(t.values).join(" ")} ${t.value ?? ""}`.toLowerCase(),
    });
  }
  return entries;
}

function valueIn(token: Token, theme: string): string | undefined {
  return token.values[theme] ?? token.value;
}

/** Register a system's @font-face rules in the app under namespaced families (e.g. for icon glyphs). */
const loadedFonts = new Map<string, Promise<void>>();

function useSystemFonts(system: string, cssUrl: string, enabled: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let promise = loadedFonts.get(cssUrl);
    if (!promise) {
      promise = fetch(cssUrl)
        .then((r) => (r.ok ? r.text() : ""))
        .then(async (css) => {
          const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
          await Promise.all(
            faces.map(async (face) => {
              const family = unquote(/font-family:\s*([^;]+);/.exec(face)?.[1]);
              const src = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(face)?.[1];
              if (!family || !src) return;
              const font = new FontFace(
                fontFamilyFor(system, family),
                `url(${new URL(src, cssUrl).href})`,
              );
              document.fonts.add(await font.load());
            }),
          );
        })
        .catch((error: unknown) =>
          console.warn("[design-tool] loading system fonts failed", error),
        );
      loadedFonts.set(cssUrl, promise);
    }
    void promise.then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [cssUrl, enabled, system]);
  return ready;
}

function fontFamilyFor(system: string, family: string): string {
  return `dt-${system}-${family}`;
}

/** Track which section is at the top of the scroll area, for the index highlight. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();
  const key = ids.join("|");
  useEffect(() => {
    const root = document.querySelector(".app-main");
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const id = (r.target as HTMLElement).dataset.group!;
          if (r.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setActive(ids.find((id) => visible.has(id)));
      },
      { root, rootMargin: "0px 0px -60% 0px" },
    );
    for (const el of document.querySelectorAll<HTMLElement>(".token-section[data-group]"))
      observer.observe(el);
    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

export function TokensTab({
  id,
  data,
  category: categoryParam,
  selected,
  onCategory,
  onSelect,
}: {
  id: string;
  data: SystemDetails;
  category: string | undefined;
  selected: string | undefined;
  onCategory: (category: TokenCategory) => void;
  onSelect: (key: string | undefined) => void;
}) {
  const { system } = data;
  const revision = systemRevisionOf(id);
  const { data: result, error } = useCommand<{ tokens: Token[]; total: number }>(
    "token.search",
    { system: id, limit: 10000 },
    [revision],
  );
  const [search, setSearch] = useState("");
  const entries = useMemo(() => buildEntries(result?.tokens ?? []), [result]);
  const q = search.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? entries.filter((e) => e.haystack.includes(q)) : entries),
    [entries, q],
  );
  const counts = useMemo(() => {
    const map = new Map<TokenCategory, number>();
    for (const e of matches) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [matches]);
  const available = CATEGORIES.filter((c) => entries.some((e) => e.category === c.id));
  const category: TokenCategory =
    available.find((c) => c.id === categoryParam)?.id ?? available[0]?.id ?? "color";
  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of matches) {
      if (e.category !== category) continue;
      map.set(e.group, [...(map.get(e.group) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches, category]);
  const groupIds = groups.map(([g]) => g);
  const activeGroup = useActiveSection(groupIds);
  const fontsReady = useSystemFonts(id, data.urls.css, category === "icon");
  const current = selected ? entries.find((e) => e.key === selected) : undefined;
  const iconComponent = data.components.find((c) => c.tag === `${system.prefix}-icon`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selected && !isTypingTarget(event.target)) onSelect(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  if (error) return <p class="page-message error">{error}</p>;
  if (!result) return <p class="page-message">Loading tokens…</p>;
  if (!entries.length) return <p class="page-message">No tokens yet.</p>;

  const ctx: TileContext = { system, systemId: id, fontsReady };

  return (
    <div class="tokens-view">
      <div class="toolbar">
        <SearchInput value={search} onInput={setSearch} placeholder="Search tokens" />
        <div class="segmented" role="group" aria-label="Token category">
          {available.map((c) => (
            <button
              type="button"
              key={c.id}
              class={category === c.id ? "active" : ""}
              aria-pressed={category === c.id}
              onClick={() => onCategory(c.id)}
            >
              {c.label}
              <span class="count">{(counts.get(c.id) ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <span class="toolbar-spacer" />
        {category === "color" && system.themes.length > 1 && (
          <span class="theme-legend" title="Each swatch shows every theme, left to right">
            <span class="theme-legend-chip" aria-hidden="true">
              {system.themes.map((t) => (
                <span key={t.id} class={`legend-${t.kind}`} />
              ))}
            </span>
            {system.themes.map((t) => t.label).join(" · ")}
          </span>
        )}
      </div>

      <div class={`tokens-layout ${current ? "with-inspector" : ""}`}>
        {groups.length > 1 && (
          <nav class="token-index" aria-label="Groups">
            {groups.map(([group, list]) => (
              <a
                key={group}
                href={`#group-${group}`}
                class={activeGroup === group ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(`group-${group}`)
                    ?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
              >
                <span>{group}</span>
                <span class="count">{list.length}</span>
              </a>
            ))}
          </nav>
        )}

        <div class="token-main">
          {groups.length === 0 && (
            <p class="page-message">
              No {CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()} match “{search}”.
            </p>
          )}
          {groups.map(([group, list]) => (
            <section class="token-section" key={group} id={`group-${group}`} data-group={group}>
              <h3 class="token-section-title">
                {group} <span class="count">{list.length}</span>
              </h3>
              <div class={`token-tiles tiles-${category}`}>
                {list.map((e) => (
                  <TokenTile
                    key={e.key}
                    entry={e}
                    ctx={ctx}
                    selected={e.key === selected}
                    onSelect={() => onSelect(e.key === selected ? undefined : e.key)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {current && (
          <TokenInspector
            entry={current}
            ctx={ctx}
            iconTag={iconComponent?.tag}
            onClose={() => onSelect(undefined)}
          />
        )}
      </div>
    </div>
  );
}

interface TileContext {
  system: DesignSystem;
  systemId: string;
  fontsReady: boolean;
}

function glyphStyle(entry: Entry, ctx: TileContext) {
  const family = unquote(entry.fontToken && valueIn(entry.fontToken, ctx.system.defaultTheme));
  return { fontFamily: family ? `"${fontFamilyFor(ctx.systemId, family)}"` : undefined };
}

/** A visual preview of a token's value, sized for a tile or the inspector. */
function TokenPreview({
  entry,
  ctx,
  theme,
  large,
}: {
  entry: Entry;
  ctx: TileContext;
  theme: string;
  large?: boolean;
}) {
  const value = valueIn(entry.token, theme);
  switch (entry.category) {
    case "color":
      return (
        <span class="color-chip">
          {ctx.system.themes.map((t) => (
            <span
              key={t.id}
              title={`${t.label}: ${valueIn(entry.token, t.id) ?? "not set"}`}
              style={{ "--swatch": valueIn(entry.token, t.id) ?? "transparent" }}
            />
          ))}
        </span>
      );
    case "icon":
      return (
        <span class={`glyph ${ctx.fontsReady ? "" : "loading"}`} style={glyphStyle(entry, ctx)}>
          {entry.glyph}
        </span>
      );
    case "type": {
      const style =
        entry.token.type === "fontSize"
          ? { fontSize: value }
          : entry.token.type === "fontWeight"
            ? { fontWeight: value }
            : entry.token.type === "fontFamily"
              ? { fontFamily: value }
              : {};
      return (
        <span class="type-sample" style={style}>
          {large ? "The quick brown fox" : "Aa"}
        </span>
      );
    }
    case "size":
      return /radius/i.test(entry.name) ? (
        <span class="radius-sample" style={{ borderRadius: value }} />
      ) : (
        <span class="size-bar">
          <span style={{ width: value }} />
        </span>
      );
    case "shadow":
      return <span class="shadow-sample" style={{ boxShadow: value }} />;
    default:
      return null;
  }
}

function TokenTile({
  entry,
  ctx,
  selected,
  onSelect,
}: {
  entry: Entry;
  ctx: TileContext;
  selected: boolean;
  onSelect: () => void;
}) {
  const value = valueIn(entry.token, ctx.system.defaultTheme);
  return (
    <button
      type="button"
      class={`token-tile ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      title={entry.token.description ?? entry.name}
      onClick={onSelect}
    >
      {entry.category !== "other" && (
        <span class="token-preview">
          <TokenPreview entry={entry} ctx={ctx} theme={ctx.system.defaultTheme} />
        </span>
      )}
      <span class="token-text">
        <span class="token-label">{entry.label}</span>
        {entry.category !== "icon" && <span class="token-value">{value ?? "—"}</span>}
      </span>
    </button>
  );
}

function TokenInspector({
  entry,
  ctx,
  iconTag,
  onClose,
}: {
  entry: Entry;
  ctx: TileContext;
  iconTag: string | undefined;
  onClose: () => void;
}) {
  const { system } = ctx;
  const ref = useRef<HTMLElement>(null);
  const t = entry.token;
  const codepoint = entry.glyph?.codePointAt(0);
  const themesDiffer = new Set(system.themes.map((th) => valueIn(t, th.id) ?? "")).size > 1;

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [entry.key]);

  return (
    <aside class="token-inspector" ref={ref} aria-label={`${entry.label} details`}>
      <header class="inspector-head">
        <div>
          <h3>{entry.label}</h3>
          <div class="muted small">{CATEGORIES.find((c) => c.id === entry.category)?.label}</div>
        </div>
        <button type="button" class="icon-button" aria-label="Close details" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>

      <div class={`inspector-preview preview-${entry.category}`}>
        {entry.category === "color" ? (
          system.themes.map((th) => (
            <div class="inspector-swatch" key={th.id}>
              <span style={{ "--swatch": valueIn(t, th.id) ?? "transparent" }} />
              <span class="small muted">{th.label}</span>
            </div>
          ))
        ) : entry.category === "other" ? null : (
          <TokenPreview entry={entry} ctx={ctx} theme={system.defaultTheme} large />
        )}
      </div>

      {t.description && <p class="inspector-description">{t.description}</p>}

      <dl class="inspector-fields">
        <dt>Variable</dt>
        <dd>
          <CopyCode text={`var(${t.cssVar})`} display={t.cssVar} />
        </dd>
        {entry.category === "icon" && iconTag && (
          <>
            <dt>Element</dt>
            <dd>
              <CopyCode text={`<${iconTag} name="${entry.label}"></${iconTag}>`} />
            </dd>
          </>
        )}
        {entry.category === "icon" && codepoint !== undefined && (
          <>
            <dt>Glyph</dt>
            <dd>
              <CopyCode
                text={`\\${codepoint.toString(16)}`}
                display={`U+${codepoint.toString(16).toUpperCase()}`}
              />
            </dd>
          </>
        )}
        {entry.category === "icon" && entry.fontToken && (
          <>
            <dt>Font</dt>
            <dd>
              <CopyCode text={`var(${entry.fontToken.cssVar})`} display={entry.fontToken.cssVar} />
            </dd>
          </>
        )}
        {entry.category !== "icon" &&
          (themesDiffer ? (
            system.themes.map((th) => (
              <Fragment key={th.id}>
                <dt>{th.label}</dt>
                <dd class="inspector-value">
                  {t.type === "color" && <TokenSwatch value={valueIn(t, th.id)} />}
                  <CopyCode text={valueIn(t, th.id) ?? ""} display={valueIn(t, th.id) ?? "—"} />
                </dd>
              </Fragment>
            ))
          ) : (
            <>
              <dt>{system.themes.length > 1 ? "All themes" : "Value"}</dt>
              <dd class="inspector-value">
                {t.type === "color" && <TokenSwatch value={valueIn(t, system.defaultTheme)} />}
                <CopyCode
                  text={valueIn(t, system.defaultTheme) ?? ""}
                  display={valueIn(t, system.defaultTheme) ?? "—"}
                />
              </dd>
            </>
          ))}
        <dt>Name</dt>
        <dd>
          <CopyCode text={entry.name} />
        </dd>
        {entry.category !== "icon" && (
          <>
            <dt>Group</dt>
            <dd>{entry.group}</dd>
          </>
        )}
        {t.source && (
          <>
            <dt>Source</dt>
            <dd>
              <CopyCode text={`${t.source.path}${t.source.line ? `:${t.source.line}` : ""}`} />
            </dd>
          </>
        )}
      </dl>
    </aside>
  );
}
