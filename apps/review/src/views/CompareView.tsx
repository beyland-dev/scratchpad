import type { ReviewManifestItem } from "@beyland/scratchpad-core/review-manifest";
import { useState } from "preact/hooks";
import { Icon } from "../../../web/src/components/Icon.tsx";
import { ThemedFrame } from "../components/ThemedFrame.tsx";
import { ThemePicker } from "../../../web/src/components/ThemePicker.tsx";
import { themeOptions, type ThemeReady } from "../../../web/src/prototype-theme.ts";
import { deviceById, useElementSize, type Device } from "../../../web/src/util.ts";
import { DevicePicker } from "../components/DevicePicker.tsx";
import { QuestionsPanel, QuestionsToggle } from "../components/Questions.tsx";
import { Stage } from "../components/Stage.tsx";
import { useMediaQuery } from "../hooks.ts";
import { fitScale } from "../layout.ts";
import { canCompare, compareKeys, exportUrl, MAX_COMPARE } from "../manifest.ts";
import { formatRoute, viewSettings } from "../route.ts";
import type { ViewProps } from "../types.ts";

const GAP = 16;
const HEADER_HEIGHT = 44;

export function CompareView({
  manifest,
  route,
  navigate,
  questionsOpen,
  onQuestionsOpen,
}: ViewProps) {
  const narrow = useMediaQuery("(max-width: 759px)");
  const settings = viewSettings(route);
  const deviceId = route.device ?? manifest.device;
  const device = deviceById(deviceId);
  const theme = route.theme ?? manifest.theme;
  const keys = compareKeys(manifest, route.keys);
  const items = manifest.items.filter((i) => keys.includes(i.key));
  const srcOf = (item: ReviewManifestItem) => exportUrl(item.entry, document.baseURI);
  // What each frame's design system runtime reported, by item key.
  const [reported, setReported] = useState<Record<string, { src: string; ready: ThemeReady }>>({});
  const readyOf = (item: ReviewManifestItem) => {
    const r = reported[item.key];
    return r && r.src === srcOf(item) ? r.ready : null;
  };
  const onReady = (item: ReviewManifestItem) => (ready: ThemeReady) =>
    setReported((prev) => ({ ...prev, [item.key]: { src: srcOf(item), ready } }));
  // One control for every frame: the themes of the first themable option. Frames of other
  // systems ignore theme ids they don't know.
  const shown = narrow ? manifest.items : items;
  const themable = shown.map((i) => readyOf(i)).find((r) => r && themeOptions(r.system, r));
  const themes = themable ? themeOptions(themable.system, themable) : null;
  const themeValue = themes?.some((t) => t.id === theme) ? theme : themable?.theme;

  const setKeys = (next: string[]) =>
    navigate(
      {
        ...route,
        keys: manifest.items.filter((i) => next.includes(i.key)).map((i) => i.key),
      },
      { replace: true },
    );

  if (!canCompare(manifest)) {
    return (
      <main class="status-page">
        <div class="status-card">
          <h1 id="page-heading" tabIndex={-1}>
            Side-by-side comparison isn't available
          </h1>
          <p>This review shows its options one at a time.</p>
          <a class="button" href={formatRoute({ view: "overview", ...settings })}>
            Back to overview
          </a>
        </div>
      </main>
    );
  }

  return (
    <div class="view">
      <header class="bar">
        <div class="bar-main">
          <a
            href={formatRoute({ view: "overview", ...settings })}
            class="button ghost icon-only"
            aria-label="Back to overview"
            title="Back to overview"
          >
            <Icon name="arrow-left" />
          </a>
          <div class="bar-title">
            <h1 id="page-heading" tabIndex={-1}>
              Compare side by side
            </h1>
            <p class="bar-subtitle">{manifest.title}</p>
          </div>
        </div>
        <div class="bar-tools">
          {!narrow && manifest.items.length > 2 && (
            <div class="segmented" role="group" aria-label="Options to compare">
              {manifest.items.map((item) => {
                const on = keys.includes(item.key);
                const locked = on ? keys.length <= 2 : keys.length >= MAX_COMPARE;
                return (
                  <button
                    type="button"
                    key={item.key}
                    class={on ? "active" : ""}
                    aria-pressed={on}
                    aria-disabled={locked}
                    title={
                      locked
                        ? on
                          ? "Compare at least two options"
                          : `Compare up to ${MAX_COMPARE} options`
                        : undefined
                    }
                    onClick={() =>
                      !locked &&
                      setKeys(on ? keys.filter((k) => k !== item.key) : [...keys, item.key])
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
          {themes && (
            <ThemePicker
              themes={themes}
              theme={themeValue ?? ""}
              onChange={(t) =>
                navigate(
                  { ...route, theme: t === manifest.theme ? undefined : t },
                  { replace: true },
                )
              }
            />
          )}
          <DevicePicker
            device={deviceId}
            onChange={(d) =>
              navigate(
                { ...route, device: d === manifest.device ? undefined : d },
                { replace: true },
              )
            }
          />
          <QuestionsToggle
            questions={manifest.questions}
            open={questionsOpen}
            onOpen={onQuestionsOpen}
          />
        </div>
      </header>
      <div class="view-body">
        <main class="view-main" aria-labelledby="page-heading">
          {narrow ? (
            <CompareTabs
              items={manifest.items}
              device={device}
              theme={theme}
              srcOf={srcOf}
              onReady={onReady}
            />
          ) : (
            <CompareGrid
              items={items}
              device={device}
              theme={theme}
              srcOf={srcOf}
              onReady={onReady}
              hrefOf={(item) => formatRoute({ view: "option", key: item.key, ...settings })}
            />
          )}
        </main>
        <QuestionsPanel
          questions={manifest.questions}
          open={questionsOpen}
          onOpen={onQuestionsOpen}
        />
      </div>
    </div>
  );
}

interface ColumnsProps {
  items: ReviewManifestItem[];
  device: Device;
  theme: string | undefined;
  srcOf: (item: ReviewManifestItem) => string;
  onReady: (item: ReviewManifestItem) => (ready: ThemeReady) => void;
}

function CompareGrid({
  items,
  device,
  theme,
  srcOf,
  onReady,
  hrefOf,
}: ColumnsProps & { hrefOf: (item: ReviewManifestItem) => string }) {
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const cellWidth = (area.width - GAP * (items.length - 1)) / items.length;
  const scale = fitScale({ width: cellWidth, height: area.height - HEADER_HEIGHT }, device);
  return (
    <div
      class="compare-area"
      ref={areaRef}
      style={{ gap: `${GAP}px`, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <section class="compare-column" key={item.key} aria-labelledby={`compare-${item.key}`}>
          <header class="compare-header" style={{ height: `${HEADER_HEIGHT}px` }}>
            <a id={`compare-${item.key}`} class="compare-title" href={hrefOf(item)}>
              {item.label}
            </a>
            {item.note && <span class="compare-note">{item.note}</span>}
          </header>
          {scale > 0 && (
            <ThemedFrame
              src={srcOf(item)}
              theme={theme}
              onThemeReady={onReady(item)}
              title={item.label}
              width={device.width}
              height={device.height}
              scale={scale}
              class="framed"
            />
          )}
        </section>
      ))}
    </div>
  );
}

/** Small screens: one option at a time, switched with tabs. */
function CompareTabs({ items, device, theme, srcOf, onReady }: ColumnsProps) {
  const [selected, setSelected] = useState(items[0]?.key);
  const active = items.find((i) => i.key === selected) ?? items[0];
  if (!active) return null;
  const select = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    setSelected(item.key);
    document.getElementById(`tab-${item.key}`)?.focus();
  };
  return (
    <div class="compare-tabs">
      <div
        class="tabs"
        role="tablist"
        aria-label="Options"
        onKeyDown={(event) => {
          const index = items.indexOf(active);
          const target =
            event.key === "ArrowRight"
              ? index + 1
              : event.key === "ArrowLeft"
                ? index - 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : null;
          if (target === null) return;
          event.preventDefault();
          select(target);
        }}
      >
        {items.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.key}
            id={`tab-${item.key}`}
            class="tab"
            aria-selected={item === active}
            aria-controls="compare-tabpanel"
            tabIndex={item === active ? 0 : -1}
            onClick={() => setSelected(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        class="tabpanel"
        role="tabpanel"
        id="compare-tabpanel"
        aria-labelledby={`tab-${active.key}`}
      >
        {active.note && <p class="tab-note">{active.note}</p>}
        <Stage
          src={srcOf(active)}
          title={active.label}
          device={device}
          theme={theme}
          onThemeReady={onReady(active)}
        />
      </div>
    </div>
  );
}
