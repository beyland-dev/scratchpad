class FindInput extends ds.Element {
  static hostClass = "monaco-findInput";
  static props = ["placeholder", "value", "label", "focused"];
  render() {
    const value = this.attr("value", "");
    const toggles = this.slotted("");
    const controls = toggles.length ? toggles : [
      ds.h("vsc-toggle", { icon: "case-sensitive", label: "Match Case (Alt+C)" }),
      ds.h("vsc-toggle", { icon: "whole-word", label: "Match Whole Word (Alt+W)" }),
      ds.h("vsc-toggle", { icon: "regex", label: "Use Regular Expression (Alt+R)" }),
    ];
    const reserve = (controls.filter((n) => n.nodeType === 1).length * 22) + "px";
    const textarea = ds.h("textarea.input", {
      autocorrect: "off", autocapitalize: "off", spellcheck: "false",
      "aria-label": this.attr("label", this.attr("placeholder", "")),
      placeholder: this.attr("placeholder", ""),
      style: "background-color: inherit; color: var(--vscode-input-foreground); width: calc(100% - " + reserve + "); height: 24px;",
    });
    textarea.value = value;
    textarea.addEventListener("input", () => { mirror.textContent = textarea.value || "\u00a0"; });
    const mirror = ds.h("div.mirror", { style: "padding-right: " + reserve + ";" }, value || "\u00a0");
    return [
      ds.h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
        ds.h("div.monaco-inputbox.idle" + (this.flag("focused") ? ".synthetic-focus" : ""), { style: "overflow: hidden; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent);" },
          ds.h("div.ibwrapper", null, textarea, mirror)),
        ds.h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;" },
          ds.h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;" })),
        ds.h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 8px; height: 24px; right: 0px; top: 0px;" },
          ds.h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 24px;" })),
        ds.h("div.shadow"), ds.h("div.shadow"), ds.h("div.shadow")),
      ds.h("div.controls", null, controls),
    ];
  }
}
ds.define("vsc-find-input", FindInput);
