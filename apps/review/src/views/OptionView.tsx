import { useEffect, useState } from "preact/hooks";
import { Icon } from "../../../web/src/components/Icon.tsx";
import { ThemePicker } from "../../../web/src/components/ThemePicker.tsx";
import { themeOptions, withTheme, type ThemeReady } from "../../../web/src/prototype-theme.ts";
import { deviceById, isTypingTarget } from "../../../web/src/util.ts";
import { DevicePicker } from "../components/DevicePicker.tsx";
import { QuestionsPanel, QuestionsToggle } from "../components/Questions.tsx";
import { Stage } from "../components/Stage.tsx";
import { optionForKey, stepIndex } from "../layout.ts";
import { exportUrl, pageLabel, pageOf, pagesOf } from "../manifest.ts";
import { formatRoute, viewSettings } from "../route.ts";
import type { ViewProps } from "../types.ts";

export function OptionView({
  manifest,
  route,
  navigate,
  questionsOpen,
  onQuestionsOpen,
}: ViewProps) {
  const { items } = manifest;
  const index = items.findIndex((i) => i.key === route.key);
  const item = items[index];
  const settings = viewSettings(route);
  const deviceId = route.device ?? manifest.device;
  const device = deviceById(deviceId);
  const theme = route.theme ?? manifest.theme;
  const page = item ? pageOf(item, route.page) : "";
  const src = item ? exportUrl(page, document.baseURI) : "";
  // What the prototype's design system runtime reported, for the page it was reported from.
  const [reported, setReported] = useState<{ src: string; ready: ThemeReady } | null>(null);
  const ready = reported?.src === src ? reported.ready : null;
  const themes = ready ? themeOptions(ready.system, ready) : null;

  const go = (target: number) => {
    const next = items[target];
    if (next) navigate({ view: "option", key: next.key, ...settings });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || index < 0) return;
      const target = optionForKey(event.key, index, items.length);
      if (target < 0 || target === index) return;
      event.preventDefault();
      go(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!item) {
    return (
      <main class="status-page">
        <div class="status-card">
          <h1 id="page-heading" tabIndex={-1}>
            Option not found
          </h1>
          <p>This review has no option “{route.key}”.</p>
          <a class="button" href={formatRoute({ view: "overview", ...settings })}>
            Back to overview
          </a>
        </div>
      </main>
    );
  }

  const prev = stepIndex(index, -1, items.length);
  const next = stepIndex(index, 1, items.length);
  const pages = pagesOf(item);
  const themeValue = themes?.some((t) => t.id === theme) ? theme : (ready?.theme ?? undefined);

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
              {item.label}
            </h1>
            {item.note && <p class="bar-subtitle">{item.note}</p>}
          </div>
          <nav class="stepper" aria-label="Options">
            <button
              type="button"
              class="button ghost icon-only"
              disabled={prev < 0}
              aria-label="Previous option"
              title="Previous option (←)"
              onClick={() => go(prev)}
            >
              <Icon name="chevron-left" />
            </button>
            <span class="step-count" aria-live="polite">
              {index + 1} of {items.length}
            </span>
            <button
              type="button"
              class="button ghost icon-only"
              disabled={next < 0}
              aria-label="Next option"
              title="Next option (→)"
              onClick={() => go(next)}
            >
              <Icon name="chevron-right" />
            </button>
          </nav>
        </div>
        <div class="bar-tools">
          {pages.length > 1 && (
            <select
              class="select"
              aria-label="Page"
              value={page}
              onChange={(event) =>
                navigate({
                  view: "option",
                  key: item.key,
                  ...settings,
                  page:
                    event.currentTarget.value === item.entry
                      ? undefined
                      : event.currentTarget.value,
                })
              }
            >
              {pages.map((p) => (
                <option key={p} value={p}>
                  {pageLabel(item, p)}
                </option>
              ))}
            </select>
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
          <a
            class="button ghost icon-only"
            href={withTheme(src, theme)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in a new tab"
            title="Open in a new tab"
          >
            <Icon name="external" />
          </a>
          <QuestionsToggle
            questions={manifest.questions}
            open={questionsOpen}
            onOpen={onQuestionsOpen}
          />
        </div>
      </header>
      <div class="view-body">
        <main class="view-main" aria-labelledby="page-heading">
          <Stage
            src={src}
            title={item.label}
            device={device}
            theme={theme}
            onThemeReady={(r) => setReported({ src, ready: r })}
          />
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
