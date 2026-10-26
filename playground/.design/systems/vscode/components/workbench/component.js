class Workbench extends ds.Element {
  static hostClass = "monaco-enable-motion modern-ui modern-ui-tabs modern-ui-connected-editor-tabs modern-ui-notifications-dialogs monaco-workbench linux web chromium floating-panels nopanel fullscreen panel-position-bottom panel-alignment-center file-icons-enabled sash-grippers-hidden agent-status-enabled unified-agents-bar";
  static props = ["theme"];
  render() {
    ds.applyTheme(this, this.attr("theme", ds.system.defaultTheme));
    this.setAttribute("role", "application");
    this.style.setProperty("--modern-ui-shell-background", "var(--vscode-modernUI-shellBackground)");
    return undefined;
  }
}
ds.define("vsc-workbench", Workbench);
