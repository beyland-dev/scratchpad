class Toggle extends ds.Element {
  static hostClass = "monaco-custom-toggle codicon";
  static props = ["icon", "checked", "disabled", "label"];
  constructor() {
    super();
    this.addEventListener("click", () => {
      if (!this.flag("disabled")) this.toggleAttribute("checked");
    });
  }
  render() {
    const checked = this.flag("checked");
    for (const c of [...this.classList]) if (c.startsWith("codicon-")) this.classList.remove(c);
    this.classList.add("codicon-" + this.attr("icon", "case-sensitive"));
    this.setClasses({ checked, disabled: this.flag("disabled") });
    this.setAttribute("role", "checkbox");
    this.setAttribute("tabindex", "0");
    this.setAttribute("aria-checked", String(checked));
    if (this.hasAttribute("label")) this.setAttribute("aria-label", this.attr("label"));
    this.style.color = checked ? "var(--vscode-inputOption-activeForeground)" : "inherit";
    this.style.backgroundColor = checked ? "var(--vscode-inputOption-activeBackground)" : "";
    if (checked) this.style.setProperty("--monaco-custom-toggle-border-color", "var(--vscode-inputOption-activeBorder)");
    else this.style.removeProperty("--monaco-custom-toggle-border-color");
    return [];
  }
}
ds.define("vsc-toggle", Toggle);
