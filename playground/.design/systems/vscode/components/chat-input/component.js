/*
 * The chat composer. Three layouts:
 *   (default)              the workbench Chat view input: toolbar row under the editor and a secondary toolbar.
 *   variant="session"      the Agents window composer in an open session: one row with Add Context, the session
 *                          controls (Copilot: Mode | Permissions; Claude: Approvals; Codex: Agent Mode + Approvals),
 *                          the model picker (model · effort · context), Dictation/Voice and Send, plus the context
 *                          window usage ring. Host: `.interactive-input-part` inside <vsc-session-view>.
 *   variant="new-session"  the new-session composer (sessions.chat.experimental.newSessionComposerLayout): the
 *                          session options strip (environment, workspace, isolation, branch, harness) above the
 *                          same input. Host: `.new-chat-widget-content` inside <vsc-session-view variant="new">.
 * Every picker opens its real options (ds.chatPickers); changes update the composer and fire `change`.
 */
class ChatInput extends ds.Element {
  static hostClass = "interactive-input-part chat-input-surface-stack chat-input-picker-focus-scope";
  static props = ["placeholder", "value", "variant", "harness", "model", "mode", "permissions", "approvals", "agent-mode", "environment", "workspace", "isolation", "branch", "context-usage", "notice"];
  render() {
    const variant = this.attr("variant", "");
    const agents = variant === "session" || variant === "new-session";
    this.setClasses({
      "interactive-input-part chat-input-surface-stack chat-input-picker-focus-scope": variant !== "new-session",
      "chat-pet-host": variant === "session",
      "new-chat-widget-content chat-input-stack experimental-new-session-composer": variant === "new-session",
    });
    if (agents) return variant === "new-session" ? this.renderNewSession() : this.renderInputPart("session");
    return this.renderLegacy();
  }

  renderLegacy() {
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

    const { text, placeholder, container, stack } = this.editor({ placeholder: "Describe what to build" });
    container.append(
      h("div.chat-input-toolbars", null,
        h("div.monaco-toolbar.responsive.responsive-last.chat-input-toolbar", { style: "--vscode-toolbar-action-min-width: 22px;" },
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, toolbar))),
        h("div.monaco-toolbar.chat-execute-toolbar", null,
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, this._submit = h("vsc-chat-submit", { disabled: (this._value ?? this.attr("value", "")).trim() ? undefined : "" }))))),
      h("div.chat-input-working-border", { "aria-hidden": "true" }),
      h("div.chat-input-working-border.chat-input-working-border-glow", { "aria-hidden": "true" }),
      h("div.voice-glow-slot", { style: "z-index: 11;" }),
      h("div.voice-glow-slot", { style: "z-index: 11;" }));
    stack.append(
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
    void text; void placeholder;
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

  /** The editor stand-in and its container, shared by every layout (see component.css). */
  editor({ placeholder: fallback, padding }) {
    const h = ds.h;
    const value = this._value ?? this.attr("value", "");
    const text = h("div.dt-editor-text", { contenteditable: "plaintext-only", role: "textbox", "aria-multiline": "true", "aria-label": "Chat Input", spellcheck: "false", style: padding ? `padding: ${padding[0]}px 0 ${padding[1]}px; min-height: ${padding[0] + padding[1] + 40}px;` : undefined }, value);
    const placeholder = h("div.editorPlaceholder", { style: (value ? "display: none;" : "") + (padding ? ` top: ${padding[0]}px;` : "") || undefined }, this.attr("placeholder", fallback));
    const container = h("div.chat-input-container", { style: "position: relative;" },
      h("div.chat-attachments-container", { "aria-hidden": "true", style: "display: none;" }, h("div.chat-attached-context", { "aria-hidden": "true", style: "display: none;" })),
      h("div.chat-editor-container", null,
        h("div.interactive-input-editor.hideSuggestTextIcons", { "data-mode-id": "plaintext", style: "--editor-font-size: 13px;" },
          h("div.monaco-editor.dt-editor", { role: "code", style: padding ? "background-color: transparent;" : undefined }, text, placeholder))));
    const stack = h("div.chat-input-stack");
    const setFocused = (focused) => {
      container.classList.toggle("focused", focused);
      stack.classList.toggle("chat-input-stack-input-focused", focused);
    };
    text.addEventListener("focus", () => setFocused(true));
    text.addEventListener("blur", () => setFocused(false));
    text.addEventListener("input", () => {
      const v = text.textContent || "";
      this._value = v;
      placeholder.style.display = v ? "none" : "";
      this._submit && this._submit.toggleAttribute("disabled", !v.trim());
    });
    container.addEventListener("mousedown", (event) => {
      if (event.target === text || event.target.closest(".action-item, .chat-context-usage-widget")) return;
      event.preventDefault();
      text.focus();
    });
    return { text, placeholder, container, stack };
  }

  /** The session controls for the harness: Copilot's Mode | Permissions, Claude's Approvals, Codex's Agent Mode and Approvals. */
  sessionControls() {
    const h = ds.h;
    const harness = this.attr("harness", "copilot");
    const hiddenSlot = () => h("li.action-item", { role: "presentation", tabindex: "-1", style: "display: none;" }, h("div.sessions-chat-picker-slot", { style: "display: none;" }, h("a.action-label", { tabindex: "0", role: "button", "aria-haspopup": "listbox", "aria-expanded": "false" })));
    const plain = (kind, value) => h("li.action-item", { role: "presentation", tabindex: "-1" }, this.track(h("vsc-session-picker", { kind, value }), kind === "codex-modes" ? "agent-mode" : "approvals"));
    const items = [h("li.action-item.chat-input-picker-item.chat-agent-picker-item", { role: "presentation", hidden: "", inert: "", "aria-hidden": "true", tabindex: "-1", style: "display: none;" },
      h("div.sessions-chat-picker-slot", null, h("a.action-label", { tabindex: "0", role: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": "Pick Mode, Agent" }, h("span.codicon.codicon-agent"), h("span.sessions-chat-dropdown-label", null, "Agent"))))];
    if (harness === "claude") items.push(plain("claude-approvals", this.attr("approvals", "ask")));
    else if (harness === "codex") items.push(plain("codex-modes", this.attr("agent-mode", "interactive")), plain("codex-approvals", this.attr("approvals", "default")));
    else {
      const picker = h("vsc-chat-mode-picker", { mode: this.attr("mode", "interactive"), permissions: this.attr("permissions", "allow-all"), environment: this.attr("environment", "local") });
      picker.addEventListener("change", (e) => { e.stopPropagation(); this.setAttribute("mode", e.detail.mode); this.setAttribute("permissions", e.detail.permissions); this.fire({ mode: e.detail.mode, permissions: e.detail.permissions, sandbox: e.detail.sandbox }); });
      items.push(picker, hiddenSlot());
    }
    items.push(hiddenSlot(), hiddenSlot());
    return items;
  }

  /** Keep the composer's attribute in sync with a picker and re-fire its change from the composer. */
  track(picker, attr) {
    picker.addEventListener("change", (e) => { e.stopPropagation(); this.setAttribute(attr, e.detail.value); this.fire({ [attr]: e.detail.value }); });
    return picker;
  }
  fire(detail) { this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail })); }

  renderInputPart(variant) {
    const h = ds.h;
    const slot = (cls, attrs) => h("div." + cls, attrs);
    const harness = this.attr("harness", "copilot");
    const newSession = variant === "new-session";
    const placeholder = newSession ? "Pitch your idea" : ds.chatPickers.harness(harness).placeholder;
    const { container, stack } = this.editor({ placeholder, padding: newSession ? [8, 2] : [12, 12] });
    const model = h("vsc-chat-model-picker", { model: this.attr("model", ds.chatPickers.defaultModel(harness)), harness, shrinkable: newSession ? undefined : "", notice: newSession || !this.hasAttribute("notice") ? undefined : this.attr("notice") || "" });
    model.addEventListener("change", (e) => { e.stopPropagation(); this.setAttribute("model", e.detail.model); this.fire({ model: e.detail.model }); });
    const controls = this.sessionControls();
    const toolbarItems = [h("vsc-action", { menu: "", icon: "add-compact", label: "Add Context... (⌘/)", onclick: (e) => this.openAddContext(e.currentTarget) })];
    if (newSession) {
      toolbarItems.push(h("li.action-item.sessions-shared-chat-input-session-controls.toolbar-shrinkable-item", { role: "presentation" },
        h("div.sessions-chat-config-toolbar.new-chat-session-controls", null,
          h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Session controls" }, controls))))));
    } else toolbarItems.push(...controls);
    toolbarItems.push(model);
    const usage = Number(this.attr("context-usage", ""));
    ds.append(container, [
      h("div.chat-input-toolbars", null,
        h("div.monaco-toolbar.responsive.responsive-last.chat-input-toolbar", { style: "--vscode-toolbar-action-min-width: 48px;" },
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }, toolbarItems))),
        h("div.monaco-toolbar.chat-execute-toolbar", null,
          h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" },
            h("vsc-chat-voice-toggle"),
            this._submit = h("vsc-chat-submit", { label: "Send\n[⌥] Send to New Chat (⇧⌘Enter)", disabled: (this._value ?? this.attr("value", "")).trim() ? undefined : "" }))))),
      h("div.chat-input-working-border", { "aria-hidden": "true" }),
      h("div.chat-input-working-border.chat-input-working-border-glow", { "aria-hidden": "true" }),
      this.hasAttribute("context-usage") && !newSession ? this.contextUsage(usage) : null,
      h("div.voice-glow-slot", { style: "z-index: 11;" }),
      h("div.voice-glow-slot", { style: "z-index: 11;" })]);
    stack.append(
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
    return [
      slot("chat-input-persistent-content"),
      newSession ? null : h("div.session-input-banners.empty", null, h("div.session-input-banner.empty", { role: "status" })),
      slot("chat-session-archive-nudge-container.chat-input-surface-stack-slot"),
      slot("chat-question-carousel-widget-container.chat-input-surface-stack-slot"),
      slot("chat-tool-confirmation-carousel-container.chat-input-surface-stack-slot", { "aria-hidden": "true", style: "display: none;" }),
      slot("interactive-input-followups.chat-input-surface-stack-slot"),
      stack,
      // The new-session composer doesn't render the secondary toolbar (renderSecondaryToolbar: false).
      newSession ? null : h("div.chat-secondary-toolbar", null,
        h("div.chat-responsive-picker-container", null, slot("chat-secondary-generic-chips")),
        h("div.chat-input-status-container.has-no-actions", null,
          h("div.monaco-toolbar.chat-input-status-toolbar", null,
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" }))))),
      slot("chat-input-overlay"),
    ];
  }

  renderNewSession() {
    const h = ds.h;
    const options = h("vsc-session-options", {
      environment: this.attr("environment", "local"), workspace: this.attr("workspace", "adt"), isolation: this.attr("isolation", "branch"),
      branch: this.attr("branch", "main"), harness: this.attr("harness", "copilot"),
    });
    options.addEventListener("change", (e) => {
      e.stopPropagation();
      const { kind, value } = e.detail;
      if (kind === "harness") this.removeAttribute("model");
      this.setAttribute(kind, value);
      this.fire({ [kind]: value });
    });
    // The reveal fade-in plays once, like the product; re-renders after a picker change keep the composer in place.
    const revealed = this._revealed;
    this._revealed = true;
    if (revealed) options.style.animation = "none";
    return [
      options,
      h("div.new-session-quick-chat-header.sessions-workspace-category-picker"),
      h("div.session-input-banners.new-session-feedback-banners"),
      h("div.new-chat-input-container.sessions-shared-chat-input", { style: revealed ? "animation: none;" : undefined },
        h("div.sessions-shared-chat-widget", null,
          h("div.interactive-session.chat-view-getting-started-disabled", { style: "font-size: 13px;" },
            h("div.interactive-input-part.chat-input-surface-stack.chat-input-picker-focus-scope.chat-pet-host", null, this.renderInputPart("new-session"))))),
      h("div.new-chat-bottom-container.sessions-shared-chat-input-controls.empty", null,
        h("div.new-chat-controls-container.hidden"),
        h("div.new-chat-secondary-controls-container", null,
          h("div.new-chat-status-toolbar.has-no-actions", null,
            h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" })))))),
    ];
  }

  updated() {
    if (!this.attr("variant", "")) return;
    if (!this._resize && typeof ResizeObserver === "function") {
      this._resize = new ResizeObserver(() => { if (this.getBoundingClientRect().width !== this._fitWidth) this.fitPickers(); });
      this._resize.observe(this);
    }
    requestAnimationFrame(() => this.fitPickers());
  }

  /**
   * ChatInputPickerResponsiveLayout: expand every picker, then compact them from right to left until the toolbar row
   * (and, for a new session, the session options row) fits its width without pickers overlapping.
   */
  fitPickers() {
    if (!this.isConnected) return;
    this._fitWidth = this.getBoundingClientRect().width;
    // A row fits when its pickers, at their preferred widths, sit inside it without overlapping. Only the model picker
    // may shrink (its name ellipsizes down to a minimum width); the others would squeeze their labels instead.
    const fitsRow = (lane, elements) => {
      const visible = elements.filter((e) => e.offsetWidth);
      const rigid = visible.filter((e) => e.localName !== "vsc-chat-model-picker");
      const saved = rigid.map((e) => e.style.flexShrink);
      rigid.forEach((e) => { e.style.flexShrink = "0"; });
      try {
        const r = lane.getBoundingClientRect();
        const squeezed = visible.some((e) => e.localName === "vsc-chat-model-picker" && e.getBoundingClientRect().width < parseFloat(e.style.minWidth || "0") - 0.5);
        if (squeezed) return false;
        const boxes = visible.map((e) => e.getBoundingClientRect()).sort((a, b) => a.left - b.left);
        return boxes.every((b, i) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && (i === 0 || b.left >= boxes[i - 1].right - 0.5));
      } finally {
        rigid.forEach((e, i) => { e.style.flexShrink = saved[i]; });
      }
    };
    // Measure one picker set at a time: hold the other row's pickers at their preferred widths, so that a row which still
    // overflows after compacting everything keeps its leftmost pickers labeled rather than squeezing every label.
    const fit = (items, fits) => {
      for (const item of items) item.set(0);
      const ordered = items.filter((i) => i.el.offsetWidth).sort((a, b) => b.el.getBoundingClientRect().left - a.el.getBoundingClientRect().left);
      for (const item of ordered) {
        for (let level = 1; level <= item.levels && !fits(); level++) item.set(level);
        if (fits()) return;
      }
    };
    const row = this.querySelector(".chat-input-toolbars");
    if (row) {
      const items = [...row.querySelectorAll("vsc-chat-model-picker, vsc-chat-mode-picker, vsc-session-picker")].map((el) => el.localName === "vsc-chat-model-picker"
        ? { el, levels: 2, set: (level) => el.setCompactLevel(level) }
        : { el, levels: 1, set: (level) => el.setCompact(level > 0) });
      fit(items, () => fitsRow(row, [...row.querySelectorAll(".action-item")].filter((li) => !li.querySelector(".action-item"))));
    }
    const options = this.querySelector(".new-session-workspace-picker-container");
    if (options) {
      // The strip is a rounded tab (max-width: 100% - 22px) whose padding must keep its pickers inside it.
      const strip = options.querySelector(".new-chat-session-options") || options;
      const items = [...options.querySelectorAll("vsc-session-picker")].map((el) => ({ el, levels: 1, set: (level) => el.setCompact(level > 0) }));
      const inset = (() => { const cs = getComputedStyle(strip); return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 }; })();
      const lane = { getBoundingClientRect: () => { const o = options.getBoundingClientRect(), max = parseFloat(getComputedStyle(strip).maxWidth); const s = strip.getBoundingClientRect(); const right = Math.min(o.right, s.left + (Number.isFinite(max) ? max : o.width)); return { left: s.left + inset.l, right: right - inset.r }; } };
      fit(items, () => fitsRow(lane, [...options.querySelectorAll("vsc-session-picker, .new-chat-session-options-toggle")]));
      // Pickers left labeled keep their full label; when even all-icons doesn't fit, the strip clips at its edge.
      for (const { el } of items) el.style.flexShrink = el.classList.contains("compact-picker") ? "" : "0";
    }
  }

  /** Context window usage ring (ChatContextUsageWidget), shown at the top right of an open session's input. */
  contextUsage(percent) {
    const h = ds.h;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("class", "circular-progress");
    const circumference = 2 * Math.PI * 14;
    for (const [cls, dash] of [["progress-bg"], ["progress-arc", true]]) {
      const circle = document.createElementNS(ns, "circle");
      for (const [k, v] of [["cx", "18"], ["cy", "18"], ["r", "14"], ["class", cls]]) circle.setAttribute(k, v);
      if (dash) { circle.setAttribute("stroke-dasharray", String(circumference)); circle.setAttribute("stroke-dashoffset", String(circumference * (1 - Math.min(Math.max(percent, 0), 100) / 100))); }
      svg.append(circle);
    }
    return h("div.chat-context-usage-container", null,
      h("div.chat-context-usage-widget", { tabindex: "0", role: "button", "aria-label": `Context window usage: ${percent}%` },
        h("div.icon-container", null, svg), h("div.percentage-label", null, percent + "%")));
  }

  /** Add Context opens the attachments quick pick (Agent…, Screenshot Window, Sessions…, Issue…, Pull Request…). */
  openAddContext(anchor) {
    ds.actionList.open(anchor, {
      label: "Search attachments", minWidth: 200,
      items: [
        { id: "agent", label: "Agent...", icon: "agent" },
        { id: "screenshot", label: "Screenshot Window", icon: "device-camera" },
        { id: "sessions", label: "Sessions...", icon: "comment" },
        { id: "issue", label: "Issue...", icon: "issues" },
        { id: "pull-request", label: "Pull Request...", icon: "git-pull-request" },
      ],
      onSelect: (item) => this.dispatchEvent(new CustomEvent("add-context", { bubbles: true, detail: { kind: item.id } })),
    });
  }
}
ds.define("vsc-chat-input", ChatInput);
