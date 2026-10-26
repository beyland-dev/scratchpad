import type { PrototypeStatus } from "../types.ts";

export const STATUSES: PrototypeStatus[] = ["draft", "review", "approved", "archived"];

export function StatusBadge({ status }: { status: PrototypeStatus }) {
  return <span class={`badge status-${status}`}>{status}</span>;
}
