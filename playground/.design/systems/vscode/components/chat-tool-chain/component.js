// Mirrors the tool-chain container of ChatThinkingContentPart: `.chat-used-context-list.chat-thinking-collapsible` holding the calls.
class ChatToolChain extends ds.Element {
  static hostClass = "chat-used-context chat-thinking-box chat-tool-chain";
  render() {
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", "Tool calls");
    return ds.h("div.chat-used-context-list.chat-thinking-collapsible", null, this.slotted(""));
  }
}
ds.define("vsc-chat-tool-chain", ChatToolChain);
