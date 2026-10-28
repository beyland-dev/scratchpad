// Mirrors the list rows built by ChatQuestionCarouselPart.renderSingleSelect / renderMultiSelect
// (src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatQuestionCarouselPart.ts).
// `index` and `multi` are set by the parent <vsc-chat-question-carousel>.
class ChatQuestionOption extends ds.Element {
  static hostClass = "chat-question-list-item";
  static props = ["label", "description", "selected", "index", "multi"];
  render() {
    const h = ds.h;
    const label = this.attr("label", this.slotted("").map((n) => n.textContent).join("").trim());
    const description = this.attr("description", "");
    const multi = this.flag("multi");
    const selected = this.flag("selected");
    const index = Number(this.attr("index", "1"));
    this.setClasses({
      "multi-select": multi,
      checked: multi && selected,
      selected: !multi && selected,
      "has-description": !multi && !!description,
    });
    this.setAttribute("role", "option");
    this.setAttribute("aria-selected", String(selected));
    this.setAttribute("aria-label", `Option ${index}: ${label}${description ? " - " + description : ""}`);
    if (multi) this.setAttribute("tabindex", "-1"); else this.removeAttribute("tabindex");

    const number = h("div.chat-question-list-number", null, String(index));
    if (multi) {
      return [
        number,
        h("div.monaco-custom-toggle.monaco-checkbox" + (selected ? ".checked.codicon.codicon-check" : "") + ".chat-question-list-checkbox", {
          tabindex: "-1", role: "checkbox", "aria-checked": String(selected), "aria-label": label,
          style: "--monaco-custom-toggle-border-color: #007ACC00; color: var(--vscode-checkbox-foreground); background-color: var(--vscode-checkbox-background); border-color: var(--vscode-checkbox-border); font-size: 16px; height: 18px; width: 18px;",
        }),
        h("div.chat-question-list-label", null, label),
      ];
    }
    return [
      number,
      description
        ? h("div.chat-question-list-label", null, h("span.chat-question-list-label-title", null, label), h("span.chat-question-list-label-desc", null, description))
        : h("div.chat-question-list-label", null, label),
      h("div.chat-question-list-indicator" + (selected ? ".codicon.codicon-check" : "")),
    ];
  }
}
ds.define("vsc-chat-question-option", ChatQuestionOption);
