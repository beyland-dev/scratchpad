import { useEffect } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { SystemDialog } from "../components/Dialogs.tsx";
import { Icon } from "../components/Icon.tsx";
import { loaded, projectHref, projectIdOf, systemHref, systems } from "../store.ts";

export function Systems() {
  const { params } = useRoute();
  const { route } = useLocation();
  const projectId = params.project ?? "";
  useEffect(() => route(`${projectHref(projectId)}#design-systems`, true), [projectId]);
  return null;
}

/** A project's design systems as pinned rows: usually there's exactly one, so no card grid. */
export function DesignSystemRows({
  projectId,
  creating,
  onCreatingChange,
}: {
  projectId: string;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}) {
  if (!loaded.value) return null;
  const list = systems.value.filter((s) => projectIdOf(s) === projectId);
  return (
    <section class="system-rows" id="design-systems" aria-label="Design systems">
      {list.map((s) => (
        <div class="system-row" key={s.id}>
          <a class="system-row-link" href={systemHref(s.id)}>
            <SystemThumb />
            <span class="system-row-text">
              <span class="system-row-eyebrow">Design system</span>
              <strong title={s.name}>{s.name}</strong>
            </span>
            {s.issues?.length ? (
              <span class="card-issues" title={s.issues.join("\n")}>
                <Icon name="alert" size={13} />
              </span>
            ) : null}
            <span class="system-row-stats">
              {s.components} components · {s.tokens.toLocaleString()} tokens
            </span>
            <span class="system-row-arrow" aria-hidden="true">
              <Icon name="chevron-right" size={16} />
            </span>
          </a>
        </div>
      ))}
      {list.length === 0 && (
        <button type="button" class="system-row-add" onClick={() => onCreatingChange(true)}>
          <Icon name="plus" size={14} />
          Add a design system
          <span>Components and tokens keep generated designs on-brand.</span>
        </button>
      )}
      {creating && <SystemDialog projectId={projectId} onClose={() => onCreatingChange(false)} />}
    </section>
  );
}

function SystemThumb() {
  return (
    <span class="system-row-thumb" aria-hidden="true">
      <Icon name="components" size={18} />
    </span>
  );
}
