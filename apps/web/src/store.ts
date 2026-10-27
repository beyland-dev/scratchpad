import { computed, signal } from "@preact/signals";
import { familyOf as sharedFamilyOf, groupFamilies } from "@design-tool/core/family";
import { call, subscribe } from "./api.ts";
import type { ProjectSummary, PrototypeWithUrls, WorkspaceInfo } from "./types.ts";

export const workspace = signal<WorkspaceInfo | null>(null);
export const prototypes = signal<PrototypeWithUrls[]>([]);
export const projects = signal<ProjectSummary[]>([]);
export const loaded = signal(false);
export const loadError = signal<string | null>(null);
export const connected = signal(false);
/** Per-prototype revision counters; bumping one remounts that prototype's iframes. */
export const revisions = signal<Record<string, number>>({});
/** Prototype ids selected in the gallery for comparison. */
export const selection = signal<string[]>([]);

export interface SystemSummary {
  id: string;
  name: string;
  description?: string;
  sourceId?: string;
  project?: string;
  kind: "captured" | "package";
  framework?: "react";
  library?: { name: string; package?: string; docsUrl?: string };
  prefix: string;
  components: number;
  tokens: number;
  skill: string;
  issues?: string[];
}

export const systems = signal<SystemSummary[]>([]);
/** Per-system build counters; bumping one reloads that system's specimens and data. */
export const systemRevisions = signal<Record<string, number>>({});

export function systemRevisionOf(id: string): number {
  return systemRevisions.value[id] ?? 0;
}

/** Per-system counters bumped on every change (sources, captures, activity, builds). */
export const systemEvents = signal<Record<string, number>>({});

export function systemEventOf(id: string): number {
  return systemEvents.value[id] ?? 0;
}

export const byId = computed(() => new Map(prototypes.value.map((p) => [p.id, p])));

export function revisionOf(id: string): number {
  return revisions.value[id] ?? 0;
}

let refreshing: Promise<void> | null = null;
let queued = false;

export async function refresh(): Promise<void> {
  if (refreshing) {
    queued = true;
    return refreshing;
  }
  refreshing = (async () => {
    try {
      const [info, list, systemList, projectList] = await Promise.all([
        call<WorkspaceInfo>("workspace.info"),
        call<{ prototypes: PrototypeWithUrls[] }>("prototype.list"),
        call<{ systems: SystemSummary[] }>("system.list").catch(() => ({ systems: [] })),
        call<{ projects: ProjectSummary[] }>("project.list").catch(() => ({ projects: [] })),
      ]);
      workspace.value = info;
      projects.value = projectList.projects;
      systems.value = systemList.systems;
      prototypes.value = list.prototypes;
      selection.value = selection.value.filter((id) => list.prototypes.some((p) => p.id === id));
      loadError.value = null;
    } catch (error) {
      loadError.value = (error as Error).message;
    } finally {
      loaded.value = true;
      refreshing = null;
      if (queued) {
        queued = false;
        void refresh();
      }
    }
  })();
  return refreshing;
}

let started = false;

export function startLiveUpdates(): void {
  if (started) return;
  started = true;
  void refresh();
  subscribe(
    (event) => {
      if (event.type === "prototype.changed") {
        revisions.value = { ...revisions.value, [event.data.id]: revisionOf(event.data.id) + 1 };
      }
      if (event.type === "system.changed") {
        systemEvents.value = {
          ...systemEvents.value,
          [event.data.id]: systemEventOf(event.data.id) + 1,
        };
      }
      // React prototypes are built with their design system, so reload them when it's rebuilt.
      if (event.type === "system.changed" && event.data.built) {
        const next = { ...revisions.value };
        for (const p of prototypes.value)
          if (p.framework && p.system === event.data.id) next[p.id] = (next[p.id] ?? 0) + 1;
        revisions.value = next;
      }
      if (event.type === "system.changed" && (event.data.built || !event.data.exists)) {
        systemRevisions.value = {
          ...systemRevisions.value,
          [event.data.id]: systemRevisionOf(event.data.id) + 1,
        };
      }
      void refresh();
    },
    (isConnected) => {
      connected.value = isConnected;
    },
  );
}

/** Variant family of `id`, oldest → newest (last = latest). */
export function familyOf(
  id: string,
  all: PrototypeWithUrls[] = prototypes.value,
): PrototypeWithUrls[] {
  return sharedFamilyOf(all, id);
}

/** All variant families, oldest → newest within each family. */
export const families = computed(() => groupFamilies(prototypes.value));

export function sandboxUrlFor(proto: PrototypeWithUrls, page?: string): string {
  if (!page) return proto.urls.raw;
  const base = proto.urls.raw.slice(
    0,
    proto.urls.raw.indexOf(`/p/${encodeURIComponent(proto.id)}/`),
  );
  return `${base}/p/${encodeURIComponent(proto.id)}/${page.split("/").map(encodeURIComponent).join("/")}`;
}

// ---- Projects ----------------------------------------------------------------

/** Pseudo-project for prototypes and systems that don't belong to an existing project. */
export const UNSORTED = "~unsorted";

/** The project an item shows up under: its own if that project exists, otherwise Unsorted. */
export function projectIdOf(item: { project?: string }): string {
  return item.project && projects.value.some((p) => p.id === item.project)
    ? item.project
    : UNSORTED;
}

export interface ProjectEntry {
  id: string;
  name: string;
  description?: string;
  color?: string;
  pattern?: number;
  iconUrl?: string;
  prototypes: number;
  systems: number;
}

/** Projects as listed in the sidebar, plus "Unsorted" when some items have no project. */
export const projectEntries = computed<ProjectEntry[]>(() => {
  const entries: ProjectEntry[] = projects.value.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    pattern: p.pattern,
    iconUrl: p.urls.icon,
    prototypes: families.value.filter((f) => f.some((x) => x.project === p.id)).length,
    systems: p.systems,
  }));
  const known = new Set(projects.value.map((p) => p.id));
  const orphan = (item: { project?: string }) => !item.project || !known.has(item.project);
  const unsortedPrototypes = families.value.filter((f) => f.some(orphan)).length;
  const unsortedSystems = systems.value.filter(orphan).length;
  if (unsortedPrototypes || unsortedSystems) {
    entries.push({
      id: UNSORTED,
      name: "Unsorted",
      description: "Prototypes and design systems that aren't in a project",
      prototypes: unsortedPrototypes,
      systems: unsortedSystems,
    });
  }
  return entries;
});

const LAST_PROJECT_KEY = "dt.lastProject";

export function rememberProject(id: string): void {
  if (localStorage.getItem(LAST_PROJECT_KEY) !== id) localStorage.setItem(LAST_PROJECT_KEY, id);
}

/** Where "home" goes: the last visited project if it still exists, else the first one. */
export function homeProjectId(): string | undefined {
  const entries = projectEntries.value;
  const last = localStorage.getItem(LAST_PROJECT_KEY);
  return entries.find((p) => p.id === last)?.id ?? entries[0]?.id;
}

export function projectHref(id: string, section: "prototypes" | "systems" = "prototypes"): string {
  const base = `/projects/${encodeURIComponent(id)}`;
  return section === "systems" ? `${base}/systems` : base;
}

/** The design systems list of the project that `systemId` belongs to. */
export function systemsListHref(systemId: string): string {
  const system = systems.value.find((s) => s.id === systemId);
  return projectHref(system ? projectIdOf(system) : (homeProjectId() ?? UNSORTED), "systems");
}
