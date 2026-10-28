/*
 * New-session options (sessions.chat.experimental.newSessionComposerLayout): the strip of session pickers
 * above the new-session composer: environment, workspace, the repository controls (isolation | branch) and the
 * harness, plus the collapse toggle. Mirrors `.new-session-workspace-picker-container` in
 * src/vs/sessions/contrib/chat/browser/sessionWorkspacePicker.ts. Cloud sessions have no repository controls and
 * show the harness without a picker; a workspace-less chat has no repository either.
 */
class SessionOptions extends ds.Element {
  static hostClass = "new-session-workspace-picker-container";
  static props = ["environment", "workspace", "isolation", "branch", "harness"];
  render() {
    const h = ds.h;
    const environment = this.attr("environment", "local");
    const workspace = this.attr("workspace", "adt");
    const harness = this.attr("harness", "copilot");
    const workspaceOption = ds.chatPickers.find(ds.chatPickers.data.workspaces, workspace);
    const cloud = environment === "cloud";
    const hasRepository = !cloud && !(workspaceOption && workspaceOption.noWorkspace);
    const picker = (kind, value, attrs) => {
      const el = h("vsc-session-picker", { kind, value, ...attrs });
      el.addEventListener("change", (e) => {
        if (e.target !== el) return;
        e.stopPropagation();
        this.setAttribute(kind === "harness" ? "harness" : kind, e.detail.value);
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { ...e.detail, options: this.value } }));
      });
      return el;
    };
    const configHost = (child) => h("li.action-item.sessions-chat-agent-host-config-host", { role: "presentation", tabindex: "-1" }, h("div.sessions-chat-agent-host-config", null, child));
    const repository = h("div.new-chat-repository-controls-host", null,
      h("div.new-chat-repo-config-container", null,
        h("div.monaco-toolbar", null,
          h("div.monaco-action-bar", null,
            h("ul.actions-container", { role: "toolbar", "aria-label": "Repository Controls" },
              configHost(picker("isolation", this.attr("isolation", "branch"))),
              h("li.action-item.repository-config-separator.disabled", { role: "presentation" }, h("a.action-label.separator.disabled", { role: "presentation", "aria-label": "", tabindex: "-1" })),
              configHost(picker("branch", this.attr("branch", "main"))))))));
    return [
      h("div.sessions-workspace-category-picker.new-chat-session-options", null,
        picker("environment", environment),
        picker("workspace", workspace),
        h("div.new-chat-session-options-details", null,
          hasRepository ? repository : null,
          picker("harness", harness, cloud ? { disabled: "", "aria-label": "Session Type, " + ds.chatPickers.harness(harness).label, chevron: "false" } : {})),
        h("a.monaco-button.new-chat-session-options-toggle.codicon.codicon-chevron-left-compact", {
          tabindex: "0", role: "button", "aria-label": "Hide Session Options",
          onclick: () => this.dispatchEvent(new CustomEvent("toggle-options", { bubbles: true })),
        })),
    ];
  }
  get value() {
    return { environment: this.attr("environment", "local"), workspace: this.attr("workspace", "adt"), isolation: this.attr("isolation", "branch"), branch: this.attr("branch", "main"), harness: this.attr("harness", "copilot") };
  }
}
ds.define("vsc-session-options", SessionOptions);
