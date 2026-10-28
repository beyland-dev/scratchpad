// Mirrors ChatMarkdownContentPart's root (`.chat-markdown-part.rendered-markdown`). Styles come from <vsc-chat-response>'s captures.
const CMD_BLOCK = /^(p|h[1-6]|ul|ol|pre|blockquote|div|table|hr)$/;

class ChatMarkdown extends ds.Element {
  static hostClass = "chat-markdown-part rendered-markdown";
  render() {
    const nodes = this.slotted("");
    return nodes.some((n) => n.nodeType === 1 && CMD_BLOCK.test(n.localName)) ? nodes : ds.h("p", null, nodes);
  }
}
ds.define("vsc-chat-markdown", ChatMarkdown);
