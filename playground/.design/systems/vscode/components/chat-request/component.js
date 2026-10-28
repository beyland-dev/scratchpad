// Mirrors the request rows of ChatListItemRenderer (src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts):
// disabled header, value (rendered markdown bubble), timestamp row and an empty footer toolbar.
const CRQ_BLOCK = /^(p|h[1-6]|ul|ol|pre|blockquote|div|table|hr)$/;

class ChatRequest extends ds.Element {
  static hostClass = "interactive-item-container editing-session interactive-request";
  static props = ["timestamp"];
  render() {
    const h = ds.h;
    const nodes = this.slotted("");
    const block = nodes.some((n) => n.nodeType === 1 && CRQ_BLOCK.test(n.localName));
    const toolbar = () => h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" })));
    return [
      h("div.header.header-disabled", null,
        h("div.user", null,
          h("div.avatar-container", null, h("div.avatar.codicon-avatar", null, h("div.codicon.codicon-account"))),
          h("h3.username", null, "User"),
          h("span.detail-container", null, h("span.detail"), h("span.chat-animated-ellipsis")))),
      h("div.value", null, h("div.chat-markdown-part.rendered-markdown", null, block ? nodes : h("p", null, nodes))),
      h("div.chat-request-timestamp-container", null, h("time.chat-request-timestamp", null, this.attr("timestamp", ""))),
      h("div.chat-footer-toolbar.has-no-actions", null, toolbar()),
    ];
  }
}
ds.define("vsc-chat-request", ChatRequest);
