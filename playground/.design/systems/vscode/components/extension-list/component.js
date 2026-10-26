class ExtensionList extends ds.Element {
  static hostClass = "extensions-list";
  render() {
    const h = ds.h;
    const rows = this.slotted("").filter((n) => n.nodeType === 1);
    rows.forEach((row, i) => {
      row.style.top = i * 72 + "px";
      row.setAttribute("data-index", String(i));
      row.setAttribute("aria-posinset", String(i + 1));
      row.setAttribute("aria-setsize", String(rows.length));
    });
    return h("div.monaco-list.list_id_27.mouse-support.selection-none", { tabindex: "0", role: "list", "aria-label": "Extensions" },
      h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
        h("div.monaco-list-rows", { style: "transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; height: " + rows.length * 72 + "px; left: 0px; top: 0px;" }, rows),
        h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;" },
          h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; contain: strict; width: 0px;" })),
        h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 8px; height: 100%; right: 0px; top: 0px;" },
          h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; contain: strict; height: 100%;" })),
        h("div.shadow"), h("div.shadow"), h("div.shadow")));
  }
}
ds.define("vsc-extension-list", ExtensionList);
