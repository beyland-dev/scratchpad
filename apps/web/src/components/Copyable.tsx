import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { copyText } from "../util.ts";

export function useCopied(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  return [copied, copy];
}

/** True when the user is selecting text, so a click shouldn't be treated as "copy". */
function selectingText(): boolean {
  return Boolean(window.getSelection()?.toString());
}

/**
 * Wraps a code block so clicking anywhere on it copies `text`. A "Copy" pill appears on hover, and a
 * real button keeps it reachable by keyboard and screen readers.
 */
export function Copyable({
  text,
  children,
  class: className,
  inline = false,
}: {
  text: string;
  children: JSX.Element | JSX.Element[];
  class?: string;
  /** Compact variant for short values (token details). */
  inline?: boolean;
}) {
  const [copied, copy] = useCopied();
  return (
    <div
      class={["copyable", inline ? "inline" : "", copied ? "copied" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => !selectingText() && void copy(text)}
    >
      {children}
      <button
        type="button"
        class="copy-hint"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        onClick={(e) => {
          e.stopPropagation();
          void copy(text);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** A short code value (variable, value, name) that copies itself when clicked. */
export function CopyCode({ text, display }: { text: string; display?: string }) {
  return (
    <Copyable text={text} inline>
      <code>{display ?? text}</code>
    </Copyable>
  );
}
