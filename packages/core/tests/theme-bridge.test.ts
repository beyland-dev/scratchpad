import vm from "node:vm";
import { describe, expect, test } from "vite-plus/test";
import { prototypeHeadScript } from "../src/systems/package.ts";
import { RUNTIME_JS } from "../src/systems/runtime.ts";
import { THEME_BRIDGE_JS } from "../src/systems/theme-bridge.ts";
import type { DesignSystem } from "../src/systems/schemas.ts";

// A minimal DOM: just what the theme bridge touches.
class FakeClassList {
  readonly items = new Set<string>();
  add(...names: string[]) {
    for (const n of names) this.items.add(n);
  }
  remove(...names: string[]) {
    for (const n of names) this.items.delete(n);
  }
  contains(name: string) {
    return this.items.has(name);
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly attrs = new Map<string, string>();
  readonly classList = new FakeClassList();
  readonly children: FakeElement[] = [];
  readonly localName: string;
  constructor(localName: string) {
    this.localName = localName;
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, String(value));
  }
  append(child: FakeElement) {
    this.children.push(child);
    return child;
  }
  querySelectorAll(tag: string): FakeElement[] {
    return this.children.flatMap((c) => [
      ...(c.localName === tag ? [c] : []),
      ...c.querySelectorAll(tag),
    ]);
  }
}

interface Posted {
  message: { type: string; system: string; themes: { id: string }[]; theme: string | null };
  origin: string;
}

function setup(options: { search?: string; embedded?: boolean; loading?: boolean } = {}) {
  const html = new FakeElement("html");
  const body = html.append(new FakeElement("body"));
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const on = (type: string, fn: (event: unknown) => void) =>
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  const emit = (type: string, event: unknown = {}) => {
    for (const fn of listeners.get(type) ?? []) fn(event);
  };
  const observers: ((records: { addedNodes: FakeElement[] }[]) => void)[] = [];
  const posted: Posted[] = [];
  const parent = {
    postMessage: (message: Posted["message"], origin: string) => posted.push({ message, origin }),
  };
  const document = {
    readyState: options.loading ? "loading" : "complete",
    documentElement: html,
    querySelectorAll: (tag: string) => html.querySelectorAll(tag),
    querySelector: (tag: string) => html.querySelectorAll(tag)[0] ?? null,
    addEventListener: (type: string, fn: (event: unknown) => void) => on(`document:${type}`, fn),
  };
  const context: Record<string, unknown> = {
    document,
    location: { search: options.search ?? "" },
    URLSearchParams,
    addEventListener: on,
    MutationObserver: class {
      constructor(fn: (records: { addedNodes: FakeElement[] }[]) => void) {
        observers.push(fn);
      }
      observe() {}
    },
  };
  context.window = context;
  context.parent = options.embedded === false ? context : parent;
  vm.createContext(context);
  return {
    html,
    body,
    posted,
    parent,
    context,
    run: (code: string) => vm.runInContext(code, context),
    /** A message event from `source` (the parent window by default). */
    message: (data: unknown, source: unknown = parent) => emit("message", { data, source }),
    domReady: () => emit("document:DOMContentLoaded"),
    /** Report nodes added to the document, like a MutationObserver would. */
    added: (...nodes: FakeElement[]) => {
      for (const fn of observers) fn([{ addedNodes: nodes }]);
    },
  };
}

const captured = {
  id: "vscode",
  rootContext: "vsc-workbench",
  defaultTheme: "dark-2026",
  themes: [
    { id: "dark-2026", label: "Dark 2026", kind: "dark", classes: "vs-dark" },
    { id: "light-2026", label: "Light 2026", kind: "light", classes: "vs" },
  ],
};

const bridge = (system: unknown) => `${THEME_BRIDGE_JS}\ndtThemeBridge(${JSON.stringify(system)});`;

describe("theme bridge", () => {
  test("?theme= sets the theme of root context elements, including ones added later", () => {
    const env = setup({ search: "?theme=light-2026&other=1" });
    const authored = env.body.append(new FakeElement("vsc-workbench"));
    authored.setAttribute("theme", "dark-2026");
    env.run(bridge(captured));
    expect(authored.getAttribute("theme")).toBe("light-2026");

    const later = new FakeElement("div");
    const nested = later.append(new FakeElement("vsc-workbench"));
    env.added(later);
    expect(nested.getAttribute("theme")).toBe("light-2026");
  });

  test("without a URL theme or message, prototypes keep their authored theme", () => {
    const env = setup();
    const authored = env.body.append(new FakeElement("vsc-workbench"));
    authored.setAttribute("theme", "light-2026");
    env.run(bridge(captured));
    const later = env.body.append(new FakeElement("vsc-workbench"));
    env.added(later);
    expect(authored.getAttribute("theme")).toBe("light-2026");
    expect(later.getAttribute("theme")).toBeNull();
    // The handshake reports what's on screen.
    expect(env.posted[0]?.message).toMatchObject({ type: "dt-theme-ready", theme: "light-2026" });
  });

  test("dt-theme messages apply only from the parent window, and only known themes", () => {
    const env = setup();
    const wb = env.body.append(new FakeElement("vsc-workbench"));
    wb.setAttribute("theme", "dark-2026");
    env.run(bridge(captured));

    env.message({ type: "dt-theme", theme: "light-2026" }, { not: "the parent" });
    expect(wb.getAttribute("theme")).toBe("dark-2026");
    env.message({ type: "dt-theme", theme: "no-such-theme" });
    expect(wb.getAttribute("theme")).toBe("dark-2026");
    env.message({ type: "something-else", theme: "light-2026" });
    expect(wb.getAttribute("theme")).toBe("dark-2026");

    env.message({ type: "dt-theme", theme: "light-2026" });
    expect(wb.getAttribute("theme")).toBe("light-2026");
  });

  test("unknown URL themes are ignored", () => {
    const env = setup({ search: "?theme=light" });
    const wb = env.body.append(new FakeElement("vsc-workbench"));
    wb.setAttribute("theme", "dark-2026");
    env.run(bridge(captured));
    expect(wb.getAttribute("theme")).toBe("dark-2026");
  });

  test("posts dt-theme-ready to the parent once the page is parsed", () => {
    const env = setup({ loading: true, search: "?theme=light-2026" });
    env.run(bridge(captured));
    expect(env.posted).toEqual([]);
    // Root contexts parsed after the script still get the theme.
    const wb = env.body.append(new FakeElement("vsc-workbench"));
    env.domReady();
    expect(wb.getAttribute("theme")).toBe("light-2026");
    expect(env.posted).toHaveLength(1);
    expect(env.posted[0]!.message).toEqual({
      type: "dt-theme-ready",
      system: "vscode",
      themes: [
        { id: "dark-2026", label: "Dark 2026", kind: "dark" },
        { id: "light-2026", label: "Light 2026", kind: "light" },
      ],
      theme: "light-2026",
    });
  });

  test("standalone pages (not in a frame) don't post or listen to the parent", () => {
    const env = setup({ embedded: false, search: "?theme=light-2026" });
    const wb = env.body.append(new FakeElement("vsc-workbench"));
    env.run(bridge(captured));
    expect(wb.getAttribute("theme")).toBe("light-2026");
    expect(env.posted).toEqual([]);
  });

  test("installs once per system, even if system.js loads twice", () => {
    const env = setup();
    env.run(bridge(captured));
    env.run(bridge(captured));
    expect(env.posted).toHaveLength(1);
  });

  test("ships in every system.js runtime", () => {
    expect(RUNTIME_JS).toContain("dtThemeBridge(system)");
    // The runtime is embedded verbatim in a template, so it can't contain these.
    expect(RUNTIME_JS).not.toMatch(/`|\$\{/);
    expect(THEME_BRIDGE_JS).not.toMatch(/`|\$\{/);
  });
});

describe("theme bridge in framework (package system) prototypes", () => {
  const system = {
    id: "acme-ui",
    name: "Acme UI",
    kind: "package",
    defaultTheme: "light",
    themes: [
      { id: "light", label: "Light", kind: "light", classes: "" },
      { id: "dark", label: "Dark", kind: "dark", classes: "dark" },
    ],
  } as unknown as DesignSystem;

  test("switches data-theme and theme classes on <html>", () => {
    const env = setup({ search: "?theme=dark" });
    env.run(prototypeHeadScript(system));
    expect(env.html.getAttribute("data-theme")).toBe("dark");
    expect(env.html.classList.contains("dark")).toBe(true);

    env.message({ type: "dt-theme", theme: "light" });
    expect(env.html.getAttribute("data-theme")).toBe("light");
    expect(env.html.classList.contains("dark")).toBe(false);
    expect(env.posted[0]!.message).toMatchObject({ system: "acme-ui", theme: "dark" });
  });

  test("reports a theme set by the prototype's own classes", () => {
    const env = setup();
    env.html.classList.add("dark");
    env.run(prototypeHeadScript(system));
    expect(env.html.getAttribute("data-theme")).toBeNull();
    expect(env.posted[0]!.message.theme).toBe("dark");
  });

  test("escapes the system info for an inline script", () => {
    const tricky = { ...system, themes: [{ ...system.themes[0]!, label: "</script><b>" }] };
    expect(prototypeHeadScript(tricky as DesignSystem)).not.toContain("</script>");
  });
});
