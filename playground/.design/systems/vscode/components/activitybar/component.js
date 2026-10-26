class Activitybar extends ds.Element {
  static hostClass = "part activitybar left";
  render() {
    const h = ds.h;
    this.setAttribute("role", "none");
    this.style.cssText += "--activity-bar-width: 36px; --activity-bar-action-height: 36px; --activity-bar-action-gap: 8px; --activity-bar-icon-size: 24px; background-color: var(--vscode-activityBar-background);";
    let items = this.slotted("");
    if (!items.length) items = [
      h("vsc-activity-item", { icon: "explorer-view-icon", label: "Explorer (Ctrl+Shift+E)", checked: "" }),
      h("vsc-activity-item", { icon: "search-view-icon", label: "Search (Ctrl+Shift+F)" }),
      h("vsc-activity-item", { icon: "source-control-view-icon", label: "Source Control (Ctrl+Shift+G)" }),
      h("vsc-activity-item", { icon: "run-view-icon", label: "Run and Debug (Ctrl+Shift+D)" }),
      h("vsc-activity-item", { icon: "extensions-view-icon", label: "Extensions (Ctrl+Shift+X)" }),
    ];
    let bottom = this.slotted("bottom");
    if (!bottom.length) bottom = [
      h("vsc-activity-item", { kind: "menu", icon: "accounts-view-bar-icon", label: "Accounts" }),
      h("vsc-activity-item", { kind: "menu", icon: "settings-view-bar-icon", label: "Manage" }),
    ];
    items.forEach((item, i) => item.setAttribute && item.setAttribute("tabindex", i === 0 ? "0" : "-1"));
    bottom.forEach((item, i) => item.setAttribute && item.setAttribute("tabindex", i === 0 ? "0" : "-1"));
    return h("div.content", { style: "width: 36px; height: 100%;" },
      h("div.menubar.compact.overflow-menu-only", { role: "menubar" },
        h("div.menubar-menu-button", { role: "menuitem", tabindex: "0", "aria-label": "Application Menu", "aria-haspopup": "true", style: "visibility: visible;" },
          h("div.menubar-menu-title.toolbar-toggle-more.codicon.codicon-menubar-more", { role: "none", "aria-hidden": "true" }))),
      h("div.composite-bar", null,
        h("div.monaco-action-bar.vertical", null, h("ul.actions-container", { role: "tablist", "aria-label": "Active View Switcher" }, items))),
      h("div", null,
        h("div.monaco-action-bar.vertical", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Manage" }, bottom))));
  }
}
ds.define("vsc-activitybar", Activitybar);
