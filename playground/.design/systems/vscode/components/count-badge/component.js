class CountBadge extends ds.Element {
  static hostClass = "monaco-count-badge";
  render() {
    this.style.backgroundColor = "var(--vscode-badge-background)";
    this.style.color = "var(--vscode-badge-foreground)";
    this.style.border = "1px solid var(--vscode-contrastBorder)";
    return undefined;
  }
}
ds.define("vsc-count-badge", CountBadge);
