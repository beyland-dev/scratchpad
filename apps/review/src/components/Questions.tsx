import { useEffect, useRef } from "preact/hooks";
import { Icon } from "../../../web/src/components/Icon.tsx";

const PANEL_ID = "questions-panel";

export function Attribution() {
  return <p class="attribution">Shared with Scratchpad</p>;
}

/** Shows or hides the questions panel (hidden when the review asks none). */
export function QuestionsToggle({
  questions,
  open,
  onOpen,
}: {
  questions: string[];
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <button
      type="button"
      id="questions-toggle"
      class="button ghost"
      aria-expanded={open}
      aria-controls={PANEL_ID}
      onClick={() => onOpen(!open)}
    >
      <Icon name="message" />
      <span class="label-wide">Questions</span>
    </button>
  );
}

/** A reminder of what the review asks: a side panel, or a bottom drawer on small screens. */
export function QuestionsPanel({
  questions,
  open,
  onOpen,
}: {
  questions: string[];
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) panel.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (questions.length === 0) return null;
  const close = () => {
    onOpen(false);
    document.getElementById("questions-toggle")?.focus();
  };
  return (
    <aside
      id={PANEL_ID}
      ref={panel}
      class="questions-panel"
      aria-labelledby="questions-panel-heading"
      tabIndex={-1}
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <div class="panel-head">
        <h2 id="questions-panel-heading">What we'd like feedback on</h2>
        <button
          type="button"
          class="button ghost icon-only"
          aria-label="Hide questions"
          title="Hide questions"
          onClick={close}
        >
          <Icon name="x" />
        </button>
      </div>
      <ol class="question-list">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
      <Attribution />
    </aside>
  );
}
