/**
 * Browser runtime shipped at the top of every `system.js`. Components are light-DOM
 * custom elements whose host element *is* the root of the captured markup (it carries
 * the root's classes), so the captured CSS — including child combinators — applies.
 *
 * Kept free of backticks and `${` so it can be embedded verbatim.
 */
export const RUNTIME_JS = String.raw`
const ds = (() => {
  const system = __SYSTEM__;

  /** h("div.a.b", { role: "x", style: "...", onclick: fn }, ...children) */
  function h(spec, attrs, ...children) {
    const parts = String(spec).split(".");
    const el = document.createElement(parts[0] || "div");
    const classes = parts.slice(1).filter(Boolean);
    if (classes.length) el.className = classes.join(" ");
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") el.classList.add(...String(value).split(/\s+/).filter(Boolean));
        else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
        else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
        else el.setAttribute(key, value === true ? "" : String(value));
      }
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    for (const child of children.flat(Infinity)) {
      if (child === undefined || child === null || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function icon(name, extra) {
    return h("span.codicon.codicon-" + name, extra ? { class: extra } : undefined);
  }

  function themeOf(el) {
    const root = el.closest && el.closest("[data-theme]");
    return (root && root.getAttribute("data-theme")) || system.defaultTheme;
  }

  /** Apply a theme's classes to an element (removing other themes' classes). */
  function applyTheme(el, themeId) {
    const theme = system.themes.find((t) => t.id === themeId) || system.themes.find((t) => t.id === system.defaultTheme);
    for (const t of system.themes) for (const c of t.classes.split(/\s+/).filter(Boolean)) el.classList.remove(c);
    for (const c of theme.classes.split(/\s+/).filter(Boolean)) el.classList.add(c);
    el.setAttribute("data-theme", theme.id);
    return theme;
  }

  const pending = new Set();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      for (const el of pending) if (el.isConnected) el.__init();
      pending.clear();
    });
  }

  class DSElement extends HTMLElement {
    /** Attributes that trigger a re-render. */
    static props = [];
    /** Classes the host always carries (the captured root element's classes). */
    static hostClass = "";
    static get observedAttributes() {
      return this.props;
    }

    connectedCallback() {
      if (this.__slots) return this.update();
      // Children may not be parsed yet when a definition exists before the markup.
      if (document.readyState === "loading") pending.add(this);
      else this.__init();
    }

    __init() {
      this.__slots = { default: [], named: {} };
      for (const node of [...this.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
        const name = node.nodeType === Node.ELEMENT_NODE ? node.getAttribute("slot") : null;
        if (name) (this.__slots.named[name] = this.__slots.named[name] || []).push(node);
        else this.__slots.default.push(node);
      }
      for (const c of String(this.constructor.hostClass).split(/\s+/).filter(Boolean)) this.classList.add(c);
      this.update();
    }

    attributeChangedCallback() {
      if (this.__slots && this.isConnected) this.update();
    }

    /** Re-render. "render()" returns the children (nodes, strings, arrays) or undefined to leave them alone. */
    update() {
      const out = this.render();
      if (out !== undefined) {
        this.replaceChildren();
        append(this, [out]);
      }
      if (this.updated) this.updated();
    }

    render() {
      return undefined;
    }

    /** Nodes passed in a slot ("" = default children). */
    slotted(name) {
      return name ? this.__slots.named[name] || [] : this.__slots.default;
    }

    hasSlot(name) {
      return this.slotted(name).length > 0;
    }

    attr(name, fallback) {
      const value = this.getAttribute(name);
      return value === null ? fallback : value;
    }

    flag(name) {
      const value = this.getAttribute(name);
      return value !== null && value !== "false";
    }

    /** Toggle state classes managed by the component (keeps classes added by authors). */
    setClasses(map) {
      for (const [cls, on] of Object.entries(map)) for (const c of cls.split(/\s+/).filter(Boolean)) this.classList.toggle(c, !!on);
    }
  }

  function define(tag, ctor) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }

  return { system, h, append, icon, themeOf, applyTheme, define, Element: DSElement };
})();
window.ds = window.ds || {};
window.ds[ds.system.id] = ds;
`;
