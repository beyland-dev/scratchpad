class Workbench extends ds.Element {
  static hostClass = "monaco-enable-motion modern-ui modern-ui-tabs modern-ui-connected-editor-tabs modern-ui-notifications-dialogs monaco-workbench linux web chromium floating-panels nopanel fullscreen panel-position-bottom panel-alignment-center file-icons-enabled sash-grippers-hidden agent-status-enabled unified-agents-bar";
  static props = ["theme", "window"];
  render() {
    ds.applyTheme(this, this.attr("theme", ds.system.defaultTheme));
    this.setAttribute("role", "application");
    this.style.setProperty("--modern-ui-shell-background", "var(--vscode-modernUI-shellBackground)");
    // The Agents window (src/vs/sessions) root: its styles are scoped to `.agent-sessions-workbench`, its menus are
    // frosted, and it doesn't carry the editor window's `modern-ui` flag (whose list rules would round rows 4px).
    const agents = this.attr("window", "") === "agents";
    this.setClasses({ "agent-sessions-workbench modern-ui-frosted-glass": agents, "modern-ui": !agents });
    return undefined;
  }
}
ds.define("vsc-workbench", Workbench);
