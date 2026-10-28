/*
 * Agents window session view: the ancestors the Agents composer's CSS is scoped to
 * (`.part.sessionspart … .session-view …`). `variant="session"` is an open session's chat
 * (`.chat-view.chat-view-chat.experimental-session-composer > .chat-view-widget > .interactive-session`);
 * `variant="new"` is the new-session view (`.chat-view.chat-view-new > .sessions-chat-widget > .new-chat-widget-container`).
 * These ancestors carry no captured styles of their own, so the view is sized by its container. Use it inside
 * <vsc-workbench window="agents">.
 */
class SessionView extends ds.Element {
  static hostClass = "part sessionspart";
  static props = ["variant"];
  render() {
    const h = ds.h;
    const children = this.slotted("");
    const colors = "--session-view-background: var(--vscode-activeSessionView-background); --session-view-foreground: var(--vscode-activeSessionView-foreground); --part-background: var(--vscode-activeSessionView-background); --part-foreground: var(--vscode-activeSessionView-foreground); background-color: var(--session-view-background); color: var(--session-view-foreground);";
    if (this.attr("variant", "session") === "new") {
      return h("div.session-view", { style: colors },
        h("div.session-view-content.standalone-chat", null,
          h("div.chat-view.chat-view-new", null,
            h("div.sessions-chat-widget", null,
              h("div.new-chat-widget-container.revealed", null, children)))));
    }
    return h("div.session-view", { style: colors },
      h("div.session-view-content", null,
        h("div.chat-view.chat-view-chat.experimental-session-composer", null,
          h("div.chat-view-widget", null,
            h("div.interactive-session.chat-floating-persistent-content.chat-view-getting-started-disabled", { style: "font-size: 13px;" }, children)))));
  }
}
ds.define("vsc-session-view", SessionView);
