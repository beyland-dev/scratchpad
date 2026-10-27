import { useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { DeleteSystemDialog, SystemDialog } from "../components/Dialogs.tsx";
import { MenuButton } from "../components/Menu.tsx";
import { Icon } from "../components/Icon.tsx";
import { loaded, projectEntries, projectIdOf, systems, type SystemSummary } from "../store.ts";

export function Systems() {
  const { params } = useRoute();
  const projectId = params.project ?? "";
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "edit" | "delete"; system: SystemSummary } | null>(
    null,
  );
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  const project = projectEntries.value.find((p) => p.id === projectId);
  if (!project)
    return (
      <p class="page-message">
        No project <code>{projectId}</code>. <a href="/">Go to your projects</a>
      </p>
    );
  const list = systems.value.filter((s) => projectIdOf(s) === projectId);
  return (
    <div class="page">
      <div class="page-head">
        <div class="page-title-row">
          <h1>Design systems</h1>
          <span class="toolbar-spacer" />
          <button type="button" class="button primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> New design system
          </button>
        </div>
        <p class="muted">
          Verified components and tokens codified from real products, so agents build prototypes
          that match.
        </p>
      </div>
      {list.length > 0 && (
        <div class="grid system-grid">
          {list.map((s) => (
            <div class="system-card-wrap" key={s.id}>
              <a class="system-card" href={`/systems/${encodeURIComponent(s.id)}`}>
                <div class="card-title">{s.name}</div>
                {s.description && <p class="summary">{s.description}</p>}
                <div class="card-meta">
                  <span class="m">{s.components} components</span>
                  <span class="m">{s.tokens.toLocaleString()} tokens</span>
                  {s.issues?.length ? (
                    <span class="warn-count" title={s.issues.join("\n")}>
                      <Icon name="alert" size={12} />
                      {s.issues.length}
                    </span>
                  ) : null}
                </div>
              </a>
              <MenuButton
                class="card-menu"
                label={`${s.name} options`}
                items={[
                  {
                    label: "Edit details…",
                    onSelect: () => setDialog({ kind: "edit", system: s }),
                  },
                  {
                    label: "Delete…",
                    danger: true,
                    onSelect: () => setDialog({ kind: "delete", system: s }),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}
      {creating && <SystemDialog projectId={projectId} onClose={() => setCreating(false)} />}
      {dialog?.kind === "edit" && (
        <SystemDialog system={dialog.system} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && (
        <DeleteSystemDialog system={dialog.system} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
