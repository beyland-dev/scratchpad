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

class Tab extends ds.Element {
  static hostClass = "tab tab-actions-right sizing-fit has-icon";
  static props = ["label", "active", "preview", "dirty", "language", "parent"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "");
    const active = this.flag("active");
    this.setClasses({ active, selected: active, "tab-border-bottom": true, "tab-border-top": active, dirty: this.flag("dirty") });
    this.setAttribute("role", "tab");
    this.setAttribute("draggable", "true");
    this.setAttribute("aria-label", label + (this.flag("preview") ? ", preview" : ""));
    this.setAttribute("aria-selected", String(active));
    this.setAttribute("tabindex", active ? "0" : "-1");
    this.setAttribute("data-resource-name", label);
    this.style.left = "auto";
    this.style.borderRight = "1px solid var(--vscode-tab-border)";
    this.style.setProperty("--tab-border-top-color", active ? "var(--vscode-tab-activeBorderTop)" : "");
    this.style.setProperty("--tab-border-bottom-color", "var(--vscode-tab-activeBorder)");
    const icon = ds.fileIconClasses(label, "file", this.attr("language"), this.attr("parent", "ws"));
    return [
      h("div.tab-fill", { "aria-hidden": "true" }),
      h("div.tab-connected-edge", { "aria-hidden": "true" }),
      h("div.tab-divider", { "aria-hidden": "true" }),
      h("div.tab-border-top-container"),
      h("div.monaco-icon-label.tab-label.tab-label-has-badge" + (this.flag("preview") ? ".italic" : ""), { class: icon.join(" "), "aria-label": label },
        h("div.monaco-icon-label-container", null,
          h("span.monaco-icon-name-container", null, h("a.label-name", null, label)))),
      h("div.tab-actions", null,
        h("div.monaco-action-bar", null,
          h("ul.actions-container", { role: "toolbar", "aria-label": "Tab actions" },
            h("li.action-item", { role: "presentation" },
              h("a.action-label.codicon.codicon-close-small", { role: "button", "aria-label": "Close (Ctrl+W)", tabindex: active ? "0" : "-1" }))))),
      h("div.tab-fade-hider"),
      h("div.tab-border-bottom-container"),
    ];
  }
}
ds.define("vsc-tab", Tab);
