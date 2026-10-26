class StatusItem extends ds.Element {
  static hostClass = "statusbar-item";
  static props = ["text", "label", "align", "compact", "no-command"];
  render() {
    const h = ds.h;
    const align = this.attr("align", "left") === "right" ? "right" : "left";
    const compact = this.attr("compact", "");
    const text = this.attr("text", this.textContent.trim());
    this.setClasses({ left: align === "left", right: align === "right", "has-command": !this.flag("no-command"), "compact-left": compact === "left", "compact-right": compact === "right" });
    const parts = [];
    // VS Code label syntax: "$(icon-name) text"
    for (const piece of text.split(/(\$\([a-z0-9-~]+\))/)) {
      const m = /^\$\(([a-z0-9-]+)(~spin)?\)$/.exec(piece);
      if (m) parts.push(h("span.codicon.codicon-" + m[1] + (m[2] ? ".codicon-modifier-spin" : "")));
      else if (piece) parts.push(piece);
    }
    const label = this.attr("label", text.replace(/\$\([^)]*\)\s*/g, "").trim());
    this.setAttribute("aria-label", label);
    return [
      h("a.statusbar-item-label", { role: "button", tabindex: "-1", "aria-label": label }, parts),
      h("div.status-bar-item-beak-container"),
    ];
  }
}
ds.define("vsc-status-item", StatusItem);
