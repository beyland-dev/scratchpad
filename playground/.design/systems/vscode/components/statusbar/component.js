class Statusbar extends ds.Element {
  static hostClass = "part statusbar status-border-top";
  render() {
    const h = ds.h;
    this.setAttribute("role", "status");
    this.setAttribute("aria-live", "off");
    this.style.backgroundColor = "var(--vscode-statusBar-background)";
    this.style.boxShadow = "var(--vscode-statusBar-background) 0px 1px 0px";
    this.style.color = "var(--vscode-statusBar-foreground)";
    this.style.setProperty("--status-border-top-color", "var(--vscode-statusBar-border)");
    this.style.height = "28px";
    const items = this.slotted("").filter((n) => n.nodeType === 1);
    const left = items.filter((n) => n.getAttribute("align") !== "right");
    // Right items are laid out right-to-left: authors list them in visual order, the DOM is reversed.
    const right = items.filter((n) => n.getAttribute("align") === "right").reverse();
    const mark = (list, first, last) => list.forEach((n, i) => {
      n.classList.toggle("first-visible-item", i === first(list));
      n.classList.toggle("last-visible-item", i === last(list));
    });
    mark(left, () => 0, (l) => l.length - 1);
    mark(right, (l) => l.length - 1, () => 0);
    return [h("div.left-items.items-container", null, left), h("div.right-items.items-container", null, right)];
  }
}
ds.define("vsc-statusbar", Statusbar);
