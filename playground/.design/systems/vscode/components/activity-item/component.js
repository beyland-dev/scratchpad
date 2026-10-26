class ActivityItem extends ds.Element {
  static hostClass = "action-item icon";
  static props = ["icon", "label", "checked", "badge", "kind"];
  render() {
    const h = ds.h;
    const checked = this.flag("checked");
    const menu = this.attr("kind", "") === "menu";
    const label = this.attr("label", "");
    const badge = this.attr("badge", "");
    this.setClasses({ checked });
    this.setAttribute("role", menu ? "button" : "tab");
    if (menu) { this.setAttribute("aria-haspopup", "true"); this.setAttribute("aria-label", label.replace(/ \(.*\)$/, "")); }
    else {
      this.setAttribute("draggable", "true");
      this.setAttribute("aria-label", "");
      this.setAttribute("aria-expanded", String(checked));
      this.setAttribute("aria-selected", String(checked));
    }
    this.style.setProperty("--insert-border-color", "var(--vscode-activityBar-dropBorder)");
    return [
      h("a.action-label.codicon.codicon-" + this.attr("icon", "blank"), {
        "aria-label": label,
        style: "color: var(" + (checked ? "--vscode-activityBar-foreground" : "--vscode-activityBar-inactiveForeground") + ");",
      }),
      h("div.badge", { "aria-hidden": "true", "aria-label": label, style: badge ? undefined : "display: none;" },
        h("div.badge-content", { style: "color: var(--vscode-activityBarBadge-foreground); background-color: var(--vscode-activityBarBadge-background);" }, badge || null)),
      h("div.active-item-indicator"),
    ];
  }
}
ds.define("vsc-activity-item", ActivityItem);
