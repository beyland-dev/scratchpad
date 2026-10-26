class ChatInput extends ds.Element {
  static hostClass = "interactive-input-part chat-input-surface-stack chat-input-picker-focus-scope";
  static props = ["placeholder", "value"];
  render() {
    const h = ds.h;
    const slot = (cls, attrs) => h("div." + cls, attrs);
    let toolbar = this.slotted("toolbar");
    if (!toolbar.length) toolbar = [
      h("vsc-action", { menu: "", icon: "add-compact", label: "Add Context... (Ctrl+/)" }),
      h("vsc-chat-picker", { kind: "mode", icon: "agent-compact", label: "Agent" }),
      h("vsc-chat-model-picker", { label: "Models" }),
      h("vsc-action", { menu: "", class: "toolbar-shrinkable-item", icon: "settings-compact", label: "Configure Tools...", focusable: "false" }),
    ];
    let secondary = this.slotted("secondary");
    if (!secondary.length && !this.hasAttribute("no-secondary")) secondary = [
      h("vsc-chat-picker", { kind: "target", icon: "vm-compact", label: "Local" }),
      h("vsc-chat-picker", { icon: "shield-compact", label: "Default permissions" }),
    ];
    for (const item of secondary) if (item.nodeType === 1) item.style.minWidth = "22px";

    const value = this.attr("value", "");
    const text = h("div.dt-editor-text", { contenteditable: "plaintext-only", role: "textbox", "aria-multiline": "true", "aria-label": "Chat Input", spellcheck: "false" }, value);
    const placeholder = h("div.editorPlaceholder", { style: value ? "display: none;" : undefined }, this.attr("placeholder", "Describe what to build"));
    const submit = h("vsc-chat-submit", { disabled: value.trim() ? undefined : "" });
    const container = h("div.chat-input-container", { style: "position: relative;" },
      h("div.chat-attachments-container", { "aria-hidden": "true", style: "display: none;" }, h("div.chat-attached-context", { "aria-hidden": "true", style: "display: none;" })),
      h("div.chat-editor-container", null,
        h("div.interactive-input-editor.hideSuggestTextIcons", { "data-mode-id": "plaintext", style: "--editor-font-size: 13px;" },
          h("div.monaco-editor.dt-editor", { role: "code" }, text, placeholder))),
      h("div.chat-input-toolbars", null,
        h("div.monaco-toolbar.responsive.responsive-last.chat-input-toolbar", { style: "--vscode-toolbar-action-min-width: 22px;" },
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, toolbar))),
        h("div.monaco-toolbar.chat-execute-toolbar", null,
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, submit)))),
      h("div.chat-input-working-border", { "aria-hidden": "true" }),
      h("div.chat-input-working-border.chat-input-working-border-glow", { "aria-hidden": "true" }),
      h("div.voice-glow-slot", { style: "z-index: 11;" }),
      h("div.voice-glow-slot", { style: "z-index: 11;" }));

    const stack = h("div.chat-input-stack", null,
      slot("chat-customization-migration-notice-container.chat-input-stack-slot"),
      slot("chat-input-notification-container.chat-input-stack-slot"),
      slot("voice-mode-onboarding-container.chat-input-stack-slot"),
      slot("dictation-onboarding-container.chat-input-stack-slot"),
      slot("chat-goal-banner-container.chat-input-stack-slot"),
      slot("chat-todo-list-widget-container"),
      slot("chat-artifacts-widget-container"),
      slot("chat-editing-session", { style: "display: none;", "aria-hidden": "true" }),
      slot("chat-getting-started-tip-container.chat-input-stack-slot"),
      h("div.interactive-input-and-side-toolbar", null, container));

    const setFocused = (focused) => {
      container.classList.toggle("focused", focused);
      stack.classList.toggle("chat-input-stack-input-focused", focused);
    };
    text.addEventListener("focus", () => setFocused(true));
    text.addEventListener("blur", () => setFocused(false));
    text.addEventListener("input", () => {
      const v = text.textContent || "";
      placeholder.style.display = v ? "none" : "";
      submit.toggleAttribute("disabled", !v.trim());
    });
    container.addEventListener("mousedown", (event) => {
      if (event.target === text || event.target.closest(".action-item")) return;
      event.preventDefault();
      text.focus();
    });

    return [
      slot("chat-input-persistent-content"),
      slot("chat-session-archive-nudge-container.chat-input-surface-stack-slot"),
      slot("chat-plan-review-widget-container.chat-input-surface-stack-slot"),
      slot("chat-question-carousel-widget-container.chat-input-surface-stack-slot"),
      slot("chat-tool-confirmation-carousel-container.chat-input-surface-stack-slot", { "aria-hidden": "true", style: "display: none;" }),
      slot("interactive-input-followups.chat-input-surface-stack-slot"),
      stack,
      h("div.chat-secondary-toolbar", null,
        h("div.chat-responsive-picker-container", { style: "min-width: 50px;" },
          h("div.monaco-toolbar.responsive.responsive-all.chat-secondary-input-toolbar", { style: "--vscode-toolbar-action-min-width: 48px; min-width: 50px;" },
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, secondary))),
          slot("chat-secondary-generic-chips")),
        slot("chat-context-usage-container"),
        h("div.chat-input-status-container.has-no-actions", null,
          h("div.monaco-toolbar.chat-input-status-toolbar", null,
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }))))),
      slot("chat-input-overlay"),
    ];
  }
}
ds.define("vsc-chat-input", ChatInput);
