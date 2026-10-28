import { render } from "preact";
import { App } from "./app.tsx";
import "./styles.css";
import "./theme.ts";

render(<App />, document.getElementById("app")!);
