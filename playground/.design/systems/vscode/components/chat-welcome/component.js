class ChatWelcome extends ds.Element {
  static hostClass = "chat-welcome-view-container";
  static props = ["heading", "message", "icon"];
  render() {
    const h = ds.h;
    if (!this.style.height) this.style.flex = "1 1 auto";
    const disclaimer = this.slotted("");
    return h("div.chat-welcome-view", null,
      h("div.chat-welcome-view-icon", null, h("span.codicon.codicon-" + this.attr("icon", "chat-sparkle"))),
      h("div.chat-welcome-view-title", null, this.attr("heading", "Build with Agent")),
      h("div.chat-welcome-view-message", null, h("div.rendered-markdown", null, h("p", null, this.attr("message", "AI responses may be inaccurate")))),
      disclaimer.length ? h("div.chat-welcome-view-disclaimer", null, h("div.rendered-markdown", null, h("p", null, disclaimer))) : null);
  }
}
ds.define("vsc-chat-welcome", ChatWelcome);
