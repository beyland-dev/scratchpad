/*
 * Agents window picker button (`.sessions-chat-picker-slot`): icon + label (+ chevron) that opens the picker's
 * real options in an action list (ds.chatPickers). Header pickers (environment, workspace, harness) sit in their own
 * one-item toolbar; repository pickers (isolation, branch) and composer pickers (Claude/Codex approvals, Codex agent
 * mode) render the bare `.action-label`. Choosing an option updates the button and fires `change`.
 */
class SessionPicker extends ds.Element {
  static hostClass = "sessions-chat-picker-slot";
  static props = ["kind", "value", "label", "icon", "chevron", "disabled", "aria-prefix"];
  static KINDS = {
    environment: { list: "environment", options: () => ds.chatPickers.data.environments, aria: (o) => "Choose Environment, " + o.label, toolbar: true, category: true },
    workspace: { list: "workspace", options: () => ds.chatPickers.data.workspaces, aria: (o) => "Workspace: " + o.label, toolbar: true, category: true, chevron: true, extra: "sessions-workspace-picker-trigger workspace-clearable" },
    isolation: { list: "isolation", options: () => ds.chatPickers.data.isolation, aria: (o) => "Isolation: " + o.label, extra: "sessions-chat-isolation-picker" },
    branch: { list: "branch", options: () => ds.chatPickers.data.branches, aria: (o) => "Branch: " + o.label + (o.uncommitted ? ", Uncommitted Files" : ""), icon: (o) => o.buttonIcon || o.icon },
    harness: { list: "harness", options: () => ds.chatPickers.data.harnesses, aria: (o) => "Pick Session Type, " + o.label, toolbar: true, category: true, chevron: true, extra: "sessions-chat-session-type-picker" },
    "claude-approvals": { list: "claude-approvals", options: () => ds.chatPickers.data.claudeApprovals, aria: (o) => "Pick Approvals, " + o.label },
    "codex-approvals": { list: "codex-approvals", options: () => ds.chatPickers.data.codexApprovals, aria: (o) => "Pick Approvals, " + o.label },
    "codex-modes": { list: "codex-modes", options: () => ds.chatPickers.data.codexModes, aria: (o) => "Pick Agent Mode, " + o.label, labelTag: "div" },
  };
  get option() {
    const spec = SessionPicker.KINDS[this.attr("kind", "")];
    const options = spec ? spec.options().filter((o) => o.type !== "separator") : [];
    return options.find((o) => o.id === this.attr("value")) || (this.hasAttribute("label") ? null : options[0]);
  }
  render() {
    const h = ds.h;
    const kind = this.attr("kind", "");
    const spec = SessionPicker.KINDS[kind] || {};
    const option = this.option;
    const label = this.attr("label", option ? option.label : "");
    const icon = this.attr("icon", option ? (spec.icon ? spec.icon(option) : option.icon) : "");
    const disabled = this.flag("disabled");
    const noWorkspace = kind === "workspace" && option && option.noWorkspace;
    this.setClasses({ "sessions-workspace-category-picker-slot": !!spec.category, [spec.extra || ""]: !!spec.extra && !noWorkspace });
    const chevron = this.hasAttribute("chevron") ? this.flag("chevron") : !!spec.chevron;
    const aria = this.attr("aria-label", spec.aria ? spec.aria(option || { label }) : label);
    const button = h((spec.labelTag || "a") + ".action-label" + (kind === "workspace" && !noWorkspace ? ".selected" : ""), {
      role: "button", tabindex: disabled ? "-1" : "0", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-disabled": disabled ? "true" : "false", "aria-label": aria,
      onclick: (e) => { e.stopPropagation(); this.open(); },
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); this.open(); } },
    },
      icon ? h("span.codicon.codicon-" + icon, { "aria-hidden": "true" }) : null,
      h("span.sessions-chat-dropdown-label", null, label),
      chevron ? h("span.codicon.codicon-chevron-down-compact.sessions-chat-dropdown-chevron", { "aria-hidden": "true" }) : null);
    this._button = button;
    const content = spec.toolbar
      ? h("div.monaco-toolbar", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Session Picker" }, h("li.action-item", { role: "presentation" }, button))))
      : button;
    if (kind !== "workspace" || noWorkspace) return content;
    return [content, h("a.monaco-button.sessions-workspace-clear-button.codicon.codicon-close-compact", {
      tabindex: "0", role: "button", "aria-label": "Chat without a workspace",
      onclick: (e) => { e.stopPropagation(); this.choose(ds.chatPickers.find(ds.chatPickers.data.workspaces, "chat")); },
    })];
  }
  open() {
    if (this.flag("disabled") || !this._button) return;
    const spec = SessionPicker.KINDS[this.attr("kind", "")];
    if (!spec) return this.dispatchEvent(new CustomEvent("open", { bubbles: true }));
    ds.chatPickers.openList(spec.list, this._button, this.attr("value", this.option && this.option.id), (option) => this.choose(option));
  }
  choose(option) {
    if (!option) return;
    this.removeAttribute("label");
    this.removeAttribute("icon");
    this.setAttribute("value", option.id);
    this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { kind: this.attr("kind"), value: option.id, option } }));
  }
}
// Responsive state (ChatInputPickerResponsiveLayout): the picker's icon only.
SessionPicker.prototype.setCompact = function (compact) { this.classList.toggle("compact-picker", compact); };
ds.define("vsc-session-picker", SessionPicker);
