/*
 * Action widget dropdown (src/vs/platform/actionWidget/browser/actionList.ts), the list every Agents window
 * picker opens: environment, workspace, harness, mode and permissions, approvals, … Rows are 24px (48px with a
 * detail line), separators 8px, laid out absolutely like a monaco list; the width is measured from the widest
 * row and clamped between min-width and max-width, as ActionList.computeMaxWidth does.
 *
 * ds.actionList.open(anchor, options) opens one anchored to an element (below it when it fits, else above) and
 * returns the <vsc-action-list>; pickers use it to show their real items.
 */
ds.actionList = (() => {
  const h = ds.h;
  const ROW = 24, DETAIL = 48, SEPARATOR = 8;
  const heightOf = (item) => item.type === "separator" ? SEPARATOR : item.detail ? (item.detailHeight || DETAIL) : ROW;
  const isAction = (item) => item && item.type !== "separator" && !item.disabled;

  function toolbar(item) {
    const actions = item.toolbar || [];
    if (!actions.length) return h("div.action-list-item-toolbar");
    return h("div.action-list-item-toolbar", null,
      h("div.monaco-action-bar", null,
        h("ul.actions-container", { role: "toolbar" }, actions.map((action, i) =>
          h("li.action-item", { role: "presentation" },
            h("a.action-label" + (action.icon ? ".codicon.codicon-" + action.icon : ""), {
              role: "button", "aria-label": action.ariaLabel || action.label, "aria-haspopup": action.popup, tabindex: action.tabindex ?? "0", "data-toolbar": String(i),
            }, action.icon ? null : action.label))))));
  }

  function keybinding(item) {
    if (!item.keybinding) return h("div.monaco-keybinding");
    return h("div.monaco-keybinding", null, item.keybinding.split(/(?=[⌘⌥⇧⌃])|\+/).filter(Boolean).map((k) => h("span.monaco-keybinding-key", null, k)));
  }

  /** One `.monaco-list-row`, structured like ActionItemRenderer's template. */
  function row(item, top, index, options) {
    const height = heightOf(item);
    const style = `top: ${top}px; height: ${height}px; line-height: ${height}px;`;
    if (item.type === "separator") {
      return h("div.monaco-list-row.separator", { role: "separator", "aria-selected": "false", "data-index": index, style },
        h("span"), h("span.action-item-additional-badges", { "aria-hidden": "true", style: "display: none;" }), h("span.detail", { style: "display: none;" }));
    }
    const classes = ["action",
      item.custom ? "action-list-custom" : "",
      item.toolbar && item.toolbar.length ? "has-toolbar" : "",
      item.detail ? "has-detail" : "",
      item.toggle !== undefined ? "has-standalone-toggle" : "",
      item.class || "",
      item.disabled ? "disabled" : "",
      index === options.focused ? "focused" : ""].filter(Boolean).join(" ");
    const role = item.role || options.itemRole || "option";
    const icon = item.icon === undefined ? "blank" : item.icon;
    return h("div.monaco-list-row", {
      class: classes, role, "data-index": index,
      "aria-checked": role === "option" ? undefined : String(!!item.checked),
      "aria-selected": role === "option" ? undefined : "false",
      "aria-expanded": item.expanded === undefined ? undefined : String(!!item.expanded),
      "aria-disabled": item.disabled ? "true" : undefined,
      "aria-label": item.ariaLabel || [item.label, item.badge, item.description, item.detail].filter(Boolean).join(", "),
      title: item.hover ?? "", style,
    },
      icon ? h("div.codicon.codicon-" + icon) : h("div.codicon"),
      h("span.action-list-label-icon", { "aria-hidden": "true", style: "display: none;" }),
      h("span.title", null, item.label),
      h("span.action-item-badge", { "aria-hidden": "true", style: item.badge ? "" : "display: none;" }, item.badge || null),
      h("span.action-item-additional-badges", { "aria-hidden": "true", style: "display: none;" }),
      h("span.description", { style: item.description ? "display: inline;" : "display: none;" }, item.description || null),
      h("span.group-title", { style: "display: none;" }),
      h("span.detail", { style: item.detail ? "" : "display: none;" }, item.detail || null),
      keybinding(item),
      toolbar(item),
      h("div.action-list-submenu-indicator", { style: "display: none;" }),
      h("div.action-list-item-inline-toggle", { style: item.toggle === undefined ? "display: none;" : undefined },
        item.toggle === undefined ? null : h("button.monaco-switch" + (item.toggle ? ".checked" : ""), {
          type: "button", role: "switch", "aria-label": item.toggleLabel || item.label, "aria-checked": String(!!item.toggle),
        }, h("div.monaco-switch-thumb"))));
  }

  const scrollbar = (dir, style, slider) => h("div.invisible.scrollbar." + dir, { role: "presentation", "aria-hidden": "true", style }, h("div.slider", { style: slider }));

  /** The `.actionList > .monaco-list` subtree for a set of items. */
  function list(items, options = {}) {
    const total = items.reduce((sum, item) => sum + heightOf(item), 0);
    const height = Math.min(total, options.maxHeight || Infinity);
    let top = 0;
    const rows = items.map((item, i) => { const el = row(item, top, i, options); top += heightOf(item); return el; });
    const rowsEl = h("div.monaco-list-rows", { style: `transform: translate3d(0px, 0px, 0px); overflow: hidden; contain: strict; height: ${total}px; left: 0px; top: 0px;` }, rows);
    const focusedId = options.focused === undefined || options.focused < 0 ? undefined : "list_id_7_" + options.focused;
    const listEl = h("div.monaco-list.list_id_7.mouse-support.selection-none" + (focusedId ? ".element-focused" : ""), {
      tabindex: "0", role: options.role || "listbox", "aria-label": options.label, "aria-multiselectable": "true", "aria-activedescendant": focusedId,
    },
      h("div.monaco-scrollable-element.mac", { role: "presentation", style: "position: relative; overflow: hidden;" },
        rowsEl,
        scrollbar("horizontal", "position: absolute; width: 0px; height: 10px; left: 0px; bottom: 0px;", "position: absolute; top: 0px; left: 0px; height: 10px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 0px;"),
        scrollbar("vertical", `position: absolute; width: 10px; height: ${height}px; right: 0px; top: 0px;`, `position: absolute; top: 0px; left: 0px; width: 10px; transform: translate3d(0px, 0px, 0px); contain: strict; height: ${height * height / Math.max(total, 1)}px;`),
        h("div.shadow"), h("div.shadow"), h("div.shadow")));
    const actionList = h("div.actionList" + (options.listClass ? "." + options.listClass.split(/\s+/).join(".") : ""), { style: `height: ${height}px;` },
      h("div.action-list-submenu-panel.action-widget", { tabindex: "-1", style: "display: none;" }),
      listEl);
    return { actionList, listEl, rowsEl, height, total };
  }

  /** Width of the widest row (ActionList._measureItemWidths), clamped to [min, max]. */
  function measure(rowsEl, items, min = 0, max = Infinity) {
    let widest = 0;
    for (const el of rowsEl.children) {
      const item = items[+el.getAttribute("data-index")];
      if (!item || item.type === "separator") continue;
      el.style.width = "auto";
      const toolbarEl = el.querySelector(".action-list-item-toolbar");
      const extra = !item.detail && item.toolbar && item.toolbar.length ? (item.toolbarLabels ? toolbarEl.scrollWidth + 16 : item.toolbar.length * 22 + 16) : 0;
      widest = Math.max(widest, el.getBoundingClientRect().width + extra);
      el.style.width = "";
    }
    return Math.ceil(Math.min(Math.max(widest, min), max));
  }

  /** Keyboard, hover and wheel behavior shared by every action list. */
  function wire(host, getItems, listEl, rowsEl, viewHeight, totalHeight) {
    let scrollTop = 0;
    const rows = () => [...rowsEl.children];
    const focusIndex = () => rows().findIndex((r) => r.classList.contains("focused"));
    const scrollTo = (value) => {
      scrollTop = Math.max(0, Math.min(value, totalHeight - viewHeight));
      rowsEl.style.top = -scrollTop + "px";
      const slider = listEl.querySelector(".scrollbar.vertical .slider");
      if (slider) slider.style.transform = `translate3d(0px, ${scrollTop * viewHeight / totalHeight}px, 0px)`;
    };
    const setFocus = (index, reveal) => {
      rows().forEach((r) => r.classList.toggle("focused", +r.getAttribute("data-index") === index));
      listEl.classList.toggle("element-focused", index >= 0);
      if (index >= 0) listEl.setAttribute("aria-activedescendant", "list_id_7_" + index); else listEl.removeAttribute("aria-activedescendant");
      if (reveal && index >= 0) {
        const el = rows()[index];
        const top = parseFloat(el.style.top), bottom = top + el.offsetHeight;
        if (top < scrollTop) scrollTo(top); else if (bottom > scrollTop + viewHeight) scrollTo(bottom - viewHeight);
      }
    };
    const move = (delta) => {
      const items = getItems();
      let i = focusIndex();
      for (let n = 0; n < items.length; n++) {
        i = (i + delta + items.length) % items.length;
        if (isAction(items[i])) return setFocus(i, true);
      }
    };
    const fire = (type, detail) => host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
    listEl.addEventListener("mouseover", (e) => {
      const r = e.target.closest(".monaco-list-row");
      if (r && r.classList.contains("action") && !r.classList.contains("disabled")) setFocus(+r.getAttribute("data-index"));
    });
    listEl.addEventListener("click", (e) => {
      const r = e.target.closest(".monaco-list-row"); if (!r) return;
      const index = +r.getAttribute("data-index"), item = getItems()[index];
      if (!isAction(item)) return;
      const action = e.target.closest("[data-toolbar]");
      if (action) { e.stopPropagation(); return fire("toolbar", { item, index, action: item.toolbar[+action.getAttribute("data-toolbar")] }); }
      if (e.target.closest(".monaco-switch")) { e.stopPropagation(); return fire("toggle", { item, index, checked: !item.toggle }); }
      fire("select", { item, index });
    });
    listEl.addEventListener("keydown", (e) => {
      const items = getItems(), item = items[focusIndex()];
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); setFocus(items.findIndex(isAction), true); }
      else if (e.key === "End") { e.preventDefault(); setFocus(items.length - 1 - [...items].reverse().findIndex(isAction), true); }
      else if ((e.key === "Enter" || e.key === " ") && isAction(item)) { e.preventDefault(); fire(item.toggle !== undefined && e.key === " " ? "toggle" : "select", { item, index: focusIndex(), checked: !item.toggle }); }
      else if (e.key === "ArrowRight" && item && item.expanded === false) { e.preventDefault(); fire("select", { item, index: focusIndex() }); }
      else if (e.key === "ArrowLeft" && item && item.expanded === true) { e.preventDefault(); fire("select", { item, index: focusIndex() }); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fire("dismiss", {}); }
    });
    listEl.addEventListener("wheel", (e) => { if (totalHeight > viewHeight) { e.preventDefault(); scrollTo(scrollTop + e.deltaY); } }, { passive: false });
    scrollTo(0);
    setFocus(focusIndex(), true);
  }

  /** Position a context view next to its anchor inside the workbench: below when it fits, otherwise above. */
  function place(view, anchor, preferred) {
    // The anchor can be re-rendered while its list stays open (e.g. toggling sandboxing); keep the last position.
    if (!anchor.isConnected || !view.firstElementChild) return;
    const root = anchor.closest("vsc-workbench") || document.body;
    const r = anchor.getBoundingClientRect(), w = root.getBoundingClientRect();
    const box = view.firstElementChild.getBoundingClientRect();
    const below = r.bottom - w.top, above = r.top - w.top;
    const fitsBelow = below + box.height <= root.clientHeight - 4;
    const placeBelow = preferred === "above" ? above - box.height < 4 : (preferred === "below" || fitsBelow || above < box.height);
    view.classList.toggle("bottom", placeBelow);
    view.classList.toggle("top", !placeBelow);
    view.style.top = Math.round(placeBelow ? below : Math.max(4, above - box.height)) + "px";
    view.style.left = Math.round(Math.max(4, Math.min(r.left - w.left, root.clientWidth - box.width - 4))) + "px";
  }

  let current = null;
  /**
   * Open a <vsc-action-list> anchored to `anchor`. options: items, label, role, itemRole, widgetClass, listClass,
   * minWidth, maxWidth, maxHeight, position ("below" | "above"), onSelect(item, view) (return true to keep it open,
   * e.g. after expanding a section), onToolbar(item, action, view), onToggle(item, checked, view), onClose().
   */
  function open(anchor, options) {
    close();
    const root = anchor.closest("vsc-workbench") || document.body;
    const view = document.createElement("vsc-action-list");
    view.items = options.items;
    for (const [attr, key] of [["label", "label"], ["role", "role"], ["item-role", "itemRole"], ["widget-class", "widgetClass"], ["list-class", "listClass"], ["min-width", "minWidth"], ["max-width", "maxWidth"], ["max-height", "maxHeight"]])
      if (options[key] !== undefined) view.setAttribute(attr, options[key]);
    view.style.visibility = "hidden";
    const state = { view, anchor };
    const finish = (refocus) => {
      if (current !== state) return;
      current = null;
      view.remove();
      anchor.setAttribute("aria-expanded", "false");
      if (refocus) anchor.focus();
      if (options.onClose) options.onClose();
    };
    state.close = finish;
    current = state;
    view.reposition = () => place(view, anchor, options.position);
    view.addEventListener("select", (e) => { if (!(options.onSelect && options.onSelect(e.detail.item, view) === true)) finish(true); });
    view.addEventListener("toolbar", (e) => options.onToolbar && options.onToolbar(e.detail.item, e.detail.action, view));
    view.addEventListener("toggle", (e) => options.onToggle && options.onToggle(e.detail.item, e.detail.checked, view));
    view.addEventListener("dismiss", () => finish(true));
    root.append(view);
    anchor.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => { view.reposition(); view.style.visibility = ""; view.querySelector(".monaco-list")?.focus(); });
    return view;
  }
  function close() { if (current) current.close(false); }

  return { heightOf, row, list, measure, wire, place, open, close, get current() { return current; } };
})();

class ActionList extends ds.Element {
  static hostClass = "context-view monaco-component";
  static props = ["items", "label", "role", "item-role", "widget-class", "list-class", "width", "min-width", "max-width", "max-height", "position", "x", "y"];
  get items() {
    if (this._items) return this._items;
    try { return JSON.parse(this.getAttribute("items") || "[]"); } catch { return []; }
  }
  set items(value) { this._items = value; if (this.__slots && this.isConnected) this.update(); }
  render() {
    const h = ds.h;
    const items = this.items;
    const above = this.attr("position", "below") === "above";
    this.setClasses({ bottom: !above, top: above, left: true });
    Object.assign(this.style, { position: "absolute", zIndex: "2575" });
    if (this.hasAttribute("x")) this.style.left = this.attr("x") + "px";
    if (this.hasAttribute("y")) this.style.top = this.attr("y") + "px";
    let focused = items.findIndex((item) => item.focused);
    if (focused < 0) focused = items.findIndex((item) => item.checked && item.type !== "separator");
    const maxHeight = Number(this.attr("max-height", "")) || undefined;
    const built = ds.actionList.list(items, { label: this.attr("label"), role: this.attr("role"), itemRole: this.attr("item-role"), listClass: this.attr("list-class"), focused, maxHeight });
    this._built = built;
    const widgetClass = this.attr("widget-class", "");
    this._widget = h("div.action-widget" + (widgetClass ? "." + widgetClass.split(/\s+/).join(".") : "") + ".action-widget-animated", { style: this.hasAttribute("width") ? `width: ${this.attr("width")}px;` : undefined }, built.actionList);
    return [this._widget, h("div.context-view-block", {
      style: "position: fixed; cursor: initial; left: 0px; top: 0px; width: 100%; height: 100%; z-index: -1;",
      onclick: () => this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true })),
    })];
  }
  updated() {
    const built = this._built;
    if (!built) return;
    if (!this.hasAttribute("width") && this.isConnected) {
      const width = ds.actionList.measure(built.rowsEl, this.items, Number(this.attr("min-width", "0")), Number(this.attr("max-width", "")) || Infinity);
      this._widget.style.width = width + "px";
    }
    ds.actionList.wire(this, () => this.items, built.listEl, built.rowsEl, built.height, built.total);
    if (this.reposition) this.reposition();
  }
}
ds.define("vsc-action-list", ActionList);
