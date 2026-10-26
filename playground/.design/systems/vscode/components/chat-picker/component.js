class ChatPicker extends ds.Element {
  static hostClass = "action-item chat-input-picker-item";
  static props = ["kind", "icon", "label", "disabled"];
  render() {
    const kind = this.attr("kind", "");
    this.setClasses({ "chat-mode-picker-item": kind === "mode", "chat-session-target-picker-item": kind === "target" });
    this.setAttribute("role", "presentation");
    const label = this.attr("label", this.textContent.trim());
    const icon = this.attr("icon");
    return ds.h("div.monaco-dropdown", null,
      ds.h("div.dropdown-label", null,
        ds.h("a.action-label" + (this.flag("disabled") ? ".disabled" : ""), {
          role: "button", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": label, tabindex: "0",
          "aria-disabled": this.hasAttribute("disabled") ? String(this.flag("disabled")) : undefined,
        },
          icon ? ds.icon(icon) : null,
          ds.h("span.chat-input-picker-label", null, label))));
  }
}
ds.define("vsc-chat-picker", ChatPicker);
