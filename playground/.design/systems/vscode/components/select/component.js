class Select extends ds.Element {
  static hostClass = "";
  static props = ["options", "value", "label", "variant"];
  render() {
    const h = ds.h;
    const settings = this.attr("variant", "") === "settings";
    const p = settings ? "--vscode-settings-dropdown" : "--vscode-dropdown-";
    const options = this.attr("options", "").split(",").map((o) => o.trim()).filter(Boolean);
    const value = this.attr("value", options[0]);
    const select = h("select.monaco-select-box" + (settings ? ".setting-control-focus-target" : ""), {
      tabindex: settings ? "-1" : "0", "aria-label": this.attr("label"),
      style: "background-color: var(" + p + (settings ? "Background" : "background") + "); color: var(" + p + (settings ? "Foreground" : "foreground") + "); border-color: var(" + p + (settings ? "Border" : "border") + ");",
    }, options.map((o) => h("option", { value: o }, o)));
    select.value = value;
    return select;
  }
}
ds.define("vsc-select", Select);
