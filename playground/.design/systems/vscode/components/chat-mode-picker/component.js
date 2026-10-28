/*
 * Copilot's combined Mode and Permissions picker in the Agents window composer
 * (src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostModePickerPresentation.ts): a split
 * button, "Interactive | Allow all", whose halves open one popup with the Agent mode or the Permissions section
 * expanded. The permission summary is colored for Assisted (warning) and Allow all (info); a sandboxed terminal
 * adds a shield.
 */
class ChatModePicker extends ds.Element {
  static hostClass = "action-item";
  static props = ["mode", "permissions", "sandbox", "environment", "disabled"];
  render() {
    const h = ds.h;
    const data = ds.chatPickers.data;
    const mode = ds.chatPickers.find(data.modes, this.attr("mode", "interactive")) || data.modes[0];
    const level = ds.chatPickers.find(data.permissions, this.attr("permissions", "allow-all")) || data.permissions[2];
    const sandbox = this.flag("sandbox");
    const disabled = this.flag("disabled");
    this.setAttribute("role", "presentation");
    this.setAttribute("tabindex", "-1");
    const open = (section) => (e) => { e.stopPropagation(); if (!disabled) this.open(section, e.currentTarget); };
    const key = (section) => (e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); this.open(section, e.currentTarget); } };
    const levelLabel = level.short === "Manual" ? "Manual permissions" : level.short;
    return h("div.sessions-chat-picker-slot", null,
      h("div.action-label.chat-input-picker-split.agent-host-mode-permissions-trigger", {
        tabindex: "-1", role: "group", "aria-disabled": disabled ? "true" : "false",
        "aria-label": `Pick Mode and Permissions, ${mode.label}, ${levelLabel}${sandbox ? ", terminal sandboxed" : ""}`,
      },
        h("a.chat-input-picker-split-button.chat-input-picker-split-primary.agent-host-mode-picker-button.agent-host-mode-button", {
          role: "button", tabindex: "0", "aria-disabled": disabled ? "true" : "false", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "Pick Mode, " + mode.label,
          onclick: open("mode"), onkeydown: key("mode"),
        }, h("span.codicon.codicon-" + mode.icon + "-compact", { "aria-hidden": "true" }), h("span.sessions-chat-dropdown-label", null, mode.label)),
        h("a.chat-input-picker-split-button.chat-input-picker-split-secondary.agent-host-mode-picker-button.agent-host-permissions-button", {
          role: "button", tabindex: "0", "aria-disabled": disabled ? "true" : "false", "aria-haspopup": "menu", "aria-expanded": "false",
          "aria-label": `Pick Permissions, ${levelLabel}${sandbox ? ", terminal sandboxed" : ""}`,
          onclick: open("permissions"), onkeydown: key("permissions"),
        },
          h("span.agent-host-mode-permission-summary" + (level.style ? "." + level.style : ""), null, level.short),
          sandbox ? h("span.codicon.codicon-shield-compact.agent-host-mode-sandbox-icon", { "aria-hidden": "true" }) : null)));
  }
  open(section, anchor) {
    const state = { mode: this.attr("mode", "interactive"), permission: this.attr("permissions", "allow-all"), sandbox: this.flag("sandbox"), environment: this.attr("environment", "local"), open: section };
    const refresh = (view) => { view.items = ds.chatPickers.items.modePermissions(state); };
    const fire = () => this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { mode: state.mode, permissions: state.permission, sandbox: state.sandbox } }));
    ds.actionList.open(anchor, {
      items: ds.chatPickers.items.modePermissions(state), label: "Mode and Permissions Picker", role: "menu", itemRole: "menuitem",
      widgetClass: "agent-host-mode-permissions-popup", minWidth: 300, maxWidth: 300,
      onSelect: (item, view) => {
        if (item.id === "section:mode" || item.id === "section:permissions") {
          const section = item.id.slice("section:".length);
          state.open = state.open === section ? undefined : section;
          refresh(view);
          return true;
        }
        if (item.data && item.data.kind === "mode") { state.mode = item.id; this.setAttribute("mode", item.id); fire(); }
        else if (item.data && item.data.kind === "permission") { state.permission = item.id; this.setAttribute("permissions", item.id); fire(); }
        else if (item.data && item.data.kind === "sandbox") { state.sandbox = !state.sandbox; this.toggleAttribute("sandbox", state.sandbox); fire(); refresh(view); return true; }
        return false;
      },
      onToggle: (item, checked, view) => { state.sandbox = checked; this.toggleAttribute("sandbox", checked); fire(); refresh(view); },
      onToolbar: () => this.dispatchEvent(new CustomEvent("configure-permissions", { bubbles: true })),
    });
  }
}
ds.define("vsc-chat-mode-picker", ChatModePicker);
