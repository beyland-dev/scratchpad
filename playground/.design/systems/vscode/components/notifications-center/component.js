class NotificationsCenter extends ds.Element {
  static hostClass = "notifications-center bottom-right visible";
  static props = ["heading"];
  render() {
    const h = ds.h;
    const items = this.slotted("").filter((n) => n.nodeType === 1);
    this.style.border = "1px solid var(--vscode-notificationCenter-border)";
    const act = (icon, label, opts = {}) => {
      const a = h("a.action-label.codicon.codicon-" + icon + (opts.disabled ? ".disabled" : ""), {
        role: "button", "aria-label": label, tabindex: opts.first ? "0" : "-1",
        "aria-disabled": opts.disabled ? "true" : opts.dropdown ? "false" : undefined,
        "aria-haspopup": opts.dropdown ? "true" : undefined, "aria-expanded": opts.dropdown ? "false" : undefined,
      });
      return h("li.action-item" + (opts.disabled ? ".disabled" : ""), { role: "presentation" },
        opts.dropdown ? h("div.monaco-dropdown", null, h("div.dropdown-label", null, a)) : a);
    };
    return [
      h("div.notifications-center-header", { style: "color: var(--vscode-notificationCenterHeader-foreground); background: var(--vscode-notificationCenterHeader-background);" },
        h("span.notifications-center-header-title", null, this.attr("heading", items.length ? "Notifications" : "No new notifications")),
        h("div.notifications-center-header-toolbar", null,
          h("div.monaco-action-bar", null,
            h("ul.actions-container", { role: "toolbar", "aria-label": "Notification Center Actions" },
              act("notifications-clear-all", "Clear All Notifications", { disabled: !items.length, first: true }),
              act("notifications-do-not-disturb", "Configure Do Not Disturb...", { dropdown: true }),
              act("notifications-position", "Configure Notifications Position...", { dropdown: true }),
              act("notifications-hide", "Hide Notifications (Escape)"))))),
      h("div.notifications-list-container", { style: "width: 450px;" },
        h("div.notification-offset-helper"),
        h("div.monaco-list.list_id_11.mouse-support.last-focused", { tabindex: "0", role: "list", "aria-label": "Notifications Center", style: "max-height: 400px;" },
          h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
            h("div.monaco-list-rows", { style: "transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict;" }, items),
            h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute;" },
              h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict;" })),
            h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute;" },
              h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict;" })),
            h("div.shadow"), h("div.shadow"), h("div.shadow")))),
    ];
  }
}
ds.define("vsc-notifications-center", NotificationsCenter);
