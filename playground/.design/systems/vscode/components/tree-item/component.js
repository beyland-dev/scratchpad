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

class TreeItem extends ds.Element {
  static hostClass = "monaco-list-row";
  static props = ["label", "kind", "level", "expanded", "selected", "focused", "language", "parent"];
  render() {
    const label = this.attr("label", "");
    const kind = this.attr("kind", "file");
    const level = Math.max(1, Number(this.attr("level", "1")) || 1);
    const folder = kind === "folder";
    const expanded = this.flag("expanded");
    const selected = this.flag("selected");
    this.setClasses({ selected, focused: this.flag("focused") });
    this.setAttribute("role", "treeitem");
    this.setAttribute("aria-label", label);
    this.setAttribute("aria-level", String(level));
    this.setAttribute("aria-selected", String(selected));
    if (folder) this.setAttribute("aria-expanded", String(expanded));
    this.setAttribute("draggable", "true");
    this.style.height = "22px";
    this.style.lineHeight = "22px";
    const indentSize = 8 + (level - 1) * 8;
    const twistie = folder
      ? "div.monaco-tl-twistie.codicon.codicon-tree-item-expanded.collapsible" + (expanded ? "" : ".collapsed")
      : "div.monaco-tl-twistie";
    const icon = ds.fileIconClasses(label, folder ? "folder" : "file", this.attr("language"), this.attr("parent", "ws"));
    return ds.h("div.monaco-tl-row", null,
      ds.h("div.monaco-tl-indent", { style: "width: " + (indentSize + 8 - 16) + "px;" }),
      ds.h(twistie, { style: "padding-left: " + indentSize + "px;" }),
      ds.h("div.monaco-tl-contents", null,
        ds.h("div.monaco-icon-label.explorer-item", { class: icon.join(" "), "aria-label": label, style: "display: flex;" },
          ds.h("div.monaco-icon-label-container", null,
            ds.h("span.monaco-icon-name-container", null,
              ds.h("a.label-name", null, ds.h("span.monaco-highlighted-label", null, label)))))));
  }
}
ds.define("vsc-tree-item", TreeItem);
