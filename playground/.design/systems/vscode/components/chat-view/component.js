class ChatView extends ds.Element {
  static hostClass = "pane-body chat-viewpane chat-view-location-auxiliarybar chat-view-position-right";
  render() {
    return ds.h("div.chat-controls-container", null,
      ds.h("div.interactive-session", { style: "font-size: 13px; --vscode-interactive-result-editor-background-color: var(--vscode-editor-background); --vscode-interactive-session-foreground: var(--vscode-sideBar-foreground); --vscode-chat-list-background: var(--vscode-sideBar-background);" }, this.slotted("")));
  }
}
ds.define("vsc-chat-view", ChatView);
