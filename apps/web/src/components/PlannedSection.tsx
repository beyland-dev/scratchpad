import type { ComponentChildren } from "preact";
import { useRoute } from "preact-iso";
import { loaded, projectEntries } from "../store.ts";
import { Icon, type IconName } from "./Icon.tsx";

/** Scaffold for a project section that's planned but not built yet: its heading and an empty state. */
export function PlannedSection({
  title,
  lede,
  icon,
  children,
}: {
  title: string;
  lede: string;
  icon: IconName;
  /** What the section will hold, shown in the empty state. */
  children: ComponentChildren;
}) {
  const { params } = useRoute();
  const projectId = params.project ?? "";
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  if (!projectEntries.value.some((p) => p.id === projectId))
    return (
      <p class="page-message">
        No project <code>{projectId}</code>. <a href="/">Go to your projects</a>
      </p>
    );
  return (
    <div class="page">
      <div class="page-head">
        <h1>{title}</h1>
        <p class="muted">{lede}</p>
      </div>
      <div class="planned">
        <span class="planned-icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h2>Coming soon</h2>
          <p>{children}</p>
        </div>
      </div>
    </div>
  );
}
