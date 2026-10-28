import { useEffect } from "preact/hooks";
import { LocationProvider, Route, Router, useLocation } from "preact-iso";
import { ConnectionToast, Header, isImmersive } from "./components/Header.tsx";
import { NewVariantHost } from "./components/NewVariant.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { homeProjectId, loaded, projectHref, startLiveUpdates } from "./store.ts";
import { Compare } from "./views/Compare.tsx";
import { Feedback } from "./views/Feedback.tsx";
import { Handoff } from "./views/Handoff.tsx";
import { Settings } from "./views/Settings.tsx";
import { CaptureView } from "./views/CaptureView.tsx";
import { ComponentView } from "./views/ComponentView.tsx";
import { Systems } from "./views/Systems.tsx";
import { SystemView } from "./views/SystemView.tsx";
import { Gallery } from "./views/Gallery.tsx";
import { Viewer } from "./views/Viewer.tsx";

function NotFound() {
  return (
    <p class="page-message">
      Page not found. <a href="/">Back to prototypes</a>
    </p>
  );
}

/** Sends "/" to the last visited project. */
function ToHomeProject() {
  const { route } = useLocation();
  const target = loaded.value ? homeProjectId() : undefined;
  useEffect(() => {
    if (target) route(projectHref(target), true);
  }, [target]);
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  if (!target)
    return (
      <p class="page-message">
        No projects yet. Create one from the sidebar, or with{" "}
        <code>sp project create --name "My product"</code>.
      </p>
    );
  return null;
}

function Shell() {
  const { path } = useLocation();
  const immersive = isImmersive(path);
  return (
    <div class="app">
      {!immersive && <Sidebar />}
      <div class="app-column">
        <Header />
        <main class="app-main">
          <Router>
            <Route path="/" component={ToHomeProject} />
            <Route path="/projects/:project" component={Gallery} />
            <Route path="/projects/:project/systems" component={Systems} />
            <Route path="/projects/:project/feedback" component={Feedback} />
            <Route path="/projects/:project/handoff" component={Handoff} />
            <Route path="/settings" component={Settings} />
            <Route path="/projects/:project/p/:id" component={Viewer} />
            <Route path="/compare" component={Compare} />
            <Route path="/projects/:project/systems/:id" component={SystemView} />
            <Route path="/projects/:project/systems/:id/c/:name" component={ComponentView} />
            <Route path="/projects/:project/systems/:id/captures/:label" component={CaptureView} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </div>
      <ConnectionToast />
      <NewVariantHost />
    </div>
  );
}

export function App() {
  useEffect(() => startLiveUpdates(), []);
  return (
    <LocationProvider>
      <Shell />
    </LocationProvider>
  );
}
