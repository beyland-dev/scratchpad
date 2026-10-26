class ChatSubmit extends ds.Element {
  static hostClass = "action-item menu-entry chat-submit-button";
  static props = ["disabled", "label"];
  render() {
    const disabled = this.flag("disabled");
    this.setClasses({ disabled });
    this.setAttribute("role", "presentation");
    return ds.h("a.action-label.codicon.codicon-arrow-up-compact" + (disabled ? ".disabled" : ""), {
      role: "button",
      "aria-label": this.attr("label", "Send"),
      "aria-disabled": disabled ? "true" : undefined,
      tabindex: "0",
    });
  }
}
ds.define("vsc-chat-submit", ChatSubmit);
