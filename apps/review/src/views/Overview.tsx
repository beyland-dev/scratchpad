import { Icon } from "../../../web/src/components/Icon.tsx";
import { withTheme } from "../../../web/src/prototype-theme.ts";
import { deviceById } from "../../../web/src/util.ts";
import { Attribution } from "../components/Questions.tsx";
import { Thumbnail } from "../components/Thumbnail.tsx";
import { canCompare, canSequence, exportUrl, formatDate, introParagraphs } from "../manifest.ts";
import { formatRoute, viewSettings } from "../route.ts";
import type { ViewProps } from "../types.ts";

export function Overview({ manifest, route }: ViewProps) {
  const settings = viewSettings(route);
  const device = deviceById(route.device ?? manifest.device);
  const theme = route.theme ?? manifest.theme;
  const first = manifest.items[0];
  const shared = formatDate(manifest.exportedAt);
  const count = manifest.items.length;

  return (
    <div class="overview-page">
      <main class="overview">
        <header class="overview-header">
          {manifest.project && <p class="eyebrow">{manifest.project}</p>}
          <div class="title-row">
            <h1 id="page-heading" tabIndex={-1}>
              {manifest.title}
            </h1>
            <span class="badge">Round {manifest.round}</span>
          </div>
          <p class="meta">
            {count} {count === 1 ? "option" : "options"}
            {shared && <> · Shared {shared}</>}
          </p>
        </header>

        {introParagraphs(manifest.intro).map((p, i) => (
          <p class="intro" key={i}>
            {p}
          </p>
        ))}

        {manifest.questions.length > 0 && (
          <section class="questions" aria-labelledby="questions-heading">
            <h2 id="questions-heading">What we'd like feedback on</h2>
            <ol class="question-list">
              {manifest.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </section>
        )}

        {(canSequence(manifest) || canCompare(manifest)) && (
          <div class="actions">
            {canSequence(manifest) && first && (
              <a
                class="button primary large"
                href={formatRoute({ view: "option", key: first.key, ...settings })}
              >
                Start reviewing
                <Icon name="chevron-right" />
              </a>
            )}
            {canCompare(manifest) && (
              <a
                class={`button large ${canSequence(manifest) ? "" : "primary"}`}
                href={formatRoute({ view: "compare", ...settings })}
              >
                <Icon name="columns" />
                Compare side by side
              </a>
            )}
          </div>
        )}

        <section class="options" aria-labelledby="options-heading">
          <h2 id="options-heading">Options</h2>
          <ul class="option-grid">
            {manifest.items.map((item, i) => (
              <li key={item.key} class="option-card">
                <a
                  class="option-link"
                  href={formatRoute({ view: "option", key: item.key, ...settings })}
                >
                  <Thumbnail
                    src={withTheme(exportUrl(item.entry, document.baseURI), theme)}
                    title={`Preview of ${item.label}`}
                    device={device}
                  />
                  <span class="option-meta">
                    <span class="option-index" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span class="option-text">
                      <span class="option-label">{item.label}</span>
                      {item.note && <span class="option-note">{item.note}</span>}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer class="page-footer">
        <Attribution />
      </footer>
    </div>
  );
}
