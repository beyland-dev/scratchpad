import { useEffect } from "preact/hooks";
import { LocationProvider, Route, Router } from "preact-iso";
import { Header } from "./components/Header.tsx";
import { startLiveUpdates } from "./store.ts";
import { Compare } from "./views/Compare.tsx";
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

export function App() {
  useEffect(() => startLiveUpdates(), []);
  return (
    <LocationProvider>
      <div class="app">
        <Header />
        <main class="app-main">
          <Router>
            <Route path="/" component={Gallery} />
            <Route path="/p/:id" component={Viewer} />
            <Route path="/compare" component={Compare} />
            <Route path="/systems" component={Systems} />
            <Route path="/systems/:id" component={SystemView} />
            <Route path="/systems/:id/c/:name" component={ComponentView} />
            <Route path="/systems/:id/captures/:label" component={CaptureView} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </div>
    </LocationProvider>
  );
}
