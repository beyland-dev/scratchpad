import { describe, expect, test } from "vite-plus/test";
import {
  parseThemeReady,
  postTheme,
  prototypeHref,
  themeOptions,
  withTheme,
  type ThemeReady,
} from "../src/prototype-theme.ts";

const ready: ThemeReady = {
  system: "vscode",
  themes: [
    { id: "dark-2026", label: "Dark 2026", kind: "dark" },
    { id: "light-2026", label: "Light 2026", kind: "light" },
  ],
  theme: "dark-2026",
};

describe("prototype theme (viewer side)", () => {
  test("adds the theme to the frame URL, keeping its other parameters", () => {
    const raw = "http://127.0.0.1:7421/projects/web/prototypes/inbox-one/";
    expect(withTheme(raw, "light-2026")).toBe(`${raw}?theme=light-2026`);
    expect(withTheme(`${raw}page.html?step=2&theme=old`, "dark-2026")).toBe(
      `${raw}page.html?step=2&theme=dark-2026`,
    );
    // No theme chosen: the prototype renders exactly as before.
    expect(withTheme(raw, undefined)).toBe(raw);
  });

  test("keeps the theme (and viewport) when switching versions", () => {
    expect(prototypeHref("web/inbox-one-v2", { device: "tablet", theme: "light-2026" })).toBe(
      "/projects/web/p/inbox-one-v2?device=tablet&theme=light-2026",
    );
    expect(prototypeHref("web/inbox-one", {})).toBe("/projects/web/p/inbox-one");
  });

  test("offers themes only for a prototype whose design system answered", () => {
    expect(themeOptions("vscode", ready)).toEqual(ready.themes);
    expect(themeOptions("vscode-project/vscode", ready)).toEqual(ready.themes);
    // No system, no handshake, another system's handshake, or a single theme: hidden.
    expect(themeOptions(undefined, ready)).toBeNull();
    expect(themeOptions("vscode", null)).toBeNull();
    expect(themeOptions("acme-ui", ready)).toBeNull();
    expect(themeOptions("vscode", { ...ready, themes: ready.themes.slice(0, 1) })).toBeNull();
  });

  test("parses only well-formed dt-theme-ready messages", () => {
    expect(parseThemeReady({ type: "dt-theme-ready", ...ready })).toEqual(ready);
    expect(parseThemeReady({ type: "dt-theme-ready", system: "vscode" })).toBeNull();
    expect(parseThemeReady({ type: "dt-specimen-size", height: 10 })).toBeNull();
    expect(parseThemeReady(null)).toBeNull();
    expect(
      parseThemeReady({
        type: "dt-theme-ready",
        system: "x",
        themes: [{ id: 1 }, ready.themes[0]],
      }),
    ).toEqual({ system: "x", themes: [ready.themes[0]], theme: null });
  });

  test("posts a dt-theme message to the prototype frame", () => {
    const sent: [unknown, string][] = [];
    const frame = {
      contentWindow: { postMessage: (data: unknown, origin: string) => sent.push([data, origin]) },
    } as unknown as HTMLIFrameElement;
    postTheme(frame, "light-2026");
    // Sandboxed frames have an opaque origin, so a specific target origin would never match.
    expect(sent).toEqual([[{ type: "dt-theme", theme: "light-2026" }, "*"]]);
    expect(() => postTheme(null, "light-2026")).not.toThrow();
  });
});
