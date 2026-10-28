/*
 * Dictation / Voice Mode segmented toggle in the chat execute toolbar (ChatVoiceInputModeActionViewItem):
 * a reel of icon cells (mic, voice bars) with the listen and mute cells collapsed until Voice Mode starts.
 * Clicking a cell toggles its pressed state and fires `dictation` or `voice`.
 */
class ChatVoiceToggle extends ds.Element {
  static hostClass = "action-item monaco-segmented-icon-toggle-container chat-voice-input-mode-item";
  static props = ["dictation", "voice"];
  render() {
    const h = ds.h;
    this.setAttribute("role", "presentation");
    this.setAttribute("tabindex", "0");
    const listening = ds.themeOf(this) && ds.system.themes.find((t) => t.id === ds.themeOf(this))?.kind === "dark" ? "rgba(57, 148, 188, 0.7)" : "#0069cc";
    this.style.setProperty("--voice-color-listening", listening);
    const cell = (cls, label, pressed, content, event) => h("button.monaco-segmented-icon-toggle-cell.chat-voice-input-mode-cell." + cls, {
      type: "button", role: "button", "aria-label": label, "aria-pressed": String(pressed),
      onclick: event ? () => { this.toggleAttribute(event, !this.flag(event)); this.dispatchEvent(new CustomEvent(event, { bubbles: true, detail: { pressed: this.flag(event) } })); } : undefined,
    }, content);
    return h("div.monaco-segmented-icon-toggle.chat-voice-input-mode", null,
      h("div.monaco-segmented-icon-toggle-reel.chat-voice-input-mode-reel", null,
        cell("dictation", "Dictation (⌘I)", this.flag("dictation"), h("span.chat-voice-input-mode-icon.codicon.codicon-mic-compact"), "dictation"),
        cell("voice", "Voice Mode (⇧⌘Space)", this.flag("voice"), [
          h("span.chat-voice-input-mode-bars", null, [1, 2, 3, 4].map(() => h("span.chat-voice-input-mode-bar"))),
          h("span.chat-voice-input-mode-icon.chat-voice-input-mode-spinner.codicon.codicon-loading-compact"),
        ], "voice"),
        cell("listen.collapsed.muted", "Start Listening (⇧⌘Space)", false, h("span.chat-voice-input-mode-icon.codicon.codicon-person-voice-compact")),
        cell("mute.collapsed", "Mute Microphone (⇧⌘M)", false, h("span.chat-voice-input-mode-icon.codicon.codicon-mic-off-compact"))));
  }
}
ds.define("vsc-chat-voice-toggle", ChatVoiceToggle);
