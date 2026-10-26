class Input extends ds.Element {
  static hostClass = "monaco-inputbox idle";
  static props = ["value", "placeholder", "label", "type", "variant", "focused"];
  render() {
    const h = ds.h;
    const variant = this.attr("variant", "");
    const type = this.attr("type", "text");
    // Settings inputs use their own tokens (settings.textInput*/numberInput*).
    const p = variant === "settings" ? (type === "number" ? "--vscode-settings-numberInput" : "--vscode-settings-textInput") : "--vscode-input-";
    const cap = (s) => (variant === "settings" ? s[0].toUpperCase() + s.slice(1) : s);
    this.setClasses({ "synthetic-focus": this.flag("focused") });
    this.style.backgroundColor = "var(" + p + cap("background") + ")";
    this.style.color = "var(" + p + cap("foreground") + ")";
    this.style.border = "1px solid var(" + p + cap("border") + ", transparent)";
    const input = h("input.input" + (variant === "settings" ? ".setting-control-focus-target" : ""), {
      autocorrect: "off", autocapitalize: "off", spellcheck: "false", type, wrap: "off",
      tabindex: variant === "settings" ? "-1" : undefined, step: type === "number" ? "any" : undefined,
      "aria-label": this.attr("label", this.attr("placeholder")), placeholder: this.attr("placeholder"),
      style: "background-color: inherit; color: var(" + p + cap("foreground") + ");",
    });
    input.value = this.attr("value", "");
    return h("div.ibwrapper", null, input);
  }
}
ds.define("vsc-input", Input);
