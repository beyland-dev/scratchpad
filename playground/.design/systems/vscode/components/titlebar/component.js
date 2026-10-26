class Titlebar extends ds.Element {
  static hostClass = "part titlebar";
  static props = ["label", "can-go-back", "can-go-forward", "no-layout-controls"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "ws");
    this.setAttribute("role", "none");
    this.style.backgroundColor = "var(--vscode-titleBar-activeBackground)";
    this.style.color = "var(--vscode-titleBar-activeForeground)";
    this.style.setProperty("--zoom-factor", "1");
    this.style.height = "35px";
    const nav = (icon, label, enabled, focusable) => h("li.action-item.menu-entry" + (enabled ? "" : ".disabled"), { role: "presentation" },
      h("a.action-label.codicon.codicon-" + icon + (enabled ? "" : ".disabled"), { role: "button", "aria-label": label, "aria-disabled": enabled ? undefined : "true", tabindex: focusable ? "0" : "-1" }));
    const toolbar = (cls, items, label) => h("div." + cls + (items.length ? "" : ".has-no-actions"), null,
      h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": label }, items))));
    let actions = this.slotted("actions");
    if (!actions.length && !this.flag("no-layout-controls")) actions = [
      h("vsc-action", { menu: "", icon: "configure-layout-icon", label: "Customize Layout..." }),
      h("vsc-action", { menu: "", icon: "panel-left", label: "Toggle Primary Side Bar (Ctrl+B)", checked: "", focusable: "false" }),
      h("vsc-action", { menu: "", icon: "panel-layout-icon-off", label: "Toggle Panel (Ctrl+J)", focusable: "false" }),
      h("vsc-action", { menu: "", icon: "auxiliarybar-right-layout-icon", label: "Toggle Secondary Side Bar (Ctrl+Alt+B)", checked: "", focusable: "false" }),
    ];
    return h("div.titlebar-container.has-center", null,
      h("div.titlebar-drag-region"),
      h("div.titlebar-left", null, h("a.window-appicon"), h("div.window-controls-container")),
      h("div.titlebar-center", null,
        h("div.window-title", null,
          h("div.command-center", null,
            h("div.monaco-toolbar", null,
              h("div.monaco-action-bar", null,
                h("ul.actions-container", { role: "toolbar" },
                  nav("arrow-left", "Go Back (Ctrl+Alt+-)", this.attr("can-go-back", "true") !== "false", true),
                  nav("arrow-right", "Go Forward (Ctrl+Shift+-)", this.flag("can-go-forward"), false),
                  h("li.action-item.command-center-center", { role: "presentation", tabindex: "-1" },
                    h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" },
                      h("li.action-item.command-center-quick-pick.compact-mode", { role: "button", tabindex: "0", "aria-description": "Search " + label },
                        h("span.search-label", null, label)))))),
                  h("li.action-item.agent-status-container", { role: "toolbar", "aria-label": "Agent Status", tabindex: "-1" },
                    h("div.agent-status-pill.chat-input-mode.compact-mode", null,
                      h("div.agent-status-input-area", { role: "button", "aria-label": "Open Quick Access", tabindex: "0" }, h("span.agent-status-label", null, label)),
                      h("span.agent-status-badge-section.sparkle.monaco-dropdown-with-primary", { tabindex: "-1" },
                        h("div.action-container.menu-entry", { role: "button", "aria-disabled": "false" },
                          h("a.action-label.codicon.codicon-chat-sparkle", { role: "button", "aria-label": "Toggle Chat" })),
                        h("div.dropdown-action-container", null, h("div.monaco-dropdown", null, h("div.dropdown-label", null,
                          h("a.action-label.codicon.codicon-chevron-down.agent-status-sparkle-dropdown", { role: "button", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": "More Actions", "aria-disabled": "false" }))))))))))))),
      h("div.titlebar-right", null,
        toolbar("center-adjacent-toolbar-container", []),
        toolbar("update-toolbar-container", []),
        toolbar("action-toolbar-container", actions, "Title actions"),
        h("div.window-controls-container")));
  }
}
ds.define("vsc-titlebar", Titlebar);
