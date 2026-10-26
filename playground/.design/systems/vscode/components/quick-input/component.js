class QuickInput extends ds.Element {
  static hostClass = "quick-input-widget show-file-icons";
  static props = ["placeholder", "value", "count", "position"];
  render() {
    const h = ds.h;
    const placeholder = this.attr("placeholder", "Type the name of a command to run.");
    const value = this.attr("value", "");
    const items = this.slotted("").filter((n) => n.nodeType === 1);
    this.setAttribute("tabindex", "-1");
    this.style.backgroundColor = "var(--vscode-quickInput-background)";
    this.style.color = "var(--vscode-quickInput-foreground)";
    this.style.border = "1px solid var(--vscode-widget-border)";
    this.style.width = "600px";
    if (this.attr("position", "top") !== "static") {
      this.style.top = "6px";
      this.style.left = "calc(50% - 301px)";
    } else this.style.position = "relative";
    items.forEach((item, i) => {
      item.style.top = i * 22 + "px";
      item.setAttribute("data-index", String(i));
      item.setAttribute("data-last-element", String(i === items.length - 1));
      item.setAttribute("data-parity", i % 2 ? "odd" : "even");
      item.setAttribute("aria-posinset", String(i + 1));
      item.setAttribute("aria-setsize", String(items.length));
    });
    const input = h("input.input" + (value ? "" : ".empty"), {
      autocorrect: "off", autocapitalize: "off", spellcheck: "false", type: "text", wrap: "off",
      "aria-label": placeholder, placeholder, style: "background-color: inherit; color: var(--vscode-input-foreground); width: calc(100% - 0px);",
    });
    input.value = value;
    const badge = (text) => h("div.monaco-count-badge", { style: "background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border: 1px solid var(--vscode-contrastBorder);" }, text);
    const scrollbar = (dir, style, slider) => h("div.invisible.scrollbar." + dir, { role: "presentation", "aria-hidden": "true", style }, h("div.slider", { style: slider }));
    const rowsHeight = items.length * 22;
    return [
      h("div.quick-input-titlebar", { style: "background-color: var(--vscode-quickInputTitle-background); display: none;" }),
      h("div.quick-input-header", null,
        h("div.quick-input-and-message", null,
          h("div.quick-input-filter", null,
            h("div.quick-input-box", null,
              h("div.monaco-findInput", null,
                h("div.monaco-inputbox.idle.synthetic-focus", { style: "background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent);" },
                  h("div.ibwrapper", null, input),
                  h("div.monaco-action-bar", null, h("ul.actions-container", { role: "presentation" }))),
                h("div.controls", { style: "display: none;" }))),
            h("div.quick-input-visible-count", { "aria-live": "polite", "aria-atomic": "true" }, badge(this.attr("count", items.length + " Results"))))),
      ),
      h("div.monaco-progress-container.quick-input-progress.done", { role: "progressbar", "aria-hidden": "true" },
        h("div.progress-bit", { style: "background-color: var(--vscode-progressBar-background); width: inherit; opacity: 1;" })),
      h("div.quick-input-html-widget", { tabindex: "-1" }),
      h("div.quick-input-list", null,
        h("div.monaco-list.list_id_5.mouse-support.selection-none" + (items.some((i) => i.hasAttribute("focused")) ? ".element-focused" : ""), {
          tabindex: "0", role: "listbox", "aria-label": placeholder, style: "max-height: 358px;",
        },
          h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
            h("div.monaco-list-rows", { style: "transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; height: " + rowsHeight + "px; left: 0px; top: 0px;" }, items),
            scrollbar("horizontal", "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;", "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;"),
            scrollbar("vertical", "position: absolute; width: 8px; height: " + Math.min(rowsHeight, 358) + "px; right: 0px; top: 0px;", "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: " + Math.min(rowsHeight, 358) + "px;"),
            h("div.shadow"), h("div.shadow"), h("div.shadow"),
            h("div.monaco-tree-sticky-container.empty", null, h("div.monaco-tree-sticky-container-shadow"))))),
    ];
  }
}
ds.define("vsc-quick-input", QuickInput);
