class WelcomeView extends ds.Element {
  static hostClass = "welcome-view";
  render() {
    const items = this.slotted("").map((node) =>
      node.nodeType === 1 && node.localName === "vsc-button" ? ds.h("div.button-container", null, node) : node);
    return ds.h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden; height: 100%;" },
      ds.h("div.welcome-view-content", { tabindex: "0", role: "region", "aria-label": "Welcome", style: "overflow: hidden; height: 100%;" }, items));
  }
}
ds.define("vsc-welcome-view", WelcomeView);
