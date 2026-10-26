class Dialog extends ds.Element {
  static hostClass = "monaco-dialog-modal-block dimmed";
  static props = ["severity", "message", "buttons", "primary"];
  render() {
    const h = ds.h;
    const severity = this.attr("severity", "info");
    const icons = { info: ["dialog-info", "problemsInfoIcon", "Info"], warning: ["dialog-warning", "problemsWarningIcon", "Warning"], error: ["dialog-error", "problemsErrorIcon", "Error"] };
    const [icon, color, label] = icons[severity] || icons.info;
    const buttons = this.attr("buttons", "OK").split(",").map((b) => b.trim()).filter(Boolean);
    const primary = this.attr("primary", buttons[buttons.length - 1]);
    // Like VS Code on Linux/web: secondary buttons first, the primary (focused) button last.
    const buttonEls = buttons.map((text) => {
      const isPrimary = text === primary;
      const p = isPrimary ? "--vscode-button-" : "--vscode-button-secondary";
      return h("a.monaco-button.monaco-text-button" + (isPrimary ? "" : ".secondary"), {
        tabindex: "0", role: "button", "aria-disabled": "false",
        style: "color: var(" + p + (isPrimary ? "foreground" : "Foreground") + "); background-color: var(" + (isPrimary ? "--vscode-button-hoverBackground" : "--vscode-button-secondaryBackground") + "); border: 1px solid var(" + p + (isPrimary ? "border" : "Border") + ");",
      }, text);
    });
    return h("div.dialog-shadow", null,
      h("div.monaco-dialog-box", {
        role: "dialog", tabindex: "-1", "aria-modal": "true",
        style: "color: var(--vscode-editorWidget-foreground); background-color: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border);",
      },
        h("div.dialog-buttons-row", null, h("div.dialog-buttons", null, buttonEls)),
        h("div.dialog-message-row", null,
          h("div.dialog-icon.codicon.codicon-" + icon, { "aria-label": label, style: "color: var(--vscode-" + color + "-foreground);" }),
          h("div.dialog-message-container", null,
            h("div.dialog-message", null, h("div.dialog-message-text", null, this.attr("message", ""))),
            h("div.dialog-message-detail", null, this.slotted("")))),
        h("div.dialog-toolbar-row", null,
          h("div.dialog-toolbar", null,
            h("div.monaco-action-bar", null,
              h("ul.actions-container", { role: "toolbar" },
                h("li.action-item", { role: "presentation" },
                  h("a.action-label.codicon.codicon-dialog-close", { role: "button", "aria-label": "Close Dialog", tabindex: "0" }))))))));
  }
}
ds.define("vsc-dialog", Dialog);
