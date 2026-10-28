// View-switcher tabs with the panel composite bar's DOM and styles (panel title area, modern-ui-tabs).
// Fires "change" ({ value }) when the user picks a tab; ←/→ move between tabs like the composite bar.
class ViewTabs extends ds.Element {
  static hostClass = "pane-composite-part";
  static props = ["active", "label"];
  tabs() {
    return this.slotted("").filter((n) => n.nodeType === 1 && n.localName === "vsc-view-tab");
  }
  pick(tab, focus) {
    const value = tab.getAttribute("value");
    if (value === this.getAttribute("active")) return;
    this.setAttribute("active", value);
    this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value } }));
    if (focus) requestAnimationFrame(() => this.querySelector("vsc-view-tab.checked")?.focus());
  }
  render() {
    const h = ds.h;
    const tabs = this.tabs();
    const active = this.attr("active", tabs[0] && tabs[0].getAttribute("value"));
    tabs.forEach((t) => t.toggleAttribute("checked", t.getAttribute("value") === active));
    if (!this.__wired) {
      this.__wired = true;
      this.addEventListener("click", (e) => { const t = e.target.closest("vsc-view-tab"); if (t) this.pick(t); });
      this.addEventListener("keydown", (e) => {
        const t = e.target.closest("vsc-view-tab");
        if (!t) return;
        const all = this.tabs(), i = all.indexOf(t);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = all[(i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length];
          this.pick(next, true);
        } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.pick(t, true); }
      });
    }
    return h("div.composite.title.has-composite-bar", null,
      h("div.composite-bar-container", null,
        h("div.composite-bar", null,
          h("div.monaco-action-bar", null,
            h("ul.actions-container", { role: "tablist", "aria-label": this.attr("label", "Active View Switcher") }, tabs)))));
  }
}
ds.define("vsc-view-tabs", ViewTabs);
