class Sidebar extends ds.Element {
  static hostClass = "part pane-composite-part floating-part-outer-top floating-part-outer-bottom";
  static props = ["heading", "position", "viewlet"];
  render() {
    // position="right": the secondary side bar (auxiliary bar), e.g. for the chat view.
    const right = this.attr("position", "left") === "right";
    this.setClasses({
      sidebar: !right, left: !right,
      auxiliarybar: right, basepanel: right, right, "floating-part-outer-right": right,
    });
    this.style.backgroundColor = "var(--vscode-sideBar-background)";
    this.style.color = "var(--vscode-sideBar-foreground)";
    this.style.borderRight = right ? "" : "1px solid var(--vscode-sideBar-border, var(--vscode-contrastBorder))";
    this.style.borderLeft = right ? "1px solid var(--vscode-sideBar-border, var(--vscode-contrastBorder))" : "";
    this.style.outlineColor = "var(--vscode-sideBar-dropBackground)";
    const heading = this.attr("heading", "");
    const actions = this.slotted("actions");
    const title = heading
      ? ds.h("div.composite.title" + (actions.length ? ".has-actions" : ""), null,
          ds.h("div.title-label", null, ds.h("h2", { draggable: "true", style: "color: var(--vscode-sideBarTitle-foreground);" }, heading)),
          ds.h("div.title-actions", null,
            ds.h("div.monaco-toolbar", null,
              ds.h("div.monaco-action-bar" + (actions.length ? ".has-overflow" : ""), null,
                ds.h("ul.actions-container", { role: "toolbar", "aria-label": heading + " actions" }, actions)))),
          ds.h("div.global-actions.has-no-actions", null,
            ds.h("div.monaco-toolbar", null,
              ds.h("div.monaco-action-bar", null, ds.h("ul.actions-container.highlight-toggled", { role: "toolbar" })))))
      : null;
    const panes = this.slotted("").filter((n) => n.nodeType === 1 && n.localName === "vsc-pane");
    if (panes.length) {
      // Several collapsible sections (<vsc-pane>) stacked in the view's pane view.
      return [
        title,
        ds.h("div.content", { style: "width: calc(100% - 1px); height: calc(100% - 33px);" },
          ds.h("div.composite.viewlet", { style: "height: 100%;" },
            ds.h("div.monaco-pane-view", { style: "height: 100%;" },
              ds.h("div.monaco-split-view2.vertical", { style: "height: 100%;" },
                ds.h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden; height: 100%;" },
                  ds.h("div.split-view-container", { style: "overflow: hidden; height: 100%; display: flex; flex-direction: column;" }, panes)))))),
      ];
    }
    return [
      title,
      // Like AbstractPaneCompositePart.layout(): the grid size minus the floating card's margins
      // and borders leaves the content 1px narrower than the part's content box.
      ds.h("div.content", { style: "width: calc(100% - 1px);" },
        ds.h("div.composite.viewlet", { class: this.attr("viewlet") }, (() => {
          const paneView = ds.h("div.monaco-pane-view", null,
            ds.h("div.pane.expanded.vertical.merged-header", null,
              ds.h("div.pane-body", null, this.slotted(""))));
          // The Extensions view nests its panes in ".extensions" (styles target ".extensions-viewlet > .extensions").
          return this.attr("viewlet") === "extensions-viewlet" ? ds.h("div.extensions", null, paneView) : paneView;
        })())),
    ];
  }
}
ds.define("vsc-sidebar", Sidebar);
