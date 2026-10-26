class Button extends ds.Element {
  static hostClass = "monaco-button monaco-text-button";
  static props = ["icon", "secondary", "disabled"];
  constructor() {
    super();
    this.addEventListener("mouseover", () => this.paint(true));
    this.addEventListener("mouseout", () => this.paint(false));
  }
  paint(hover) {
    const secondary = this.flag("secondary");
    const p = secondary ? "--vscode-button-secondary" : "--vscode-button-";
    const bg = secondary ? (hover ? "HoverBackground" : "Background") : (hover ? "hoverBackground" : "background");
    const fg = secondary ? "Foreground" : "foreground";
    const border = secondary ? "Border" : "border";
    const disabled = this.flag("disabled");
    this.style.color = "var(" + p + fg + ")";
    this.style.backgroundColor = "var(" + p + (disabled ? (secondary ? "Background" : "background") : bg) + ")";
    this.style.border = "1px solid var(" + p + border + ")";
  }
  render() {
    const disabled = this.flag("disabled");
    this.setClasses({ secondary: this.flag("secondary"), disabled });
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", disabled ? "-1" : "0");
    this.setAttribute("aria-disabled", String(disabled));
    this.paint(false);
    const icon = this.attr("icon");
    return [icon ? ds.icon(icon) : null, ds.h("span", null, this.slotted(""))];
  }
}
ds.define("vsc-button", Button);
