class ChatModelPicker extends ds.Element {
  static hostClass = "action-item chat-input-picker-item model-picker-item";
  static props = ["label", "badge"];
  render() {
    this.setAttribute("role", "presentation");
    const label = this.attr("label", this.textContent.trim() || "Models");
    const badge = this.attr("badge", "");
    return ds.h("div.action-label.model-picker-split.chat-input-picker-split", { role: "group", tabindex: "-1", "aria-label": label },
      ds.h("a.chat-input-picker-split-button.chat-input-picker-split-primary.model-picker-section.model-picker-name", {
        role: "button", tabindex: "0", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": label, style: "min-width: max-content;",
      },
        ds.h("span.chat-input-picker-label", null, label),
        ds.h("span.model-picker-badge", { style: badge ? undefined : "display: none;" }, badge || null)),
      ds.h("a.chat-input-picker-split-button.chat-input-picker-split-secondary.model-picker-section.model-picker-config.model-picker-config-summary", {
        role: "button", tabindex: "0", "aria-haspopup": "dialog", "aria-expanded": "false", style: "display: none;",
      }));
  }
}
ds.define("vsc-chat-model-picker", ChatModelPicker);
