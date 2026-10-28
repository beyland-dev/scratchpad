// One notification toast. Mirrors NotificationsToasts.addToast + NotificationRenderer.renderTemplate/NotificationTemplateRenderer
// (src/vs/workbench/browser/parts/notifications/notificationsToasts.ts, notificationsViewer.ts).
// Events (bubbling): "action" { label, index } when a button is clicked (the toast then closes), "close" when it is dismissed.
const NOTIFICATION_ROW_HEIGHT = 34; // COMPACT_NOTIFICATION_ROW_HEIGHT (modern UI)
const NOTIFICATION_LINE_HEIGHT = 22;
const NOTIFICATION_PURGE_TIMEOUT = { info: 10000, warning: 12000, error: 15000 };
// Compact variant (design-tool addition, not in VS Code): short-lived single-row confirmations.
const NOTIFICATION_COMPACT_TIMEOUT = 5000;
const NOTIFICATION_IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

class Notification extends ds.Element {
  static hostClass = "notification-toast-container";
  static props = ["severity", "message", "buttons", "source", "expanded", "configure", "sticky", "compact", "timeout"];

  buttons() {
    return this.attr("buttons", "").split(",").map((b) => b.trim()).filter(Boolean);
  }

  close(reason) {
    if (!this.isConnected) return;
    clearTimeout(this.__purge);
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, detail: { reason: reason || "close" } }));
    this.remove();
  }

  schedulePurge() {
    clearTimeout(this.__purge);
    if (this.flag("sticky") || this.__hovered) return;
    const severity = this.attr("severity", "info");
    const timeout = Number(this.attr("timeout", "")) || (this.flag("compact") ? NOTIFICATION_COMPACT_TIMEOUT : NOTIFICATION_PURGE_TIMEOUT[severity] || 10000);
    this.__purge = setTimeout(() => this.close("timeout"), timeout);
  }

  render() {
    const h = ds.h;
    const severity = ["info", "warning", "error"].includes(this.attr("severity")) ? this.attr("severity") : "info";
    const buttons = this.buttons();
    const source = this.attr("source", "");
    const rich = this.slotted("").map((n) => n.cloneNode(true));
    const message = this.attr("message", this.slotted("").map((n) => n.textContent).join("").trim());
    // Compact: one row, buttons inline after the message, no toolbar (no ✕), shorter auto-dismiss.
    const compact = this.flag("compact");
    // Notifications with buttons can't collapse; otherwise the expanded attribute decides.
    const canCollapse = !compact && !buttons.length;
    const expanded = !compact && (!canCollapse || this.flag("expanded"));
    const label = `${severity[0].toUpperCase()}${severity.slice(1)}: ${message}${source ? ", source: " + source : ""}, notification`;

    if (!this.__wired) {
      this.__wired = true;
      this.addEventListener("mouseenter", () => { this.__hovered = true; clearTimeout(this.__purge); });
      this.addEventListener("mouseleave", () => { this.__hovered = false; this.schedulePurge(); });
      this.addEventListener("focusin", () => { this.__hovered = true; clearTimeout(this.__purge); });
      this.addEventListener("focusout", () => { this.__hovered = false; this.schedulePurge(); });
      this.addEventListener("keydown", (e) => {
        if ((e.key === "Backspace" && (NOTIFICATION_IS_MAC ? e.metaKey : e.ctrlKey)) || e.key === "Delete") { e.preventDefault(); this.close("clear"); }
        else if (canCollapse && e.key === "ArrowRight" && this.hasAttribute("source")) this.setAttribute("expanded", "");
        else if (canCollapse && e.key === "ArrowLeft") this.removeAttribute("expanded");
      });
      this.schedulePurge();
    }

    const actions = [];
    const action = (cls, aria, onclick, dropdown) => {
      const a = h("a.action-label.codicon.codicon-" + cls, {
        role: "button", "aria-label": aria, tabindex: actions.length ? "-1" : "0",
        "aria-haspopup": dropdown ? "true" : undefined, "aria-expanded": dropdown ? "false" : undefined, "aria-disabled": dropdown ? "false" : undefined,
        onclick: (e) => { e.stopPropagation(); onclick && onclick(); },
      });
      actions.push(h("li.action-item", { role: "presentation" }, dropdown ? h("div.monaco-dropdown", null, h("div.dropdown-label", null, a)) : a));
    };
    if (this.flag("configure")) action("notifications-configure", "More Actions...", null, true);
    if (canCollapse && (expanded || source)) {
      if (expanded) action("notifications-collapse", "Collapse Notification (\u2190)", () => this.removeAttribute("expanded"));
      else action("notifications-expand", "Expand Notification (\u2192)", () => this.setAttribute("expanded", ""));
    }
    if (!compact) action("notifications-clear", `Clear Notification (${NOTIFICATION_IS_MAC ? "\u2318Backspace" : "Ctrl+Backspace"})`, () => this.close("clear"));
    this.__actionCount = actions.length;

    const buttonEls = expanded || compact ? buttons.map((text, index) => h("a.monaco-button" + (index ? ".secondary" : "") + ".monaco-text-button", {
      tabindex: "0", role: "button", "aria-disabled": "false",
      style: index
        ? "color: var(--vscode-button-secondaryForeground); background-color: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-button-secondaryBorder);"
        : "color: var(--vscode-button-foreground); background-color: var(--vscode-button-background); border: 1px solid var(--vscode-button-border);",
      onclick: (e) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent("action", { bubbles: true, detail: { label: text, index } })); this.close("action"); },
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } },
    }, text)) : [];

    const rowHeight = this.__rowHeight || NOTIFICATION_ROW_HEIGHT;
    const item = h("div.notification-list-item" + (expanded ? ".expanded" : "") + (compact ? ".compact" : ""), null,
      h("div.notification-list-item-details-row", null,
        h("div.notification-list-item-source", null, expanded && source ? `Source: ${source}` : ""),
        h("div.notification-list-item-buttons-container", null, compact ? [] : buttonEls)),
      h("div.notification-list-item-main-row", null,
        h("div.notification-list-item-icon.codicon.codicon-" + severity),
        h("div.notification-list-item-message", null, rich.length && !this.hasAttribute("message") ? rich : h("span", null, message)),
        compact
          ? (buttonEls.length ? h("div.notification-list-item-buttons-container", null, buttonEls) : null)
          : h("div.notification-list-item-toolbar-container", null,
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Notification Actions" }, actions)))));

    const animate = !this.flag("no-animation") && !this.__shown;
    const toast = h("div.notification-toast" + (animate ? "" : ".notification-fade-in-done"), {
      style: "background: var(--vscode-notifications-background); border: 1px solid var(--vscode-notificationToast-border, var(--vscode-widget-border));",
    },
      h("div.notifications-list-container", { style: "width: 450px;" },
        h("div.notification-offset-helper"),
        h("div.monaco-list.list_id_7.mouse-support.selection-none", { tabindex: "0", role: "list", "aria-label": label, "aria-multiselectable": "true" },
          h("div.monaco-scrollable-element.mac", { role: "presentation", style: "position: relative; overflow: hidden;" },
            h("div.monaco-list-rows", { style: `transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; height: ${rowHeight}px; left: 0px; top: 0px;` },
              h("div.monaco-list-row", { role: "dialog", "data-index": "0", "data-last-element": "true", "data-parity": "even", "aria-setsize": "1", "aria-posinset": "1", "aria-selected": "false", "aria-label": label, draggable: "false", style: `top: 0px; height: ${rowHeight}px;` },
                item,
                h("div.monaco-progress-container.done", { role: "progressbar", "aria-valuemin": "0", "aria-label": "Progress", "aria-hidden": "true", style: "display: none;" },
                  h("div.progress-bit", { style: "background-color: var(--vscode-progressBar-background); width: inherit; opacity: 1;" })))),
            h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;" },
              h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;" })),
            h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: `position: absolute; width: 0px; height: ${rowHeight}px; right: 0px; top: 0px;` },
              h("div.slider", { style: `position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: ${rowHeight}px;` })),
            h("div.shadow"), h("div.shadow"), h("div.shadow")))));
    this.__expanded = expanded;
    this.__hasDetails = !!(source || buttons.length);
    this.__message = message;
    if (animate) {
      this.__shown = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.classList.add("notification-fade-in");
        setTimeout(() => { toast.classList.remove("notification-fade-in"); toast.classList.add("notification-fade-in-done"); }, 300);
      }));
    }
    return toast;
  }

  /** NotificationsListDelegate.getHeight: compact row, plus wrapped message lines and the details row while expanded. */
  updated() {
    let height = NOTIFICATION_ROW_HEIGHT;
    if (this.__expanded) {
      const helper = this.querySelector(".notification-offset-helper");
      if (helper) {
        const actions = this.__actionCount || 1;
        helper.style.width = `${450 - (10 + 30 + actions * 30 - Math.max(actions - 1, 0) * 4)}px`;
        helper.textContent = this.__message;
        const preferred = helper.offsetHeight;
        helper.textContent = "";
        if (preferred > NOTIFICATION_LINE_HEIGHT) height += preferred - NOTIFICATION_LINE_HEIGHT;
      }
      if (this.__hasDetails) height += NOTIFICATION_ROW_HEIGHT;
    }
    if (height !== (this.__rowHeight || NOTIFICATION_ROW_HEIGHT)) {
      this.__rowHeight = height;
      for (const el of this.querySelectorAll(".monaco-list-rows, .monaco-list-row, .scrollbar.vertical, .scrollbar.vertical > .slider")) el.style.height = height + "px";
    }
  }
}
ds.define("vsc-notification", Notification);
