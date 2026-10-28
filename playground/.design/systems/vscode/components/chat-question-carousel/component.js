// Mirrors ChatQuestionCarouselPart (src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatQuestionCarouselPart.ts):
// header (optional carousel message, title, skip and collapse buttons), scrollable answer area (optional detailed message,
// option list or text input, freeform answer), validation slot and footer (submit hint and Submit button).
// Events: "submit" ({ question, selected: string[], freeform?: string, answer }) and "skip".
const CQC_IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const CQC_BLOCK = /^(p|h[1-6]|ul|ol|pre|blockquote|div|table)$/;

class ChatQuestionCarousel extends ds.Element {
  static hostClass = "chat-question-carousel-container chat-card-large";
  static props = ["question", "message", "multi", "required", "no-freeform", "no-skip", "collapsed", "placeholder", "submit-label", "submit-hint"];

  options() {
    return this.slotted("").filter((n) => n.nodeType === 1 && n.localName === "vsc-chat-question-option");
  }

  questionText() {
    return this.attr("question", this.slotted("question").map((n) => n.textContent).join("").trim());
  }

  /** Renders slotted rich text (or plain text) like the product's markdown renderer: `.rendered-markdown > p`. */
  markdown(slotName, text, suffix) {
    const h = ds.h;
    const nodes = this.slotted(slotName).flatMap((n) => (n.nodeType === 1 && n.hasAttribute("slot") ? [...n.childNodes] : [n])).map((n) => n.cloneNode(true));
    if (!nodes.length && text) nodes.push(document.createTextNode(text));
    const block = nodes.some((n) => n.nodeType === 1 && CQC_BLOCK.test(n.localName));
    const content = block ? nodes : [h("p", null, nodes, suffix)];
    return h("div.rendered-markdown", null, content);
  }

  /** Single-select: select one option (-1 clears), like updateSelection in the part. */
  select(index) {
    this.options().forEach((o, i) => o.toggleAttribute("selected", i === index));
  }

  submit() {
    const selected = this.options().filter((o) => o.hasAttribute("selected") && o.getAttribute("selected") !== "false").map((o) => o.getAttribute("label") || o.textContent.trim());
    const field = this.querySelector(".chat-question-freeform-textarea, .monaco-inputbox input");
    const freeform = field && field.value.trim() ? field.value.trim() : undefined;
    this.dispatchEvent(new CustomEvent("submit", { bubbles: true, detail: { question: this.questionText(), selected, freeform, answer: freeform || selected.join(", ") } }));
  }

  updated() {
    requestAnimationFrame(() => this.layout());
  }

  /** Port of ChatQuestionCarouselPart.layoutInputScrollable: pins the answer area to its content's scroll height. */
  layout() {
    const content = this.querySelector(":scope > .chat-question-carousel-content");
    const scrollable = content && content.querySelector(":scope > .chat-question-input-scrollable");
    const inner = scrollable && scrollable.firstElementChild;
    if (!inner || !this.isConnected) return;
    for (const el of [scrollable, inner]) { el.style.height = ""; el.style.maxHeight = ""; }
    if (this.flag("collapsed")) return;
    const cs = getComputedStyle(content);
    const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const others = [...content.children].filter((c) => c !== scrollable).reduce((sum, c) => sum + c.offsetHeight, 0);
    const available = Math.floor(content.clientHeight - padding - others);
    const px = Math.max(0, Math.min(available, inner.scrollHeight)) + "px";
    for (const el of [scrollable, inner]) { el.style.height = px; el.style.maxHeight = px; }
    // DomScrollableElement sizes its (invisible) scrollbars from the viewport: vertical = full height, horizontal = width minus the 10px vertical bar.
    const vertical = scrollable.querySelector(":scope > .scrollbar.vertical");
    const horizontal = scrollable.querySelector(":scope > .scrollbar.horizontal");
    const width = Math.max(0, scrollable.clientWidth - 10) + "px";
    if (vertical) { vertical.style.height = px; vertical.firstElementChild.style.height = px; }
    if (horizontal) { horizontal.style.width = width; horizontal.firstElementChild.style.width = width; }
  }

  render() {
    const h = ds.h;
    const multi = this.flag("multi");
    const collapsed = this.flag("collapsed");
    const options = this.options();
    const question = this.questionText();
    const message = this.attr("message", "");

    if (!this.__wired) {
      this.__wired = true;
      this.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.submit(); }
      });
    }
    this.setClasses({ "chat-question-carousel-collapsed": collapsed });
    this.setAttribute("tabindex", "0");
    this.setAttribute("role", "region");
    this.setAttribute("aria-roledescription", "chat question");
    this.setAttribute("aria-label", "Chat question: " + question);

    const collapseLabel = collapsed ? "Expand Questions" : "Collapse Questions";
    const header = h("div.chat-question-header-row", null,
      message || this.hasSlot("message") ? h("div.chat-question-carousel-message", null, this.markdown("message", message)) : null,
      h("div.chat-question-title-row.chat-card-header", null,
        question || this.hasSlot("question") ? h("div.chat-question-title.chat-card-title", { "aria-label": question }, this.markdown("question", question, this.flag("required") ? " *" : null)) : null,
        h("div.chat-question-header-actions", null,
          this.flag("no-skip") ? null : h("div.chat-question-close-container", null,
            h("a.monaco-button.secondary.chat-card-icon-button.monaco-text-button.chat-question-close", {
              tabindex: "0", role: "button", "aria-disabled": "false", "aria-label": "Skip all questions",
              onclick: (e) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent("skip", { bubbles: true })); },
            }, ds.icon("close-small"))),
          h("a.monaco-button.secondary.chat-card-icon-button.chat-question-collapse-toggle.monaco-text-button", {
            tabindex: "0", role: "button", "aria-disabled": "false", "aria-label": collapseLabel, "aria-expanded": String(!collapsed),
            onclick: (e) => { e.stopPropagation(); this.toggleAttribute("collapsed", !collapsed); },
          }, ds.icon(collapsed ? "chevron-up" : "chevron-down")))));

    const input = h("div.chat-question-input-container", { style: "overflow: hidden;" });
    if (this.hasSlot("detail")) input.append(h("div.chat-question-detailed-message", null, this.markdown("detail", "")));

    if (options.length) {
      const list = h("div.chat-question-list", { role: "listbox", "aria-label": question, tabindex: "0" });
      options.forEach((o, i) => { o.setAttribute("index", String(i + 1)); o.toggleAttribute("multi", multi); list.append(o); });
      input.append(list);

      let textarea = null;
      if (!this.flag("no-freeform")) {
        textarea = h("textarea.chat-question-freeform-textarea", { placeholder: "Enter custom answer", rows: "1" });
        textarea.value = this.__freeform || "";
        textarea.addEventListener("input", () => {
          this.__freeform = textarea.value;
          textarea.style.height = "auto";
          textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
          this.layout();
          // Typing a custom answer clears the selected option.
          if (!multi && textarea.value.length > 0) this.select(-1);
        });
        input.append(h("div.chat-question-freeform", null, h("div.chat-question-freeform-number", null, String(options.length + 1)), textarea));
      }

      list.addEventListener("click", (e) => {
        const item = e.target.closest("vsc-chat-question-option");
        if (!item) return;
        e.preventDefault();
        if (multi) { item.toggleAttribute("selected", !item.hasAttribute("selected")); return; }
        // Selecting an option clears the custom answer and submits (single question), like the product.
        this.select(options.indexOf(item));
        this.__freeform = "";
        if (textarea) textarea.value = "";
        this.submit();
      });
      list.addEventListener("keydown", (e) => {
        const current = options.findIndex((o) => o.hasAttribute("selected"));
        if (!multi && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          this.select(Math.max(0, Math.min(options.length - 1, current + (e.key === "ArrowDown" ? 1 : -1))));
        } else if ((e.key === "Enter" || e.key === " ") && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          this.submit();
        } else if (/^[1-9]$/.test(e.key)) {
          const n = Number(e.key) - 1;
          if (n < options.length) {
            e.preventDefault();
            if (multi) options[n].toggleAttribute("selected", !options[n].hasAttribute("selected")); else this.select(n);
          } else if (textarea && n === options.length) {
            e.preventDefault();
            if (!multi) this.select(-1);
            textarea.focus();
          }
        }
      });
    } else {
      const field = h("input.input" + (this.__freeform ? "" : ".empty"), {
        autocorrect: "off", autocapitalize: "off", spellcheck: "false", type: "text", wrap: "off",
        placeholder: this.attr("placeholder", "Enter your answer"),
        style: "background-color: inherit; color: var(--vscode-input-foreground);",
      });
      field.value = this.__freeform || "";
      field.addEventListener("input", () => { this.__freeform = field.value; field.classList.toggle("empty", !field.value); });
      field.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); this.submit(); } });
      input.append(h("div.monaco-inputbox.idle", { style: "background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent);" },
        h("div.ibwrapper", null, field)));
    }

    // The product wraps the answer area in a DomScrollableElement; its scrollbars stay invisible until scrolling.
    const scrollable = h("div.monaco-scrollable-element.mac.chat-question-input-scrollable", { role: "presentation", style: "position: relative; overflow: hidden;" },
      input,
      h("div.invisible.scrollbar.horizontal", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 100%; height: 0px; left: 0px; bottom: 0px;" },
        h("div.slider", { style: "position: absolute; top: 0px; left: 0px; height: 10px; transform: translate3d(0px, 0px, 0px); contain: strict; width: 100%;" })),
      h("div.invisible.scrollbar.vertical", { role: "presentation", "aria-hidden": "true", style: "position: absolute; width: 10px; height: 100%; right: 0px; top: 0px;" },
        h("div.slider", { style: "position: absolute; top: 0px; left: 0px; width: 10px; transform: translate3d(0px, 0px, 0px); contain: strict; height: 100%;" })),
      h("div.shadow"), h("div.shadow"), h("div.shadow"));

    return [
      h("div.chat-question-carousel-content", null, header, scrollable, h("div.chat-question-validation-message", { style: "display: none;" })),
      h("div.chat-question-footer-row", null,
        h("div.chat-question-footer-left.chat-question-carousel-nav", { role: "navigation", "aria-label": "Question navigation" }),
        h("div.chat-question-footer-right", null,
          h("span.chat-question-submit-hint", null, this.attr("submit-hint", CQC_IS_MAC ? "\u2318\u23CE to submit" : "Ctrl+Enter to submit")),
          h("a.monaco-button.chat-question-submit-button.monaco-text-button", {
            tabindex: "0", role: "button", "aria-disabled": "false",
            style: "color: var(--vscode-button-foreground); background-color: var(--vscode-button-background); border: 1px solid var(--vscode-button-border);",
            onclick: () => this.submit(),
          }, this.attr("submit-label", "Submit")))),
    ];
  }
}
ds.define("vsc-chat-question-carousel", ChatQuestionCarousel);
