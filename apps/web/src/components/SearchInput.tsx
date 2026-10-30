import { useRef } from "preact/hooks";
import { bindingParts, keybindings, useShortcut } from "../keybindings.ts";
import { Icon } from "./Icon.tsx";

/** A search field with a leading icon. Its shortcut ("/" by default) focuses it from anywhere. */
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
  useShortcut("search", () => input.current?.focus());
  const keys = bindingParts(keybindings.value.search);
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
      {keys.length > 0 && <kbd aria-hidden="true">{keys.join("")}</kbd>}
    </div>
  );
}
