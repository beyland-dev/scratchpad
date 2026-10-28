import { computed, signal } from "@preact/signals";
import {
  familyOf as sharedFamilyOf,
  groupFamilies,
  versionLabel,
} from "@beyland/scratchpad-core/family";
import { call, subscribe } from "./api.ts";
import type { ProjectSummary, PrototypeWithUrls, WorkspaceInfo } from "./types.ts";

/** `project/id`: how the app identifies prototypes and design systems across projects. */
export function refOf(project: string, id: string): string {
  return `${project}/${id}`;
}

/** The parts of a `project/id` reference. */
export function splitRef(ref: string): { project: string; id: string } {
  const slash = ref.indexOf("/");
  return { project: ref.slice(0, slash), id: ref.slice(slash + 1) };
}

type ApiPrototype = Omit<PrototypeWithUrls, "localId">;

/** Qualify a prototype from the API: `id`, `variantOf` and its systems become `project/id`. */
export function normalizePrototype(p: ApiPrototype): PrototypeWithUrls {
  const q = (id: string | undefined) => (id ? refOf(p.project, id) : undefined);
  return {
    ...p,
    id: refOf(p.project, p.id),
    localId: p.id,
    variantOf: q(p.variantOf),
    system: q(p.system),
    resolvedSystem: q(p.resolvedSystem),
  };
}

type ApiSystem = Omit<SystemSummary, "localId">;

function normalizeSystem(s: ApiSystem): SystemSummary {
  return { ...s, id: refOf(s.project, s.id), localId: s.id };
}

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
  /** `project/id`, see {@link refOf}. */
  id: string;
  /** Its folder name. */
  localId: string;
  name: string;
  description?: string;
  sourceId?: string;
  project: string;
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
        call<{ prototypes: ApiPrototype[] }>("prototype.list"),
        call<{ systems: ApiSystem[] }>("system.list").catch(() => ({ systems: [] })),
        call<{ projects: ProjectSummary[] }>("project.list").catch(() => ({ projects: [] })),
      ]);
      workspace.value = info;
      projects.value = projectList.projects;
      systems.value = systemList.systems.map(normalizeSystem);
      prototypes.value = list.prototypes.map(normalizePrototype);
      selection.value = selection.value.filter((id) => prototypes.value.some((p) => p.id === id));
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
        const ref = refOf(event.data.project, event.data.id);
        revisions.value = { ...revisions.value, [ref]: revisionOf(ref) + 1 };
      }
      if (event.type === "system.changed") {
        const ref = refOf(event.data.project, event.data.id);
        systemEvents.value = { ...systemEvents.value, [ref]: systemEventOf(ref) + 1 };
        // React prototypes are built with their design system, so reload them when it's rebuilt.
        if (event.data.built) {
          const next = { ...revisions.value };
          for (const p of prototypes.value)
            if (p.framework && p.system === ref) next[p.id] = (next[p.id] ?? 0) + 1;
          revisions.value = next;
        }
        if (event.data.built || !event.data.exists) {
          systemRevisions.value = { ...systemRevisions.value, [ref]: systemRevisionOf(ref) + 1 };
        }
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

/** A prototype's name: its family's (versions share one, told apart as V1, V2, … Latest). */
export function familyTitle(proto: PrototypeWithUrls): string {
  return familyOf(proto.id)[0]?.title ?? proto.title;
}

/** "V1", "V2", … "Latest" for a version of a family; undefined for a prototype without variants. */
export function versionLabelOf(proto: PrototypeWithUrls): string | undefined {
  const family = familyOf(proto.id);
  const index = family.findIndex((p) => p.id === proto.id);
  return family.length > 1 && index >= 0 ? versionLabel(index, family.length) : undefined;
}

/** All variant families, oldest → newest within each family. */
export const families = computed(() => groupFamilies(prototypes.value));

export function sandboxUrlFor(proto: PrototypeWithUrls, page?: string): string {
  if (!page) return proto.urls.raw;
  const folder = `/prototypes/${encodeURIComponent(proto.localId)}/`;
  const base = proto.urls.raw.slice(0, proto.urls.raw.indexOf(folder) + folder.length);
  return `${base}${page.split("/").map(encodeURIComponent).join("/")}`;
}

/** Sandbox URL of a design system's build output (specimen page, system.css, captures). */
export function systemSandboxUrl(ref: string): string {
  const { project, id } = splitRef(ref);
  return `${workspace.value?.urls.sandbox ?? ""}/projects/${encodeURIComponent(project)}/systems/${encodeURIComponent(id)}`;
}

/** The app page of a design system (`ref` is `project/id`), or one of its sub-pages. */
export function systemHref(ref: string, sub = ""): string {
  const { project, id } = splitRef(ref);
  return `/projects/${encodeURIComponent(project)}/systems/${encodeURIComponent(id)}${sub}`;
}

// ---- Projects ----------------------------------------------------------------

/** The project an item belongs to. */
export function projectIdOf(item: { project: string }): string {
  return item.project;
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

/** Projects as listed in the sidebar. */
export const projectEntries = computed<ProjectEntry[]>(() => {
  return projects.value.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    pattern: p.pattern,
    iconUrl: p.urls.icon,
    prototypes: families.value.filter((f) => f.some((x) => x.project === p.id)).length,
    systems: p.systems,
  }));
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

/** The per-project sections, in header-tab order. */
export type ProjectSection = "prototypes" | "systems" | "feedback" | "handoff";

export function projectHref(id: string, section: ProjectSection = "prototypes"): string {
  const base = `/projects/${encodeURIComponent(id)}`;
  return section === "prototypes" ? base : `${base}/${section}`;
}

/** A project's folder on disk (for showing paths), or `projects/<id>` before it's loaded. */
export function projectDirOf(project: string): string {
  return projects.value.find((p) => p.id === project)?.dir ?? `projects/${project}`;
}

/** The design systems list of the project that `systemRef` (`project/id`) belongs to. */
export function systemsListHref(systemRef: string): string {
  return projectHref(splitRef(systemRef).project, "systems");
}
