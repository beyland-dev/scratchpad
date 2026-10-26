class Action extends ds.Element {
  static hostClass = "action-item";
  static props = ["icon", "label", "disabled", "checked", "dropdown", "menu", "focusable"];
  render() {
    const disabled = this.flag("disabled");
    const checked = this.flag("checked");
    this.setAttribute("role", "presentation");
    this.setClasses({ disabled, "menu-entry": this.flag("menu") });
    const icon = this.attr("icon");
    const label = this.attr("label", "");
    const text = this.slotted("");
    const anchor = ds.h("a.action-label" + (icon ? ".codicon.codicon-" + icon : "") + (disabled ? ".disabled" : "") + (checked ? ".checked" : ""), {
      role: "button",
      "aria-label": label || undefined,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-pressed": this.hasAttribute("checked") ? String(checked) : undefined,
      "aria-haspopup": this.flag("dropdown") ? "true" : undefined,
      "aria-expanded": this.flag("dropdown") ? "false" : undefined,
      tabindex: this.attr("focusable", "true") === "false" ? "-1" : "0",
    }, text);
    return this.flag("dropdown") ? ds.h("div.monaco-dropdown", null, ds.h("div.dropdown-label", null, anchor)) : anchor;
  }
}
ds.define("vsc-action", Action);
