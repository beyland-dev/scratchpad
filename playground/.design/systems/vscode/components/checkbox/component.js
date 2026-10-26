class Checkbox extends ds.Element {
  static hostClass = "monaco-custom-toggle codicon codicon-check";
  static props = ["checked", "disabled", "label", "variant"];
  constructor() {
    super();
    this.addEventListener("click", () => { if (!this.flag("disabled")) this.toggleAttribute("checked"); });
  }
  render() {
    const checked = this.flag("checked");
    const settings = this.attr("variant", "") === "settings";
    this.setClasses({ checked, disabled: this.flag("disabled"), "setting-value-checkbox": settings, "monaco-checkbox": !settings });
    this.setAttribute("role", "checkbox");
    this.setAttribute("tabindex", settings ? "-1" : "0");
    this.setAttribute("aria-checked", String(checked));
    this.setAttribute("aria-disabled", String(this.flag("disabled")));
    if (this.hasAttribute("label")) this.setAttribute("aria-label", this.attr("label"));
    this.style.color = "inherit";
    return [];
  }
}
ds.define("vsc-checkbox", Checkbox);
