class Menu extends ds.Element {
  static hostClass = "context-view monaco-component monaco-menu-container bottom left";
  static props = ["x", "y", "label"];
  render() {
    const h = ds.h;
    this.setAttribute("role", "presentation");
    this.style.position = "absolute";
    this.style.zIndex = "2575";
    this.style.width = "initial";
    if (this.hasAttribute("x")) this.style.left = this.attr("x") + "px";
    if (this.hasAttribute("y")) this.style.top = this.attr("y") + "px";
    const items = this.slotted("").filter((n) => n.nodeType === 1);
    const entries = items.filter((n) => n.localName !== "vsc-menu-separator");
    entries.forEach((item, i) => {
      item.setAttribute("data-posinset", String(i + 1));
      item.setAttribute("data-setsize", String(entries.length));
      item.setAttribute("tabindex", i === 0 ? "0" : "-1");
    });
    return [
      h("div.context-view-block", { style: "position: fixed; cursor: initial; left: 0px; top: 0px; width: 100%; height: 100%; z-index: -1;" }),
      h("div.monaco-scrollable-element", { role: "presentation", style: "overflow: hidden; border-radius: var(--vscode-cornerRadius-large); color: var(--vscode-menu-foreground); background-color: var(--vscode-menu-background);" },
        h("div.monaco-menu", { role: "presentation", style: "overflow: hidden; max-height: 865px;" },
          h("div.monaco-action-bar.vertical", null,
            h("ul.actions-container", { role: "menu", tabindex: "0", "aria-label": this.attr("label") }, items))),
        h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: calc(100% - 9px); height: 0px; left: 0px; bottom: 0px;" },
          h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;" })),
        h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 7px; height: calc(100% - 2px); right: 0px; top: 0px;" },
          h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 7px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 100%;" })),
        h("div.shadow"), h("div.shadow"), h("div.shadow")),
    ];
  }
}
ds.define("vsc-menu", Menu);
