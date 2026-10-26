class Pane extends ds.Element {
  static hostClass = "split-view-view visible";
  static props = ["heading", "icon", "expanded", "section"];
  render() {
    const h = ds.h;
    const expanded = this.flag("expanded");
    const heading = this.attr("heading", "");
    const section = this.attr("section", heading);
    const actions = this.slotted("actions");
    this.style.position = "relative";
    this.style.flex = expanded ? "1 1 auto" : "none";
    const header = h("div.pane-header" + (expanded ? ".expanded" : ""), {
      tabindex: "0", role: "button", "aria-label": section + " Section", "aria-expanded": String(expanded), draggable: "true",
      style: "color: var(--vscode-sideBarSectionHeader-foreground); background-color: var(--vscode-sideBarSectionHeader-background); border-top: 1px solid var(--vscode-sideBarSectionHeader-border);",
    },
      h("div.twisty-container.codicon.codicon-view-pane-container-" + (expanded ? "expanded" : "collapsed")),
      h("div.icon.codicon.codicon-" + this.attr("icon", "blank"), { "aria-label": heading, style: "color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));" }),
      h("h3.title", null, heading),
      h("div.actions", null,
        h("div.monaco-toolbar", null,
          h("div.monaco-action-bar" + (actions.some((a) => a.hasAttribute && a.hasAttribute("dropdown")) ? ".has-overflow" : ""), null,
            h("ul.actions-container", { role: "toolbar", "aria-label": heading + " actions" }, actions)))));
    header.addEventListener("click", (event) => {
      if (!event.target.closest(".actions")) this.toggleAttribute("expanded");
    });
    return h("div.pane.vertical" + (expanded ? ".expanded" : ""), { style: expanded ? "height: 100%;" : undefined },
      header,
      expanded ? h("div.pane-body", null, this.slotted("")) : null);
  }
}
ds.define("vsc-pane", Pane);
