import { useState } from "preact/hooks";
import { call } from "../api.ts";
import type { PrototypeStatus } from "../types.ts";

export const STATUSES: PrototypeStatus[] = ["draft", "review", "approved", "archived"];

export function StatusBadge({ status }: { status: PrototypeStatus }) {
  return <span class={`badge status-${status}`}>{status}</span>;
}

/** The status badge as an inline picker: changing it saves immediately. */
export function StatusSelect({ id, status }: { id: string; status: PrototypeStatus }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = async (next: PrototypeStatus) => {
    setSaving(true);
    setError(null);
    try {
      await call("prototype.update", { id, status: next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <select
        class={`status-select status-${status}`}
        value={status}
        disabled={saving}
        aria-label="Status"
        title="Change status"
        onChange={(e) => void update(e.currentTarget.value as PrototypeStatus)}
      >
        {STATUSES.map((s) => (
          <option value={s} key={s}>
            {s}
          </option>
        ))}
      </select>
      {error && (
        <span class="error small" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
