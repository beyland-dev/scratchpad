// Mirrors a tool row inside ChatThinkingContentPart (`.chat-thinking-tool-wrapper`): ChatToolProgressSubPart for
// completed calls, or the code block pill row ("Edited" + file pill) for file edits.
class ChatToolCall extends ds.Element {
  static hostClass = "chat-thinking-tool-wrapper";
  static props = ["icon", "file", "edit", "added", "removed", "running"];
  render() {
    const h = ds.h;
    const icon = this.attr("icon", "tools");
    const file = this.attr("file", "");
    const name = file.split("/").pop();
    const ext = (name.match(/\.([^.]+)$/) || [])[1] || "";
    const label = this.slotted("");
    const fileParts = () => [
      h("span.icon.file-icon.name-file-icon.ext-file-icon" + (ext ? "." + ext + "-ext-file-icon" : "")),
      h("span.icon-label", null, name),
    ];
    if (this.flag("edit")) {
      const added = this.attr("added", ""), removed = this.attr("removed", "");
      return [
        h("span.chat-thinking-icon.codicon.codicon-" + icon),
        h("div.chat-codeblock-pill-container.chat-tool-call-with-icon", null,
          h("span.chat-tool-call-icon.codicon.codicon-" + icon),
          h("span.chat-codeblock-pill-row", null,
            h("span.status-indicator-container", null,
              h("span.status-icon.codicon.codicon-check-compact"),
              h("span.status-label", null, label.length ? label : "Edited")),
            h("span.chat-codeblock-pill-widget.show-file-icons", { role: "button" },
              h("span.progress-fill", { style: "width: 0%;" }),
              fileParts(),
              h("span.label-detail"),
              added ? h("span.label-added", null, "+" + added) : null,
              removed ? h("span.label-removed", null, "-" + removed) : null))),
      ];
    }
    // In progress: the product swaps the tool icon for a spinning loading codicon until the call completes.
    const shown = this.flag("running") ? "loading.codicon-modifier-spin" : icon;
    return [
      h("span.chat-thinking-icon.codicon.codicon-" + shown),
      h("div.chat-tool-invocation-part.chat-tool-call-with-icon", null,
        h("span.chat-tool-call-icon.codicon.codicon-" + shown),
        h("div.progress-container", null,
          h("div.codicon.codicon-check-compact"),
          h("div.rendered-markdown.progress-step", null,
            h("p", null, label, file ? [" ", h("a.chat-inline-anchor-widget.show-file-icons", { href: "", "data-href": "file:///" + file }, fileParts())] : null))),
        h("div")),
    ];
  }
}
ds.define("vsc-chat-tool-call", ChatToolCall);
