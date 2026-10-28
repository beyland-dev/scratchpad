/*
 * Model picker popup (src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/): a tabbed action list with
 * the provider tab bar, the harness's models (featured, recommended, then a collapsible "Other Models" section),
 * each with its configuration summary ("Medium · 272K"), and the Send Query to Multiple Models footer. Choosing a
 * model's summary opens its details: Effort Level, Context Size and Speed as segmented controls, plus pricing.
 * Models come from ds.chatPickers (captured from the signed-in product). Fires `select` (a model) and `configure`
 * (a model with a changed effort, context size or speed).
 */
class ChatModelList extends ds.Element {
  static hostClass = "context-view monaco-component";
  static props = ["harness", "model", "expanded", "details", "notice", "position", "x", "y", "max-height"];
  render() {
    const h = ds.h;
    const pickers = ds.chatPickers;
    const harness = this.attr("harness", "copilot");
    const current = this.attr("model", pickers.defaultModel(harness));
    const expanded = this.flag("expanded");
    const groups = pickers.models(harness);
    const above = this.attr("position", "below") === "above";
    this.setClasses({ bottom: !above, top: above, left: true });
    Object.assign(this.style, { position: "absolute", zIndex: "2575" });
    if (this.hasAttribute("x")) this.style.left = this.attr("x") + "px";
    if (this.hasAttribute("y")) this.style.top = this.attr("y") + "px";

    const modelItem = (m, featured) => {
      const summary = this.summaryOf(m);
      const isCurrent = m.id === current;
      return {
        id: m.id, label: m.name, badge: m.badge, detail: featured ? m.detail : undefined, custom: true, role: "menuitemradio", checked: isCurrent, focused: isCurrent,
        icon: isCurrent ? "check" : m.warning ? "warning" : "blank",
        class: ["chat-model-picker-model", isCurrent ? "chat-model-picker-current" : "", m.badgeKind ? "chat-model-picker-badge-" + m.badgeKind : "", featured ? "chat-model-picker-featured" : ""].filter(Boolean).join(" "),
        hover: m.hover || (summary ? m.name + " · " + summary : m.name), ariaLabel: pickers.modelAria(m),
        toolbar: summary ? [{ label: summary, ariaLabel: `${m.name} Details, ${summary}`, popup: "dialog", tabindex: "-1" }] : undefined, toolbarLabels: true,
        data: { model: m },
      };
    };
    const items = [];
    for (const m of groups.featured) items.push(modelItem(m, true));
    if (groups.featured.length) items.push({ type: "separator" });
    for (const m of groups.primary) items.push(modelItem(m));
    if (groups.other.length) {
      items.push({ id: "section:other", label: "Other Models", icon: expanded ? "chevron-down" : "chevron-right", custom: true, class: "chat-model-picker-section-toggle", role: "menuitem", expanded, ariaLabel: `Other Models, ${groups.other.length} more models` });
      if (expanded) for (const m of groups.other) items.push(modelItem(m));
    }
    this._items = items;
    const maxHeight = Number(this.attr("max-height", "480"));
    const built = ds.actionList.list(items, { label: "Action Widget", role: "menu", itemRole: "menuitemradio", listClass: "chat-model-picker-dropdown chat-model-picker-tabbed action-widget-dropdown", focused: items.findIndex((i) => i.focused), maxHeight });
    this._built = built;
    const notice = this.hasAttribute("notice") ? this.attr("notice") : null;
    const tabbar = h("div.tabbed-action-list-tabbar.chat-model-picker-tabbar", null,
      h("div.tabbed-action-list-tabstrip", null,
        h("div.monaco-custom-radio", { role: "radiogroup" },
          h("a.monaco-button.active.monaco-text-button", { tabindex: "0", role: "radio", "aria-label": "Copilot", "aria-disabled": "false", "aria-checked": "true" },
            h("span.codicon.codicon-chat-model-provider-copilot"), h("span", null, "Copilot"))),
        h("button.tabbed-action-list-tabbar-action", { "data-id": "addProvider", "aria-label": "Add Models...", title: "Add Models..." }, h("span.codicon.codicon-add"))),
      h("div.tabbed-action-list-filter-slot"),
      h("button.tabbed-action-list-tabbar-action.align-end", { "data-id": "comparison", "aria-label": "Compare Models (⌥⌘M)", "aria-pressed": "false" }, h("span.codicon.codicon-compare")),
      h("button.tabbed-action-list-tabbar-action.align-end", { "data-id": "search", "aria-label": "Search Models", title: "Search Models", "aria-pressed": "false" }, h("span.codicon.codicon-search")));
    const header = notice !== null ? h("div.action-list-header", null,
      h("span.action-list-header-icon.codicon.codicon-info", { "aria-hidden": "true" }),
      h("span.action-list-header-text", null, !notice || notice === "true" ? pickers.data.sessionModelNotice : notice),
      h("span.action-list-header-dismiss", { tabindex: "0", role: "button", "aria-label": "Dismiss", onclick: () => this.removeAttribute("notice") }, h("div.codicon.codicon-close"))) : null;
    const detailsId = this.attr("details");
    const detailsModel = detailsId ? pickers.model(detailsId, harness) : null;
    const main = h("div.tabbed-action-list-main", detailsModel ? { inert: "", "aria-hidden": "true", style: "width: 320px;" } : null,
      h("div.tabbed-action-list-body", null, h("div.tabbed-action-list-body-content", null, tabbar, header, built.actionList)),
      h("div.tabbed-action-list-footer", null,
        h("a.monaco-button.secondary.monaco-text-button", {
          tabindex: "0", role: "button", "aria-label": "Send Query to Multiple Models (⌥⌘M)", "aria-disabled": "false",
          style: "color: var(--vscode-button-secondaryForeground); background-color: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-button-secondaryBorder);",
        }, "Send Query to Multiple Models (⌥⌘M)")));
    this._main = main;
    const widget = h("div.action-widget.chat-model-picker-widget.action-widget-animated" + (detailsModel ? ".showing-details" : ""), { style: "width: 320px;" }, main, detailsModel ? this.renderDetails(detailsModel) : null);
    return [widget, h("div.context-view-block", {
      style: "position: fixed; cursor: initial; left: 0px; top: 0px; width: 100%; height: 100%; z-index: -1;",
      onclick: () => this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true })),
    })];
  }
  summaryOf(m) {
    const config = (this._config || {})[m.id] || {};
    const merged = JSON.parse(JSON.stringify(m));
    if (config.effort && merged.effort) merged.effort.value = config.effort;
    if (config.context && merged.context && !merged.context.max) merged.context.value = config.context;
    return ds.chatPickers.summary(merged);
  }
  renderDetails(m) {
    const h = ds.h;
    const config = ((this._config = this._config || {})[m.id] = this._config[m.id] || {});
    const descriptions = { ...ds.chatPickers.data.effortDescriptions, ...(m.effortDescriptions || {}) };
    const segmented = (name, key, options, value, describe) => h("div.chat-model-card-section", null,
      h("div.chat-model-card-section-heading", null, h("div.chat-model-card-section-title", null, name)),
      h("div.monaco-custom-radio.segmented.selection-indicator-ready", { role: "radiogroup", "aria-label": name },
        h("div.monaco-radio-selection", { "aria-hidden": "true" }),
        options.map((option, i) => {
          const active = option === value;
          const description = describe && describe(option, i);
          return h("a.monaco-button.monaco-text-button" + (active ? ".active" : ""), {
            tabindex: active ? "0" : "-1", role: "radio", "aria-label": description ? `${option}, ${description}` : undefined, title: description || undefined,
            "aria-disabled": "false", "aria-checked": String(active),
            onclick: () => { config[key] = option; this.update(); this.dispatchEvent(new CustomEvent("configure", { bubbles: true, detail: { model: m.id, [key]: option } })); },
          }, h("span", { "data-label": option }, option));
        })));
    const sections = [];
    if (m.effort && m.effort.options.length > 1) sections.push(segmented("Effort Level", "effort", m.effort.options, config.effort || m.effort.value, (o) => descriptions[o]));
    if (m.context && m.context.options && m.context.options.length > 1) sections.push(segmented("Context Size", "context", m.context.options, config.context || m.context.value, (o, i) => i === 0 ? "Default" : "Longer sessions"));
    if (m.speed) sections.push(segmented("Speed", "speed", m.speed.options, config.speed || m.speed.value));
    if (m.pricing) {
      const id = "chat-model-card-pricing-" + m.id;
      const open = !!config.pricingOpen;
      sections.push(h("div.chat-model-card-section.chat-model-card-pricing.collapsible", null,
        h("button.chat-model-card-pricing-toggle", { type: "button", "aria-controls": id, "aria-expanded": String(open), onclick: () => { config.pricingOpen = !open; this.update(); } },
          h("span.chat-model-card-pricing-chevron.codicon.codicon-chevron-" + (open ? "down" : "right"), { "aria-hidden": "true" }),
          h("span.chat-model-card-section-title", null, "Pricing details"),
          m.cost ? h("span.chat-model-card-badge" + (ds.chatPickers.isHighCost(m) ? ".high-cost" : ""), null, m.cost) : null),
        h("div.chat-model-card-pricing-body" + (open ? ".expanded" : ""), { id, inert: open ? undefined : "", "aria-hidden": open ? undefined : "true" },
          h("div.chat-model-card-pricing-body-clip", null,
            h("div.chat-model-card-pricing-body-content", null,
              h("div.chat-model-card-pricing-caption", null, "Credits per 1M tokens"),
              Object.entries(m.pricing).map(([label, value]) => h("div.chat-model-card-pricing-row", null,
                h("span.chat-model-card-pricing-label", null, label), h("span.chat-model-card-pricing-value", null, String(value)))))))));
    }
    const viewport = h("div.tabbed-action-list-details-viewport", { style: "overflow: hidden;" }, h("div.tabbed-action-list-details-content", null, h("div.chat-model-card", null, sections)));
    this._viewport = viewport;
    return h("div.tabbed-action-list-details", { role: "dialog", "aria-label": m.name + " Details", tabindex: "-1" },
      h("div.tabbed-action-list-details-header", null,
        h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Back to Models" },
          h("li.action-item", { role: "presentation" }, h("a.action-label.codicon.codicon-arrow-left", { role: "button", "aria-label": "Back to Models (⌃-)", tabindex: "0", onclick: () => this.removeAttribute("details") })))),
        h("div.chat-model-card-header", null,
          h("div.chat-model-card-name", null, m.name),
          m.badge && !m.warning ? h("span.chat-model-card-badge", null, m.badge) : null,
          h("div.chat-model-card-actions", null, h("div.monaco-action-bar", null, h("ul.actions-container", { role: "toolbar", "aria-label": "Model Actions" },
            h("li.action-item", { role: "presentation" }, h("a.action-label.codicon.codicon-pin", { role: "button", "aria-label": "Pin Model", "aria-pressed": "false", tabindex: "0" }))))))),
      h("div.monaco-scrollable-element.mac", { role: "presentation", style: "position: relative; overflow: hidden;" },
        viewport,
        h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 310px; height: 0px; left: 0px; bottom: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 10px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 310px;" })),
        h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 10px; right: 0px; top: 0px;" }, h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 10px; transform: translate3d(0px, 0px, 0px); contain: strict;" })),
        h("div.shadow"), h("div.shadow"), h("div.shadow")));
  }
  updated() {
    const built = this._built;
    if (!built) return;
    // TabbedActionListWidget: page height = min(400, max(main height, header + content)); the viewport is that minus the header.
    if (this._viewport) {
      const header = this._viewport.closest(".tabbed-action-list-details").querySelector(".tabbed-action-list-details-header");
      const content = this._viewport.firstElementChild;
      const page = Math.min(400, Math.max(this._main.offsetHeight, header.offsetHeight + content.offsetHeight));
      const height = Math.max(0, page - header.offsetHeight);
      this._viewport.style.height = height + "px";
      const vertical = this._viewport.parentElement.querySelector(".scrollbar.vertical");
      vertical.style.height = height + "px";
      vertical.firstElementChild.style.height = height + "px";
    }
    for (const group of this.querySelectorAll(".monaco-custom-radio.segmented")) {
      const active = group.querySelector(".monaco-button.active");
      const selection = group.querySelector(".monaco-radio-selection");
      if (active && selection) Object.assign(selection.style, { width: active.offsetWidth + "px", height: active.offsetHeight + "px", transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)` });
    }
    if (this._wired !== built.listEl) {
      this._wired = built.listEl;
      ds.actionList.wire(this, () => this._items, built.listEl, built.rowsEl, built.height, built.total);
    }
    if (this.reposition) this.reposition();
  }
}
ds.define("vsc-chat-model-list", ChatModelList);

/** Open the model picker popup for a model picker button (options: harness, model, details, notice, onSelect, onConfigure). */
ds.openModelList = (anchor, options) => {
  ds.actionList.close();
  const root = anchor.closest("vsc-workbench") || document.body;
  const view = document.createElement("vsc-chat-model-list");
  view.setAttribute("harness", options.harness || "copilot");
  view.setAttribute("model", options.model);
  if (options.details) view.setAttribute("details", options.details);
  if (options.notice) view.setAttribute("notice", options.notice);
  view.style.visibility = "hidden";
  const close = (refocus) => {
    if (!view.isConnected) return;
    view.remove();
    anchor.setAttribute("aria-expanded", "false");
    if (refocus) anchor.focus();
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (view.hasAttribute("details") && !options.details) view.removeAttribute("details"); else close(true); } };
  document.addEventListener("keydown", onKey, true);
  view.reposition = () => ds.actionList.place(view, anchor, "above");
  // `dismiss` with { refocus: false } closes it without moving focus (e.g. when the page scrolls).
  view.addEventListener("dismiss", (e) => close(!(e.detail && e.detail.refocus === false)));
  view.addEventListener("select", (e) => {
    const item = e.detail.item;
    if (item.id === "section:other") { view.toggleAttribute("expanded"); return; }
    if (item.data && item.data.model) { options.onSelect(item.data.model, view._config && view._config[item.data.model.id]); close(true); }
  });
  view.addEventListener("toolbar", (e) => { if (e.detail.item.data) view.setAttribute("details", e.detail.item.data.model.id); });
  view.addEventListener("configure", (e) => options.onConfigure && options.onConfigure(e.detail, view._config[e.detail.model]));
  root.append(view);
  anchor.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => { view.reposition(); view.style.visibility = ""; (view.querySelector(".tabbed-action-list-details") || view.querySelector(".monaco-list")).focus(); });
  return view;
};
