// A tab of <vsc-view-tabs>: mirrors the panel composite bar item rendered by CompositeBar / CompositeActionViewItem
// (src/vs/workbench/browser/parts/compositeBarActions.ts). `checked` is managed by the parent bar.
class ViewTab extends ds.Element {
  static hostClass = "action-item";
  static props = ["value", "label", "count", "checked"];
  render() {
    const h = ds.h;
    const checked = this.flag("checked");
    const label = this.attr("label", this.slotted("").map((n) => n.textContent).join("").trim());
    const count = this.getAttribute("count");
    this.setClasses({ checked });
    this.setAttribute("role", "tab");
    this.setAttribute("aria-selected", String(checked));
    this.setAttribute("aria-expanded", String(checked));
    this.setAttribute("tabindex", checked ? "0" : "-1");
    this.style.setProperty("--insert-border-color", "var(--vscode-panel-dropBorder)");
    return [
      h("a.action-label", {
        "aria-label": count ? `${label} (${count})` : label,
        style: checked ? "color: var(--vscode-panelTitle-activeForeground); border-bottom-color: var(--vscode-panelTitle-activeBorder);" : "color: var(--vscode-panelTitle-inactiveForeground);",
      }, label, count !== null && count !== "" ? h("span.view-tab-count", null, count) : null),
      h("div.badge", { "aria-hidden": "true", style: "display: none;" },
        h("div.badge-content", { style: "color: var(--vscode-activityBarBadge-foreground); background-color: var(--vscode-activityBarBadge-background);" })),
      h("div.active-item-indicator"),
    ];
  }
}
ds.define("vsc-view-tab", ViewTab);
