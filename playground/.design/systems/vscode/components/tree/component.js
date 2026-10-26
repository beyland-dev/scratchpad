class Tree extends ds.Element {
  static hostClass = "explorer-folders-view file-icon-themable-tree show-file-icons align-icons-and-twisties";
  static props = ["label", "focused"];
  render() {
    const rows = this.slotted("").filter((n) => n.nodeType === 1);
    rows.forEach((row, i) => {
      row.style.top = i * 22 + "px";
      row.setAttribute("data-index", String(i));
      row.setAttribute("aria-posinset", String(i + 1));
      row.setAttribute("aria-setsize", String(rows.length));
    });
    const isOn = (row, name) => row.hasAttribute(name) && row.getAttribute(name) !== "false";
    const focused = rows.some((r) => isOn(r, "focused"));
    const selected = rows.filter((r) => isOn(r, "selected")).length;
    const state = (focused ? ".last-focused.element-focused" : "") +
      (selected === 0 ? ".selection-none" : selected === 1 ? ".selection-single" : ".selection-multiple");
    return ds.h("div.monaco-list.list_id_3.mouse-support" + state, {
      tabindex: "0", role: "tree", "aria-label": this.attr("label", "Files Explorer"),
    },
      ds.h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
        ds.h("div.monaco-list-rows", { style: "transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; height: " + rows.length * 22 + "px; left: 0px; top: 0px;" }, rows),
        ds.h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;" },
          ds.h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;" })),
        ds.h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 8px; height: 100%; right: 0px; top: 0px;" },
          ds.h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 100%;" })),
        ds.h("div.shadow"), ds.h("div.shadow"), ds.h("div.shadow"),
        ds.h("div.monaco-tree-sticky-container.empty", null, ds.h("div.monaco-tree-sticky-container-shadow"))));
  }
}
ds.define("vsc-tree", Tree);
