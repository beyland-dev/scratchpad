import { render } from "preact";
import { App } from "./app.tsx";
import "./styles.css";
import "./theme.ts";
import { syncDesktopIcon } from "./icon.ts";

render(<App />, document.getElementById("app")!);
void syncDesktopIcon().catch(() => {});
