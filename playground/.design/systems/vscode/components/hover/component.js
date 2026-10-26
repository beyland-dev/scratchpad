class Hover extends ds.Element {
  static hostClass = "monaco-hover fade-in workbench-hover compact with-pointer";
  static props = ["text"];
  render() {
    const h = ds.h;
    this.setAttribute("tabindex", "0");
    this.setAttribute("role", "tooltip");
    this.style.maxHeight = "450px";
    const content = this.hasAttribute("text") ? [this.attr("text")] : this.slotted("");
    return h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
      h("div.monaco-hover-content", { style: "overflow: hidden; max-height: 448px;" },
        h("div.hover-row.markdown-hover", null, h("div.hover-contents", { style: "white-space: pre-wrap;" }, content))),
      h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: calc(100% - 10px); height: 8px; left: 0px; bottom: 0px;" },
        h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;" })),
      h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 8px; height: 100%; right: 0px; top: 0px;" },
        h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 100%;" })),
      h("div.shadow"), h("div.shadow"), h("div.shadow"));
  }
}
ds.define("vsc-hover", Hover);
