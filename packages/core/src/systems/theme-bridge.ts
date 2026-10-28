/**
 * Theme bridge between the app's viewer and a prototype, shipped in every captured system's
 * `system.js` (inside the runtime) and injected into every framework prototype build. The viewer
 * can only reach a sandboxed, cross-origin prototype through its URL and `postMessage`:
 *
 * - `?theme=<id>` in the prototype's URL applies that theme on load.
 * - `{ type: "dt-theme", theme: "<id>" }` from the parent window switches it live (other senders and
 *   unknown theme ids are ignored).
 * - Once the page is parsed, it posts `{ type: "dt-theme-ready", system, themes, theme }` to the
 *   parent so the viewer knows the prototype can be themed (and which theme it shows).
 *
 * Applying a theme sets the `theme` attribute of every root context element (captured systems,
 * e.g. `<vsc-workbench theme="dark-2026">`, including ones added later), or, for systems without a
 * root context (package systems), `data-theme` and the theme's classes on `<html>`. Without a URL
 * theme or message nothing changes, so prototypes keep their authored theme.
 *
 * Kept free of backticks and `${` so it can be embedded verbatim in the runtime.
 */
export const THEME_BRIDGE_JS = String.raw`
function dtThemeBridge(system) {
  const registry = (window.__dtThemeBridges = window.__dtThemeBridges || {});
  if (registry[system.id]) return registry[system.id];
  const themes = system.themes || [];
  const root = system.rootContext;
  const classesOf = (theme) => String((theme && theme.classes) || "").split(/\s+/).filter(Boolean);
  const embedded = window.parent && window.parent !== window;
  let current = null;

  const applyTo = (el) => {
    if (current && el.getAttribute("theme") !== current) el.setAttribute("theme", current);
  };
  const apply = () => {
    if (!current) return;
    if (root) {
      for (const el of document.querySelectorAll(root)) applyTo(el);
      return;
    }
    const html = document.documentElement;
    for (const t of themes) for (const c of classesOf(t)) html.classList.remove(c);
    for (const c of classesOf(themes.find((t) => t.id === current))) html.classList.add(c);
    html.setAttribute("data-theme", current);
  };
  const set = (id) => {
    if (typeof id !== "string" || !themes.some((t) => t.id === id)) return false;
    current = id;
    apply();
    return true;
  };
  /** The theme on screen: the chosen one, else what the prototype authored, else the default. */
  const effective = () => {
    if (current) return current;
    if (root) {
      const el = document.querySelector(root);
      const authored = el && el.getAttribute("theme");
      if (authored && themes.some((t) => t.id === authored)) return authored;
    } else {
      const html = document.documentElement;
      const marked = html.getAttribute("data-theme");
      if (marked && themes.some((t) => t.id === marked)) return marked;
      const classed = themes.find((t) => classesOf(t).length && classesOf(t).every((c) => html.classList.contains(c)));
      if (classed) return classed.id;
    }
    return system.defaultTheme || (themes[0] && themes[0].id) || null;
  };

  try {
    set(new URLSearchParams(location.search).get("theme"));
  } catch (error) {
    // An unreadable URL just means no initial theme.
  }

  // Root contexts parsed or rendered after this script ran.
  if (root && typeof MutationObserver === "function") {
    new MutationObserver((records) => {
      if (!current) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.localName === root) applyTo(node);
          if (node.querySelectorAll) for (const el of node.querySelectorAll(root)) applyTo(el);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  addEventListener("message", (event) => {
    if (!embedded || event.source !== window.parent) return;
    const data = event.data;
    if (data && data.type === "dt-theme") set(data.theme);
  });

  const ready = () => {
    apply();
    if (!embedded) return;
    window.parent.postMessage(
      {
        type: "dt-theme-ready",
        system: system.id,
        themes: themes.map((t) => ({ id: t.id, label: t.label, kind: t.kind })),
        theme: effective(),
      },
      "*",
    );
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  return (registry[system.id] = { set, effective });
}
`;
