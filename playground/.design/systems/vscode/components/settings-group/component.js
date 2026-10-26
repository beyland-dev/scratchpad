class SettingsGroup extends ds.Element {
  static hostClass = "monaco-list-row";
  static props = ["label", "level", "first"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "");
    const level = this.attr("level", "1");
    this.setAttribute("role", "treeitem");
    this.setAttribute("aria-label", label);
    this.setAttribute("aria-level", level);
    this.setAttribute("aria-expanded", "true");
    this.style.position = "relative";
    this.style.top = "0px";
    this.style.height = "42px";
    this.style.lineHeight = "42px";
    return h("div.monaco-tl-row", null,
      h("div.monaco-tl-indent", { style: "width: 0px;" }),
      h("div.monaco-tl-twistie.codicon.codicon-tree-item-expanded.collapsible", { style: "padding-left: 8px;" }),
      h("div.monaco-tl-contents.group-title", null,
        h("div.settings-group-title-label.settings-row-inner-container.settings-group-level-" + level + (this.attr("first", "true") !== "false" ? ".settings-group-first" : ""), null, label)));
  }
}
ds.define("vsc-settings-group", SettingsGroup);
