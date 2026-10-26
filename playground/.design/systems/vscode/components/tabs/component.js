// Shared by tree items and tabs: VS Code's getIconClasses() (src/vs/editor/common/services/getIconClasses.ts).
ds.fileIconClasses = ds.fileIconClasses || (() => {
  const LANGS = {
    ts: "typescript", mts: "typescript", cts: "typescript", tsx: "typescriptreact", js: "javascript", mjs: "javascript", cjs: "javascript",
    jsx: "javascriptreact", json: "json", jsonc: "jsonc", md: "markdown", css: "css", scss: "scss", less: "less", html: "html", htm: "html",
    py: "python", rs: "rust", go: "go", java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", sh: "shellscript",
    yml: "yaml", yaml: "yaml", xml: "xml", svg: "xml", sql: "sql", rb: "ruby", php: "php", swift: "swift", kt: "kotlin",
    dockerfile: "dockerfile", txt: "plaintext", ps1: "powershell", lua: "lua", r: "r", dart: "dart", vue: "vue", toml: "toml",
  };
  return (name, kind, language, parent) => {
    const lower = String(name || "").toLowerCase();
    const classes = [kind === "folder" ? "folder-icon" : kind === "root" ? "rootfolder-icon" : "file-icon"];
    if (parent) classes.push(parent.toLowerCase() + "-name-dir-icon");
    if (kind === "folder") classes.push(lower + "-name-folder-icon");
    else if (kind === "root") classes.push(lower + "-root-name-folder-icon");
    else {
      classes.push(lower + "-name-file-icon", "name-file-icon");
      const segments = lower.split(".");
      for (let i = 1; i < segments.length; i++) classes.push(segments.slice(i).join(".") + "-ext-file-icon");
      classes.push("ext-file-icon");
      const lang = language || LANGS[segments.length > 1 ? segments[segments.length - 1] : lower] || (lower === "dockerfile" ? "dockerfile" : "");
      if (lang) classes.push(lang + "-lang-file-icon");
    }
    return classes;
  };
})();

class Tabs extends ds.Element {
  static hostClass = "title tabs show-file-icons tab-actions-reserve-space connected-tabs-labels";
  static props = ["breadcrumbs", "no-breadcrumbs"];
  render() {
    const h = ds.h;
    const tabs = this.slotted("").filter((n) => n.nodeType === 1);
    const activeIndex = tabs.findIndex((t) => t.hasAttribute("active") && t.getAttribute("active") !== "false");
    tabs.forEach((tab, i) => {
      tab.classList.add("connected-tab-top-row");
      tab.classList.toggle("connected-tab-left-edge", i === 0 && i === activeIndex);
      tab.classList.toggle("last-tab", i === tabs.length - 1);
      tab.classList.toggle("connected-tab-last", i === tabs.length - 1);
    });
    this.style.setProperty("--editor-group-tab-height", "35px");
    this.style.backgroundColor = "var(--modern-ui-editor-title-background, var(--vscode-editorGroupHeader-tabsBackground))";
    this.style.setProperty("--title-border-bottom-width", "100%");
    const actions = this.slotted("actions");
    const scrollbar = (dir, style, slider) => h("div.invisible.scrollbar." + dir, { role: "presentation", "aria-hidden": "true", style }, h("div.slider", { style: slider }));
    const strip = h("div.tabs-and-actions-container.tabs-border-bottom", { style: "--tabs-border-bottom-color: var(--vscode-editorGroupHeader-tabsBorder);" },
      h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
        h("div.tabs-container", { role: "tablist", "aria-multiselectable": "true", style: "overflow: hidden; --last-tab-add-tab-width: 0px;" }, tabs),
        scrollbar("horizontal", "position: absolute; width: 100%; height: 3px; left: 0px; bottom: 0px;", "position: absolute; top: 0px; left: 0px; height: 3px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;"),
        scrollbar("vertical", "position: absolute; width: 0px; height: 0px; right: 0px; top: 0px;", "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 0px;"),
        h("div.sticky-tabs-background", { "aria-hidden": "true", style: "width: 0px;" }),
        h("div.tab-connected-overflow-edge" + (activeIndex >= 0 ? ".connected-tab-top-row" : ""), {
          "aria-hidden": "true",
          style: "--modern-ui-connected-tab-border: var(--vscode-editorGroupHeader-tabsBorder); --modern-ui-connected-tab-overflow-top-border: var(--vscode-editorGroupHeader-tabsBorder); --modern-ui-connected-tab-overflow-top-background: none; inset: -1px 0px 0px;",
        }, h("div.tab-connected-overflow-right", null, h("div.tab-connected-overflow-right-edge")))),
      h("div.editor-toolbars", null,
        h("div.editor-actions", null,
          h("div.monaco-toolbar", null,
            h("div.monaco-action-bar" + (actions.length ? ".has-overflow" : ""), null,
              h("ul.actions-container.highlight-toggled", { role: "toolbar", "aria-label": "Editor actions" }, actions)))),
        h("div.editor-actions-separator", { "aria-hidden": "true", style: "display: none;" }),
        h("div.editor-layout-actions", { "aria-hidden": "true", style: "display: none;" },
          h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container.highlight-toggled", { role: "toolbar", "aria-label": "Editor layout actions" }))))));
    if (this.flag("no-breadcrumbs")) return strip;

    const active = tabs[activeIndex];
    const path = this.attr("breadcrumbs", active ? active.getAttribute("label") || "" : "");
    const segments = path.split("/").filter(Boolean);
    const separator = () => h("div.codicon.codicon-breadcrumb-separator");
    const label = (name, kind) => h("div.monaco-icon-label", { class: ds.fileIconClasses(name, kind, undefined, "ws").join(" "), "aria-label": name },
      h("div.monaco-icon-label-container", null, h("span.monaco-icon-name-container", null, h("a.label-name", null, name))));
    const items = segments.map((name, i) => {
      const file = i === segments.length - 1;
      return h("div." + (file ? "file" : "folder") + ".monaco-breadcrumb-item", { draggable: "true", tabindex: "-1", role: "listitem" }, label(name, file ? "file" : "folder"), separator());
    });
    if (segments.length) items.push(h("div.monaco-breadcrumb-item", { draggable: "true", tabindex: "-1", role: "listitem" }, h("span", null, "\u2026"), separator()));
    return [
      strip,
      h("div.breadcrumbs-below-tabs", { style: "width: 100%;" },
        h("div.breadcrumbs-control.with-editor-type.relative-path", null,
          h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
            h("div.monaco-breadcrumbs", { tabindex: "0", role: "list", style: "overflow: hidden; width: 100%; height: 22px;" }, items),
            scrollbar("horizontal", "position: absolute; width: 100%; height: 3px; left: 0px; bottom: 0px;", "position: absolute; top: 0px; left: 0px; height: 3px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;"),
            scrollbar("vertical", "position: absolute; width: 0px; height: 22px; right: 0px; top: 0px;", "position: absolute; top: 0px; left: 0px; width: 0px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 22px;")))),
    ];
  }
}
ds.define("vsc-tabs", Tabs);
