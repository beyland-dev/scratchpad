import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../../web/src/components/Icon.tsx";
import { Attribution } from "./components/Questions.tsx";
import { useHashRoute, useManifest } from "./hooks.ts";
import { documentTitle } from "./route.ts";
import type { ViewProps } from "./types.ts";
import { CompareView } from "./views/CompareView.tsx";
import { OptionView } from "./views/OptionView.tsx";
import { Overview } from "./views/Overview.tsx";

export function App() {
  const [state, retry] = useManifest();
  const [route, navigate] = useHashRoute();
  const [questionsOpen, setQuestionsOpen] = useState(
    () => matchMedia("(min-width: 1100px)").matches,
  );
  const manifest = state.status === "ready" ? state.manifest : null;

  useEffect(() => {
    document.title = manifest ? documentTitle(manifest, route) : "Review";
  }, [manifest, route]);

  // Moving between views: put focus (and screen readers) on the new view's heading.
  const lastView = useRef<string | null>(null);
  useEffect(() => {
    if (!manifest) return;
    if (lastView.current !== null && lastView.current !== route.view) {
      document.getElementById("page-heading")?.focus();
    }
    lastView.current = route.view;
  }, [manifest, route.view]);

  if (state.status === "loading") {
    return (
      <main class="status-page" aria-busy="true">
        <p class="status-loading" role="status">
          <span class="spinner" aria-hidden="true" />
          Loading review…
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <div class="overview-page">
        <main class="status-page">
          <div class="status-card" role="alert">
            <span class="status-icon">
              <Icon name="alert" size={20} />
            </span>
            <h1>We couldn't open this review</h1>
            <p>{state.message}</p>
            <button type="button" class="button" onClick={retry}>
              <Icon name="refresh" />
              Try again
            </button>
          </div>
        </main>
        <footer class="page-footer">
          <Attribution />
        </footer>
      </div>
    );
  }

  const props: ViewProps = {
    manifest: state.manifest,
    route,
    navigate,
    questionsOpen,
    onQuestionsOpen: setQuestionsOpen,
  };
  if (route.view === "option") return <OptionView {...props} />;
  if (route.view === "compare") return <CompareView {...props} />;
  return <Overview {...props} />;
}
