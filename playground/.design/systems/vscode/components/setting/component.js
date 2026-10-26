class Setting extends ds.Element {
  static hostClass = "monaco-list-row";
  static props = ["type", "category", "label", "key", "value", "options", "checked"];
  render() {
    const h = ds.h;
    const type = this.attr("type", "text");
    const key = this.attr("key", "");
    const category = this.attr("category", "");
    const label = this.attr("label", "");
    this.setAttribute("role", "treeitem");
    this.setAttribute("aria-selected", "false");
    this.setAttribute("aria-level", "2");
    this.style.position = "relative";
    this.style.top = "0px";
    const nodes = this.slotted("");
    const rich = nodes.some((n) => n.nodeType === 1);
    const description = h("div.setting-item-description", null,
      rich ? h("div.rendered-markdown.setting-item-markdown", null, h("p", null, nodes)) : nodes);
    const title = type === "bool"
      ? h("div.setting-item-title", null, h("span.setting-item-category", null, category), h("span.setting-item-label", null, label),
          h("div.setting-indicators-container", { role: "button", style: "display: none;" }))
      : h("div.setting-item-title", null,
          h("div.setting-item-cat-label-container", null, h("span.setting-item-category", null, category), h("span.setting-item-label", null, label)),
          h("div.setting-indicators-container", { role: "button", style: "display: none;" }));
    let body;
    if (type === "bool") {
      body = [h("div.setting-item-value-description", null,
        h("div.setting-item-bool-control", null,
          h("vsc-checkbox", { variant: "settings", label: key, checked: this.flag("checked") ? "" : undefined, class: "setting-control-focus-target", "data-focusable": "true" })),
        description), h("div.setting-item-modified-indicator")];
    } else if (type === "enum") {
      body = [description, h("div.setting-item-enumDescription"), h("div.setting-item-modified-indicator"),
        h("div.setting-item-value", null, h("div.setting-item-control.select-container", null,
          // Native select directly in the control (VS Code's CSS targets ".setting-item-control > select").
          (() => {
            const options = this.attr("options", "").split(",").map((o) => o.trim()).filter(Boolean);
            const select = h("select.monaco-select-box.setting-control-focus-target", {
              tabindex: "-1", "aria-label": key, "data-focusable": "true",
              style: "background-color: var(--vscode-settings-dropdownBackground); color: var(--vscode-settings-dropdownForeground); border-color: var(--vscode-settings-dropdownBorder);",
            }, options.map((o) => h("option", { value: o }, o)));
            select.value = this.attr("value", options[0]);
            return select;
          })()))];
    } else {
      body = [description, h("div.setting-item-modified-indicator"),
        h("div.setting-item-value", null, h("div.setting-item-control", null,
          h("vsc-input", { variant: "settings", type: type === "number" ? "number" : "text", label: key, value: this.attr("value", "") })))];
    }
    const contents = h("div.setting-item-contents.settings-row-inner-container", { "data-key": key },
      title, body,
      h("div.setting-item-deprecation-message", null, h("div.codicon.codicon-error", { role: "img", "aria-label": "Warning" })),
      h("div.setting-toolbar-container", null,
        h("div.monaco-toolbar", null,
          h("div.monaco-action-bar.has-overflow", null,
            h("ul.actions-container", { role: "toolbar" },
              h("vsc-action", { icon: "settings-more-action", label: "More Actions...  (Shift+F9)", dropdown: "", focusable: "false" }))))));
    return h("div.monaco-tl-row", null,
      h("div.monaco-tl-indent", { style: "width: 8px;" }),
      h("div.monaco-tl-twistie", { style: "padding-left: 16px;" }),
      h("div.monaco-tl-contents.setting-item.setting-item-" + type, null, contents));
  }
  updated() {
    // Like the settings list: each row's height (and line-height) is its measured content height.
    requestAnimationFrame(() => {
      const row = this.firstElementChild;
      if (!row) return;
      const height = Math.round(row.querySelector(".monaco-tl-contents").getBoundingClientRect().height);
      this.style.height = height + "px";
      this.style.lineHeight = height + "px";
    });
  }
}
ds.define("vsc-setting", Setting);
