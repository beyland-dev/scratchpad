import { useEffect, useRef } from "preact/hooks";
import { isTypingTarget } from "../util.ts";
import { Icon } from "./Icon.tsx";

/** A search field with a leading icon. Press "/" anywhere on the page to focus it. */
export function SearchInput({
  value,
  onInput,
  placeholder,
}: {
  value: string;
  onInput: (value: string) => void;
  placeholder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || isTypingTarget(event.target))
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div class="search">
      <Icon name="search" size={15} />
      <input
        ref={input}
        type="search"
        class="input"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onInput={(e) => onInput(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (value) onInput("");
            else e.currentTarget.blur();
          }
        }}
      />
      <kbd aria-hidden="true">/</kbd>
    </div>
  );
}
