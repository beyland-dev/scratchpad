class MenuSeparator extends ds.Element {
  static hostClass = "action-item disabled";
  render() {
    this.setAttribute("role", "presentation");
    return ds.h("a.action-label.separator.disabled", {
      role: "presentation", "aria-label": "", "aria-disabled": "true", tabindex: "-1",
      style: "border-bottom-color: var(--vscode-menu-separatorBackground);",
    });
  }
}
ds.define("vsc-menu-separator", MenuSeparator);
