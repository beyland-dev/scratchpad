class Watermark extends ds.Element {
  static hostClass = "editor-group-watermark-wrapper";
  render() {
    const h = ds.h;
    return [
      h("div.editor-group-watermark-toolbar-container.has-no-actions", null,
        h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container.highlight-toggled", { role: "toolbar" })))),
      h("div.editor-group-watermark", null,
        h("div.watermark-container", null,
          h("div.letterpress"),
          h("div.shortcuts", null,
            h("div.watermark-box", null,
              h("div.monaco-action-bar.vertical", null,
                h("ul.actions-container", { role: "toolbar", "aria-label": "Editor Shortcuts" }, this.slotted(""))))))),
    ];
  }
}
ds.define("vsc-watermark", Watermark);
