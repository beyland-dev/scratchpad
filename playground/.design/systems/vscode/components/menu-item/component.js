class MenuItem extends ds.Element {
  static hostClass = "action-item";
  static props = ["label", "keys", "checked", "disabled", "submenu", "focused", "data-posinset", "data-setsize"];
  render() {
    const h = ds.h;
    const label = this.attr("label", "");
    const disabled = this.flag("disabled");
    const checked = this.flag("checked");
    const submenu = this.flag("submenu");
    this.setClasses({ disabled, focused: this.flag("focused") });
    this.setAttribute("role", "presentation");
    const keys = this.attr("keys", "");
    return h("a.action-menu-item" + (checked ? ".checked" : "") + (disabled ? ".disabled" : ""), {
      role: checked || this.hasAttribute("checked") ? "menuitemcheckbox" : "menuitem",
      tabindex: "0",
      "aria-checked": this.hasAttribute("checked") ? String(checked) : "",
      "aria-disabled": disabled ? "true" : undefined,
      "aria-haspopup": submenu ? "true" : undefined,
      "aria-posinset": this.attr("data-posinset"),
      "aria-setsize": this.attr("data-setsize"),
      style: "color: var(--vscode-menu-foreground);",
    },
      h("span.menu-item-check.codicon.codicon-menu-selection", { role: "none", style: "color: var(--vscode-menu-foreground);" }),
      h("span.action-label" + (disabled ? ".disabled" : ""), { "aria-label": label }, label),
      submenu
        ? h("span.submenu-indicator.codicon.codicon-menu-submenu", { "aria-hidden": "true" })
        : h("span.keybinding", keys ? null : { hidden: "" }, keys || null));
  }
}
ds.define("vsc-menu-item", MenuItem);
