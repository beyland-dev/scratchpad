// Mirrors the response rows of ChatListItemRenderer (src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts):
// hidden header, value (content parts, optionally behind the completed-response disclosure), timestamp row and footer toolbar.
class ChatResponse extends ds.Element {
  static hostClass = "interactive-item-container editing-session interactive-response chat-persistent-progress";
  static props = ["summary", "added", "removed", "expanded"];
  render() {
    const h = ds.h;
    const summary = this.attr("summary", "");
    const added = this.attr("added", ""), removed = this.attr("removed", "");
    const edits = !!(added || removed);
    const chevron = () => h("span.chat-collapsible-hover-chevron.codicon.codicon-chevron-right-compact");
    let disclosure = null;
    if (summary) {
      disclosure = h("details.completed-response-disclosure", { open: this.flag("expanded") },
        h("summary.completed-response-summary.chat-used-context-label" + (edits ? ".chat-completed-response-with-edits" : ""), {
          onclick: (e) => { e.preventDefault(); this.toggleAttribute("expanded"); },
        },
          h("span.monaco-button.monaco-text-button.monaco-icon-button", null, h("span.monaco-button-mdlabel", null, summary), edits ? null : chevron()),
          edits ? h("a.monaco-button.chat-edit-stats", { role: "button" }, h("span.label-added", null, "+" + (added || 0)), h("span.label-removed", null, "-" + (removed || 0))) : null,
          edits ? chevron() : null),
        this.slotted("steps"));
    }
    return [
      h("div.header", null,
        h("div.user", null,
          h("div.avatar-container.hidden", null, h("div.avatar.codicon-avatar", null, h("div.codicon.codicon-chat-sparkle"))),
          h("h3.username.hidden", null, "GitHub Copilot"),
          h("span.detail-container", null, h("span.detail"), h("span.chat-animated-ellipsis")))),
      h("div.value", null, disclosure, this.slotted("")),
      h("div.chat-request-timestamp-container"),
      h("div.chat-footer-toolbar.has-no-actions", null,
        h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" })))),
    ];
  }
}
ds.define("vsc-chat-response", ChatResponse);
