// Mirrors ChatQuestionCarouselPart's conversation summary (answerPresentation: 'conversation', isUsed: true).
class ChatQuestionSummary extends ds.Element {
  static hostClass = "chat-question-carousel-container chat-card-large chat-question-carousel-conversation chat-question-carousel-used";
  static props = ["question", "answer"];
  render() {
    const h = ds.h;
    const question = this.attr("question", "");
    const answer = this.attr("answer", "");
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", "Answered chat questions");
    return h("div.chat-question-carousel-summary.chat-question-carousel-conversation-summary", null,
      h("div.chat-question-summary-item", null,
        h("div.chat-question-summary-question", null,
          h("span.chat-question-summary-prefix", null, "Question:"), " ",
          h("span.chat-question-summary-question-value", null, question)),
        h("div.chat-question-summary-decision", null,
          h("div.chat-used-context.chat-collapsible-content-animatable.chat-collapsible-content-animated.chat-used-context-collapsed.chat-question-answer-expandable.chat-question-answer-collapsible", null,
            h("div.chat-used-context-label", null,
              h("a.monaco-button.monaco-icon-button.monaco-text-button", { role: "button", "aria-label": "Answered: " + answer },
                h("div"),
                h("div.monaco-button-mdlabel", null,
                  h("span.chat-question-summary-answer-icon.codicon.codicon-comment-compact"),
                  h("span.chat-question-summary-prefix", null, "Answered:"), " ",
                  h("span.chat-question-summary-answer-value", null, answer)),
                h("span.chat-collapsible-hover-chevron.codicon.codicon-chevron-right-compact"))),
            h("div.chat-collapsible-content-animation", null, h("div.chat-collapsible-content-animation-inner"))))));
  }
}
ds.define("vsc-chat-question-summary", ChatQuestionSummary);
