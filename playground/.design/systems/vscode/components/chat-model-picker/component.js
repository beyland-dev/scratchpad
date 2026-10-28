class ChatModelPicker extends ds.Element {
  static hostClass = "action-item chat-input-picker-item model-picker-item";
  static props = ["label", "badge", "model", "harness", "icon", "config", "notice"];
  get current() {
    const model = this.attr("model");
    return model ? ds.chatPickers.model(model, this.attr("harness", "copilot")) : null;
  }
  render() {
    this.setAttribute("role", "presentation");
    const model = this.current;
    const config = this._config || {};
    let summary = this.attr("config", "");
    if (model && !this.hasAttribute("config")) {
      const merged = JSON.parse(JSON.stringify(model));
      if (config.effort && merged.effort) merged.effort.value = config.effort;
      if (config.context && merged.context && !merged.context.max) merged.context.value = config.context;
      summary = ds.chatPickers.summary(merged);
    }
    const label = this.attr("label", model ? model.name : (this.textContent.trim() || "Models"));
    const icon = this.attr("icon", model ? model.icon : "");
    const badge = this.attr("badge", "");
    // The Agents window layout: provider icon, model name and a configuration summary (effort · context size).
    const agents = !!(model || icon || summary);
    const open = (details) => (e) => {
      e.stopPropagation();
      ds.openModelList(e.currentTarget, {
        harness: this.attr("harness", "copilot"), model: this.attr("model", ds.chatPickers.defaultModel(this.attr("harness", "copilot"))), details: details ? this.attr("model") : undefined,
        notice: this.hasAttribute("notice") ? this.attr("notice") || "true" : undefined,
        onSelect: (m, chosen) => { this._config = chosen || {}; this.removeAttribute("label"); this.removeAttribute("icon"); this.removeAttribute("config"); this.setAttribute("model", m.id); this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { model: m.id, name: m.name, config: this._config } })); },
        onConfigure: (detail, chosen) => { this._config = { ...chosen }; this.update(); this.dispatchEvent(new CustomEvent("configure", { bubbles: true, detail })); },
      });
    };
    this.setClasses({ "toolbar-shrinkable-item": this.flag("shrinkable") });
    return ds.h("div.action-label.model-picker-split.chat-input-picker-split" + (agents && summary ? ".has-config" : ""), { role: "group", tabindex: "-1", "aria-label": agents ? "Models, " + label : label },
      ds.h("a.chat-input-picker-split-button.chat-input-picker-split-primary.model-picker-section.model-picker-name", {
        role: "button", tabindex: "0", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": agents ? "Models, " + label : label, style: agents ? "min-width: 90px;" : "min-width: max-content;",
        onclick: open(false),
      },
        icon ? ds.icon(icon) : null,
        ds.h("span.chat-input-picker-label", null, label),
        ds.h("span.model-picker-badge", { style: badge ? undefined : "display: none;" }, badge || null)),
      ds.h("a.chat-input-picker-split-button.chat-input-picker-split-secondary.model-picker-section.model-picker-config.model-picker-config-summary", {
        role: "button", tabindex: "0", "aria-haspopup": "dialog", "aria-expanded": "false", style: summary ? "" : "display: none;",
        "aria-label": summary && model ? `${label} details, ${model.effort ? "Effort Level: " + (config.effort || model.effort.value) : ""}${model.context ? (model.effort ? ", " : "") + (model.context.max ? "Max context: " + model.context.max : "Context Size: " + (config.context || model.context.value)) : ""}` : undefined,
        onclick: open(true),
      }, summary ? ds.h("span.chat-input-picker-label", null, summary) : null));
  }
}
ds.define("vsc-chat-model-picker", ChatModelPicker);
