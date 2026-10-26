class SearchView extends ds.Element {
  static hostClass = "search-view actions-right";
  static props = [];
  render() {
    const h = ds.h;
    const children = this.slotted("");
    const isInput = (n) => n.nodeType === 1 && n.localName === "vsc-find-input";
    const input = [...this.slotted("input"), ...children.filter(isInput)];
    // The slot wrapper is unwrapped: its children go straight into .message.
    const message = this.slotted("message").flatMap((n) => (n.nodeType === 1 && n.localName === "span" ? [...n.childNodes] : [n]));
    return [
      h("div.search-widgets-container", null,
        h("div.search-widget", { style: "position: relative;" },
          h("a.monaco-button.toggle-replace-button.codicon.codicon-search-hide-replace", {
            tabindex: "0", role: "button", "aria-disabled": "false", "aria-expanded": "false", "aria-label": "Toggle Replace",
          }),
          h("div.search-container.input-box", null, input),
          h("div.replace-container.disabled")),
        h("div.query-details", null,
          h("div.more.codicon.codicon-search-details", { tabindex: "0", role: "button", "aria-label": "Toggle Search Details" }))),
      message.length ? h("div.messages.text-search-provider-messages", null, h("div.message", null, message)) : null,
      h("div.results.show-file-icons.file-icon-themable-tree", null, children.filter((n) => !isInput(n))),
    ];
  }
}
ds.define("vsc-search-view", SearchView);
