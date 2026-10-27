import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { Icon } from "./Icon.tsx";

/** A modal dialog (native <dialog>: focus trapping, Escape to close, top layer). Render it only while open. */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      class={`dialog modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <header class="dialog-header">
        <h2>{title}</h2>
        <button type="button" class="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>
      {children}
    </dialog>
  );
}

/** Text input or textarea with a label and optional hint (linked via aria-describedby). */
export function Field({
  label,
  hint,
  value,
  onInput,
  placeholder,
  multiline = false,
  required = false,
  autoFocus = false,
  mono = false,
  list,
  pattern,
}: {
  label: string;
  hint?: ComponentChildren;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  mono?: boolean;
  list?: string;
  pattern?: string;
}) {
  const id = useId();
  const props = {
    id,
    class: `input field-input ${mono ? "mono" : ""}`,
    value,
    placeholder,
    required,
    autoFocus,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    onInput: (e: Event) => onInput((e.currentTarget as HTMLInputElement).value),
  };
  return (
    <div class="field">
      <FieldLabel htmlFor={id} label={label} required={required} />
      {multiline ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} type="text" list={list} pattern={pattern} spellcheck={!mono} />
      )}
      {hint && (
        <span class="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function FieldLabel({
  htmlFor,
  label,
  required = false,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label class="field-label" for={htmlFor}>
      {label}
      {!required && (
        <span class="field-optional" aria-hidden="true">
          Optional
        </span>
      )}
    </label>
  );
}

/** Footer row of a form dialog: an optional error, then cancel + submit. */
export function FormActions({
  submitLabel,
  busy,
  error,
  onCancel,
  danger = false,
  disabled = false,
}: {
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <footer class="dialog-actions">
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      <span class="toolbar-spacer" />
      <button type="button" class="button" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="submit"
        class={`button ${danger ? "danger" : "primary"}`}
        disabled={busy || disabled}
      >
        {busy ? "Working…" : submitLabel}
      </button>
    </footer>
  );
}

/** Runs an async form action, tracking busy and error state. */
export function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event?: Event) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

/** "Are you sure?" for destructive actions. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ComponentChildren;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const { busy, error, submit } = useSubmit(onConfirm);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body confirm-body">{children}</div>
        <FormActions
          submitLabel={confirmLabel}
          busy={busy}
          error={error}
          onCancel={onClose}
          danger
        />
      </form>
    </Modal>
  );
}
