// Minimal behavior for the VS Code chat composer prototype.
(() => {
  const workbench = document.querySelector(".monaco-workbench");
  const container = document.querySelector(".chat-input-container");
  const stack = document.querySelector(".chat-input-stack");
  const editor = document.querySelector(".dt-editor");
  const text = document.querySelector(".dt-editor-text");
  const placeholder = document.querySelector(".editorPlaceholder");
  const submitItem = document.querySelector(".chat-submit-button");
  const submitLabel = submitItem.querySelector(".action-label");

  // Platform class drives the workbench font, like VS Code's platform-specific styles.
  const platformName = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  const platform = /mac/i.test(platformName) ? "mac" : /win/i.test(platformName) ? "windows" : "linux";
  workbench.classList.remove("linux");
  workbench.classList.add(platform);

  // Theme: Dark 2026 (VS Code's default) unless ?theme=light. Ctrl/Cmd+K Ctrl/Cmd+T toggles, like the theme picker shortcut.
  let light = new URLSearchParams(location.search).get("theme") === "light";
  const applyTheme = () => {
    for (const el of [workbench, editor]) {
      el.classList.toggle("vs", light);
      el.classList.toggle("vs-dark", !light);
    }
    workbench.classList.toggle("vscode-theme-defaults-themes-2026-light-json", light);
    workbench.classList.toggle("vscode-theme-defaults-themes-2026-dark-json", !light);
  };
  applyTheme();
  let chordStarted = 0;
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "k") {
      chordStarted = Date.now();
      event.preventDefault();
    } else if (key === "t" && Date.now() - chordStarted < 2000) {
      chordStarted = 0;
      light = !light;
      applyTheme();
      event.preventDefault();
    }
  });

  // The model picker reserves its own measured width, as ModelPickerWidget does.
  const modelItem = document.querySelector(".model-picker-item");
  const modelName = modelItem.querySelector(".model-picker-name");
  const toolbar = document.querySelector(".chat-input-toolbar");
  const measure = () => {
    const width = modelName.getBoundingClientRect().width;
    modelItem.style.minWidth = `${width}px`;
    toolbar.style.setProperty("--vscode-toolbar-action-min-width", `${width}px`);
  };
  document.fonts.ready.then(measure);
  measure();

  const setFocused = (focused) => {
    container.classList.toggle("focused", focused);
    editor.classList.toggle("focused", focused);
    stack.classList.toggle("chat-input-stack-input-focused", focused);
  };
  text.addEventListener("focus", () => setFocused(true));
  text.addEventListener("blur", () => setFocused(false));

  // Clicking the frame (not a control) focuses the input, like ChatInputPart.
  container.addEventListener("mousedown", (event) => {
    if (event.target === text || event.target.closest(".action-item")) return;
    event.preventDefault();
    text.focus();
  });

  const update = () => {
    const value = text.textContent ?? "";
    placeholder.style.display = value.length ? "none" : "block";
    const canSubmit = value.trim().length > 0;
    submitItem.classList.toggle("disabled", !canSubmit);
    submitLabel.classList.toggle("disabled", !canSubmit);
    submitLabel.setAttribute("aria-disabled", String(!canSubmit));
  };

  const submit = () => {
    if (!(text.textContent ?? "").trim()) return;
    text.textContent = "";
    update();
    text.focus();
  };

  text.addEventListener("input", update);
  text.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
  });
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  submitLabel.addEventListener("click", (event) => {
    event.preventDefault();
    submit();
  });

  update();
})();
