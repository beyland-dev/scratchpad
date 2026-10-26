class Toolbar extends ds.Element {
  static hostClass = "monaco-toolbar";
  static props = ["vertical", "label"];
  render() {
    return ds.h("div.monaco-action-bar" + (this.flag("vertical") ? ".vertical" : ""), null,
      ds.h("ul.actions-container", { role: "toolbar", "aria-label": this.attr("label") }, this.slotted("")));
  }
}
ds.define("vsc-toolbar", Toolbar);
