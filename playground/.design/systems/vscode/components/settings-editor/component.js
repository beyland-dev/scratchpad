class SettingsEditor extends ds.Element {
  static hostClass = "settings-editor";
  static props = ["toc", "tab", "placeholder", "tabs", "focused"];
  updated() {
    // SettingsEditor2.layoutSplitView(): list height = editor height - (72 + 11 + 14).
    requestAnimationFrame(() => {
      const split = this.querySelector(".settings-body > .monaco-split-view2");
      if (split && this.clientHeight) split.style.height = Math.max(0, this.clientHeight - (72 + 11 + 14)) + "px";
    });
  }

  render() {
    const h = ds.h;
    this.setAttribute("tabindex", "-1");
    const rows = this.slotted("").filter((n) => n.nodeType === 1);
    const toc = this.attr("toc", "Commonly Used:12,Text Editor:342,Workbench:200,Window:14,Chat:123,Features:515,Application:29,Security:5,Extensions:434")
      .split(",").map((e) => e.split(":")).filter((e) => e[0]);
    const tabs = this.attr("tabs", "User,Workspace").split(",").map((t) => t.trim());
    const active = this.attr("tab", tabs[0]);
    const tocRows = toc.map(([name, count], i) => h("div.monaco-list-row" + (i === 0 ? ".focused.selected" : ""), {
      role: "treeitem", "data-index": String(i), "aria-level": "2", "aria-selected": String(i === 0), "aria-label": name + ", group",
      style: "top: " + i * 22 + "px; height: 22px; line-height: 22px;",
    },
      h("div.monaco-tl-row", null,
        h("div.monaco-tl-indent", { style: "width: 0px;" }),
        h("div.monaco-tl-twistie" + (i === 0 ? "" : ".codicon.codicon-tree-item-expanded.collapsible.collapsed"), { style: "padding-left: 8px;" }),
        h("div.monaco-tl-contents", null, h("div.settings-toc-entry", null, name), count ? h("div.settings-toc-count", null, " (" + count + ")") : null))));
    const listScrollbars = () => [
      h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 8px; left: 0px; bottom: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;" })),
      h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 8px; height: 100%; right: 0px; top: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 100%;" })),
    ];
    const scrollbars = () => [
      h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 100%; height: 0px; left: 0px; bottom: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; contain: strict; width: 100%;" })),
      h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 100%; right: 0px; top: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 14px; contain: strict; height: 100%;" })),
    ];
    return [
      h("div.settings-header", null,
        h("div.search-container", null,
          h("div.suggest-input-container" + (this.flag("focused") ? ".synthetic-focus" : ""), { "data-mode-id": "plaintext", style: "--editor-font-size: 13px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border-width: 1px; border-style: solid; border-color: var(--vscode-settings-textInputBorder, var(--vscode-input-border, transparent));" },
            h("div.suggest-input-placeholder", { style: "color: var(--vscode-input-placeholderForeground); width: calc(100% - 90px);" }, this.attr("placeholder", "Search settings")),
            // Stand-in for the search box's Monaco editor (20px line).
            h("div.dt-suggest-editor", { style: "position: relative; height: 20px;" },
              h("input.dt-suggest-input", { type: "text", "aria-label": this.attr("placeholder", "Search settings"), style: "all: unset; box-sizing: border-box; width: 100%; height: 20px; font: inherit; color: inherit;" }))),
          h("div.search-container-widgets", null,
            h("div.settings-count-widget.monaco-count-badge.long"),
            h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar" },
              h("vsc-action", { icon: "preferences-clear-input", label: "Clear Settings Search Input", disabled: "" }),
              h("vsc-action", { icon: "preferences-filter", label: "Filter Settings", dropdown: "", focusable: "false" }))))),
        h("div.settings-header-controls", { style: "border-color: var(--vscode-settings-headerBorder);" },
          h("div.settings-target-container", null,
            h("div.settings-tabs-widget", null,
              h("div.monaco-action-bar", null,
                h("ul.actions-container", { role: "tablist", "aria-label": "Settings Switcher" },
                  tabs.map((t) => h("li.action-item", { role: "presentation" },
                    h("a.action-label" + (t === active ? ".checked" : ""), { role: "tab", "aria-label": t, tabindex: t === active ? "0" : "-1", "aria-selected": String(t === active) }, t))))))),
          h("div.settings-right-controls", null,
            h("div.turn-on-sync", null,
              h("a.monaco-button.monaco-text-button", { tabindex: "0", role: "button", "aria-disabled": "false", style: "color: var(--vscode-button-foreground); background-color: var(--vscode-button-background); border: 1px solid var(--vscode-button-border);" }, "Backup and Sync Settings"))))),
      h("div.settings-body", null,
        h("div.no-results-message", { style: "color: var(--vscode-editor-foreground);" }, "No Settings Found"),
        h("div.monaco-split-view2.horizontal.separator-border", { style: "--separator-border: var(--vscode-settings-sashBorder);" },
          h("div.sash-container", null, h("div.monaco-sash.vertical", { style: "left: 198px;" })),
          h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden; height: 100%;" },
            h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 100%; height: 8px; left: 0px; bottom: 0px;" },
              h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;" })),
            h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 0px; height: 0px; right: 0px; top: 0px;" },
              h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 8px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 0px;" })),
            h("div.split-view-container", { style: "overflow: hidden; height: 100%;" },
              h("div.split-view-view.visible", { style: "left: 0px; width: 200px;" },
                h("div.settings-toc-container", { style: "width: 200px;" },
                  h("div.settings-toc-wrapper", { role: "navigation", "aria-label": "Settings" },
                    h("div.monaco-list.list_id_18.mouse-support.element-focused.selection-single", { tabindex: "0", role: "tree", "aria-label": "Settings Table of Contents" },
                      h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
                        h("div.monaco-list-rows", { style: "transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; left: 0px; top: 0px; height: " + toc.length * 22 + "px;" }, tocRows),
                        listScrollbars(), h("div.shadow"), h("div.shadow"), h("div.shadow")))))),
              h("div.split-view-view.visible", { style: "left: 200px; width: calc(100% - 200px);" },
                h("div.settings-tree-container", { style: "width: 100%;" },
                  h("div.monaco-list.list_id_19.mouse-support.settings-editor-tree.selection-none", { tabindex: "0", role: "tree", "aria-label": "Settings" },
                    h("div.monaco-scrollable-element", { role: "presentation", style: "position: relative; overflow: hidden;" },
                      h("div.monaco-list-rows", { style: "overflow: hidden; left: 0px; top: 0px;" }, rows),
                      scrollbars())))))))),
    ];
  }
}
ds.define("vsc-settings-editor", SettingsEditor);
