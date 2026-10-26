class Editor extends ds.Element {
  static hostClass = "part editor editor-tabs-multiple floating-editor-outer-top floating-editor-outer-bottom";
  static props = ["empty"];
  render() {
    const children = this.slotted("");
    const empty = this.flag("empty") || children.some((n) => n.nodeType === 1 && n.localName === "vsc-watermark");
    this.setAttribute("role", "main");
    return ds.h("div.content", { style: "overflow: hidden; background-color: var(--vscode-editor-background); height: 100%;" },
      ds.h("div.grid-view-container", null,
        ds.h("div.monaco-grid-view", null,
          ds.h("div.monaco-grid-branch-node", null,
            ds.h("div.monaco-split-view2.vertical.separator-border", { style: "--separator-border: var(--vscode-editorGroup-border);" },
              ds.h("div.sash-container"),
              ds.h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden; height: 100%;" },
                ds.h("div.split-view-container", { style: "overflow: hidden; height: 100%;" },
                  ds.h("div.split-view-view.visible", { style: "top: 0px; height: 100%;" },
                    ds.h("div.editor-group-container.active" + (empty ? ".empty" : ""), null, children)))))))));
  }
}
ds.define("vsc-editor", Editor);
