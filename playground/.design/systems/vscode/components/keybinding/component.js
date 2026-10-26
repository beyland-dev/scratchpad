class Keybinding extends ds.Element {
  static hostClass = "monaco-keybinding";
  static props = ["keys", "unstyled"];
  render() {
    const keys = this.attr("keys", "").split("+").map((k) => k.trim()).filter(Boolean);
    // unstyled: colors come from the surrounding widget's CSS (e.g. quick input rows).
    const unstyled = this.flag("unstyled");
    if (!unstyled) this.style.color = "var(--vscode-keybindingLabel-foreground)";
    this.setAttribute("aria-label", keys.join("+"));
    const out = [];
    keys.forEach((key, i) => {
      if (i) out.push(ds.h("span.monaco-keybinding-key-separator", null, "+"));
      out.push(ds.h("span.monaco-keybinding-key", unstyled ? null : {
        style: "background-color: var(--vscode-keybindingLabel-background); border-color: var(--vscode-keybindingLabel-border); border-bottom-color: var(--vscode-keybindingLabel-bottomBorder); box-shadow: inset 0 -1px 0 var(--vscode-widget-shadow);",
      }, key));
    });
    return out;
  }
}
ds.define("vsc-keybinding", Keybinding);
