class WatermarkEntry extends ds.Element {
  static hostClass = "action-item";
  static props = ["icon", "label", "keys"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "");
    const keys = this.attr("keys", "");
    this.setAttribute("role", "presentation");
    const first = !this.previousElementSibling;
    return h("a.action-label.watermark-entry", { role: "button", "aria-label": label + (keys ? " (" + keys.replace(/Ctrl/g, "Control") + ")" : ""), tabindex: first ? "0" : "-1" },
      h("span.codicon.watermark-icon", { class: "codicon-" + this.attr("icon", "blank"), "aria-hidden": "true" }),
      h("span.watermark-label", null, label),
      h("span.watermark-keybinding", null, keys ? h("vsc-keybinding", { keys }) : null));
  }
}
ds.define("vsc-watermark-entry", WatermarkEntry);
