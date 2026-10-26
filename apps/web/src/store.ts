import { computed, signal } from "@preact/signals";
import { familyOf as sharedFamilyOf, groupFamilies } from "@design-tool/core/family";
import { call, subscribe } from "./api.ts";
import type { PrototypeWithUrls, WorkspaceInfo } from "./types.ts";

export const workspace = signal<WorkspaceInfo | null>(null);
export const prototypes = signal<PrototypeWithUrls[]>([]);
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
      const [info, list, systemList] = await Promise.all([
        call<WorkspaceInfo>("workspace.info"),
        call<{ prototypes: PrototypeWithUrls[] }>("prototype.list"),
        call<{ systems: SystemSummary[] }>("system.list").catch(() => ({ systems: [] })),
      ]);
      workspace.value = info;
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
