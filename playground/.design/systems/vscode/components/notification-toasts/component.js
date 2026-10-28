// Notification toast stack. Must be a direct child of <vsc-workbench> (the captured rules use `.monaco-workbench > .notifications-toasts`).
// toasts.show({ severity, message, buttons, source, sticky, compact, timeout }) adds a toast on top and keeps at most 3, like NotificationsToasts.
class NotificationToasts extends ds.Element {
  static hostClass = "notifications-toasts visible";
  static props = ["position", "static"];
  render() {
    const position = this.attr("position", "bottom-right");
    this.setClasses({ "bottom-right": position === "bottom-right", "bottom-left": position === "bottom-left", "top-right": position === "top-right" });
    if (this.flag("static")) Object.assign(this.style, { position: "relative", left: "auto", right: "auto", top: "auto", bottom: "auto", width: "max-content" });
    return undefined; // toasts are managed as plain children
  }
  show({ severity = "info", message = "", buttons = [], source = "", sticky = false, configure = false, compact = false, timeout } = {}) {
    const toast = document.createElement("vsc-notification");
    toast.setAttribute("severity", severity);
    toast.setAttribute("message", message);
    if (buttons.length) toast.setAttribute("buttons", [].concat(buttons).join(","));
    if (source) toast.setAttribute("source", source);
    if (sticky) toast.setAttribute("sticky", "");
    if (configure) toast.setAttribute("configure", "");
    if (compact) toast.setAttribute("compact", "");
    if (timeout) toast.setAttribute("timeout", String(timeout));
    this.prepend(toast);
    const toasts = [...this.children].filter((c) => c.localName === "vsc-notification");
    toasts.slice(3).forEach((t) => (t.close ? t.close("overflow") : t.remove()));
    return toast;
  }
  clear() {
    [...this.children].forEach((t) => (t.close ? t.close("clear") : t.remove()));
  }
}
ds.define("vsc-notification-toasts", NotificationToasts);
