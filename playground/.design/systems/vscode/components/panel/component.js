class Panel extends ds.Element {
  static hostClass = "part panel basepanel bottom pane-composite-part floating-part-outer-bottom";
  static props = ["tabs", "active"];
  render() {
    const h = ds.h;
    const tabs = this.attr("tabs", "Problems,Output,Debug Console,Terminal").split(",").map((t) => t.trim()).filter(Boolean);
    const active = this.attr("active", tabs[tabs.length - 1]);
    this.setAttribute("role", "none");
    this.style.backgroundColor = "var(--vscode-panel-background)";
    this.style.borderLeftColor = "var(--vscode-panel-border)";
    this.style.borderRightColor = "var(--vscode-panel-border)";
    this.style.borderBottomColor = "var(--vscode-panel-border)";
    const actions = this.slotted("actions");
    const tabItems = tabs.map((t, i) => {
      const on = t === active;
      return h("li.action-item" + (on ? ".checked" : ""), {
        role: "tab", draggable: "true", "aria-label": "", "aria-expanded": String(on), "aria-selected": String(on), tabindex: i === 0 ? "0" : "-1",
        style: "--insert-border-color: var(--vscode-panel-dropBorder);",
      },
        h("a.action-label", { "aria-label": t, style: on ? "color: var(--vscode-panelTitle-activeForeground); border-bottom-color: var(--vscode-panelTitle-activeBorder);" : "color: var(--vscode-panelTitle-inactiveForeground);" }, t),
        h("div.badge", { "aria-hidden": "true", style: "display: none;" },
          h("div.badge-content", { style: "color: var(--vscode-activityBarBadge-foreground); background-color: var(--vscode-activityBarBadge-background);" })),
        h("div.active-item-indicator"));
    });
    return [
      h("div.composite.title.has-composite-bar.has-actions", { style: "border-top-color: var(--vscode-panel-border);" },
        h("div.composite-bar-container", null,
          h("div.composite-bar", null,
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "tablist", "aria-label": "Active View Switcher" }, tabItems)))),
        h("div.title-label", null, h("h2", { draggable: "true" }, active)),
        h("div.title-actions", null,
          h("div.monaco-toolbar", null,
            h("div.monaco-action-bar" + (actions.length ? ".has-overflow" : ""), null, h("ul.actions-container", { role: "toolbar", "aria-label": active + " actions" }, actions)))),
        h("div.global-actions", null,
          h("div.monaco-toolbar", null,
            h("div.monaco-action-bar", null,
              h("ul.actions-container.highlight-toggled", { role: "toolbar" },
                h("vsc-action", { menu: "", icon: "panel-maximize", label: "Maximize Panel" }),
                h("vsc-action", { menu: "", icon: "panel-close", label: "Hide Panel (Ctrl+J)", focusable: "false" })))))),
      h("div.content", { style: "height: calc(100% - 32px);" },
        h("div.composite.panel", { style: "height: 100%;" },
          h("div.monaco-pane-view", { style: "height: 100%;" },
            h("div.monaco-split-view2.horizontal", { style: "height: 100%;" },
              h("div.sash-container"),
              h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden; height: 100%;" },
                h("div.split-view-container", { style: "overflow: hidden; height: 100%;" },
                  h("div.split-view-view.visible", { style: "left: 0px; width: 100%; height: 100%;" },
                    h("div.pane.expanded.horizontal.merged-header", { style: "border-left: 1px solid var(--vscode-panelSection-border); height: 100%;" },
                      h("div.pane-body", { style: "height: 100%;" }, this.slotted(""))))),
                h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 100%; height: 8px; left: 0px; bottom: 0px;" },
                  h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;" })),
                h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 0px; right: 0px; top: 0px;" },
                  h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 0px;" })),
                h("div.shadow"), h("div.shadow"), h("div.shadow")))))),
    ];
  }
}
ds.define("vsc-panel", Panel);
