class Icon extends ds.Element {
  static hostClass = "codicon";
  static props = ["name", "spin"];
  render() {
    for (const c of [...this.classList]) if (c.startsWith("codicon-") && c !== "codicon-modifier-spin") this.classList.remove(c);
    this.classList.add("codicon-" + this.attr("name", "blank"));
    this.setClasses({ "codicon-modifier-spin": this.flag("spin") });
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-hidden", "true");
    return [];
  }
}
ds.define("vsc-icon", Icon);
