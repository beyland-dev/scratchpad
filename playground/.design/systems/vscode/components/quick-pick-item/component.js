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

class QuickPickItem extends ds.Element {
  static hostClass = "monaco-list-row";
  static props = ["label", "description", "keys", "separator", "focused", "highlight", "file", "icon"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "");
    const focused = this.flag("focused");
    const separator = this.attr("separator", "");
    const keys = this.attr("keys", "");
    this.setClasses({ focused });
    this.setAttribute("role", "option");
    this.setAttribute("aria-label", [label, keys, separator].filter(Boolean).join(", "));
    this.setAttribute("draggable", "false");
    this.style.height = "22px";
    // Highlight the first case-insensitive match of `highlight` in the label.
    const highlighted = (text, term) => {
      const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
      if (at < 0) return [text];
      return [text.slice(0, at), h("span.highlight", null, text.slice(at, at + term.length)), text.slice(at + term.length)].filter((x) => x !== "");
    };
    const iconClasses = this.hasAttribute("file") ? ds.fileIconClasses(this.attr("file", "") || label, "file", undefined, "ws").join(" ") : "";
    const icon = this.attr("icon");
    const actions = this.slotted("actions");
    return h("div.monaco-tl-row", null,
      h("div.monaco-tl-indent", { style: "width: 0px;" }),
      h("div.monaco-tl-twistie", { style: "padding-left: 8px;" }),
      h("div.monaco-tl-contents", null,
        h("div.quick-input-list-entry" + (actions.length ? ".has-actions" : "") + (separator ? ".quick-input-list-separator-border" : ""), null,
          h("label.quick-input-list-label", null,
            h("div.quick-input-list-rows", null,
              h("div.quick-input-list-row", null,
                h("div.monaco-icon-label", { class: iconClasses || undefined, "aria-label": "" },
                  h("div", { class: icon ? "codicon codicon-" + icon : "" }),
                  h("div.monaco-icon-label-container", null,
                    h("span.monaco-icon-name-container", null,
                      h("a.label-name", null, h("span.monaco-highlighted-label", null, highlighted(label, this.attr("highlight", ""))))),
                    this.hasAttribute("description")
                      ? h("span.monaco-icon-description-container", null,
                          h("span.label-description", null, h("span.monaco-highlighted-label", null, this.attr("description", "") || null)))
                      : null)),
                keys ? h("div.quick-input-list-entry-keybinding", null, h("vsc-keybinding", { keys, unstyled: "" })) : null),
              h("div.quick-input-list-row", null,
                h("div.quick-input-list-label-meta", null,
                  h("div.monaco-icon-label", { style: "display: none;" },
                    h("div.monaco-icon-label-container", null, h("span.monaco-icon-name-container"))))))),
          h("div.quick-input-list-separator", { style: separator ? "" : "display: none;" }, separator || null),
          h("div.monaco-toolbar.quick-input-list-entry-action-bar", null,
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, actions))))));
  }
}
ds.define("vsc-quick-pick-item", QuickPickItem);
