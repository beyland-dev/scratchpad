class ExtensionItem extends ds.Element {
  static hostClass = "monaco-list-row";
  static props = ["name", "description", "icon", "kind", "version", "publisher", "installable"];
  render() {
    const h = ds.h;
    const name = this.attr("name", "");
    const installable = this.flag("installable");
    this.setAttribute("role", "listitem");
    this.setAttribute("aria-selected", "false");
    this.setAttribute("aria-label", [name, this.attr("version"), this.attr("publisher") && "Publisher " + this.attr("publisher")].filter(Boolean).join(", "));
    this.style.height = "72px";
    const icon = this.attr("icon", "");
    const label = (cls, text, extra = "") => h("li.action-item.disabled" + extra, { role: "presentation" },
      h("a.action-label.codicon.extension-action." + cls + ".disabled", { role: "button", "aria-disabled": "true", "aria-label": text }, text || null));
    return [
      h("div.extension-bookmark-container"),
      h("div.extension-bookmark-container"),
      h("div.extension-list-item", null,
        h("div.icon-container", null,
          h("div.extension-icon", null,
            h("img.icon", { alt: "", src: icon || undefined, style: icon ? "display: inherit; visibility: inherit;" : "display: none;" }),
            h("div.codicon.codicon-extension-default-icon", { style: icon ? "display: none;" : undefined })),
          h("div")),
        h("div.details", null,
          h("div.header-container", null,
            h("div.header", null,
              h("span.name", null, name),
              h("span.restart-required"), h("span.install-count"), h("span.ratings.extension-ratings.small"), h("span.sync-ignored"),
              h("span", null, this.attr("kind") ? h("div.extension-kind-indicator", null, this.attr("kind")) : null),
              h("span.activation-status"))),
          h("div.description.ellipsis", null, this.attr("description", "")),
          h("div.footer", null,
            h("div.publisher-container", null, this.attr("publisher-label") ? this.attr("publisher-label") : null),
            h("div.monaco-action-bar", null,
              h("ul.actions-container", { role: "toolbar" },
                label("text.extension-status-label.hide", ""),
                label("label.migrate", "Migrate"),
                label("label.update", "Update"),
                installable
                  ? h("li.action-item", { role: "presentation" },
                      h("a.action-label.codicon.extension-action.label.prominent.install", { role: "button", "aria-label": "Install" }, "Install"))
                  : h("li.action-item.disabled.action-dropdown-item.hide.empty", { role: "presentation" },
                      h("a.action-label.codicon.disabled.extension-action.label.prominent.install.action-dropdown", { role: "button", "aria-disabled": "true", "aria-label": "" }),
                      h("div.action-dropdown-item-separator.prominent", null, h("div")),
                      h("div.monaco-dropdown", null, h("div.dropdown-label", null,
                        h("a.action-label.dropdown.codicon.codicon-drop-down-button.extension-action.label.prominent.install.action-dropdown.disabled.hide", { role: "button", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": "More Actions..." })))),
                label("label.install.installing.hide", "Installing"),
                label("label.language", "Set Display Language"),
                label("label.language", "Clear Display Language"),
                label("label.prominent.install-other-server", "Install"),
                label("label.prominent.install-other-server", "Install"),
                label("label.prominent.install-other-server", "Install"),
                label("icon.extension-status.hide", ""),
                installable ? null : h("li.action-item", { role: "presentation" },
                  h("a.action-label.codicon.extension-action.icon.manage.codicon-extensions-manage", { role: "button", "aria-label": "Manage" })))))))];
  }
}
ds.define("vsc-extension-item", ExtensionItem);
