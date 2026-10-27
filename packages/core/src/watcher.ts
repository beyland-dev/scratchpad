import { mkdir } from "node:fs/promises";
import path from "node:path";
import { watch } from "chokidar";
import type { EventBus } from "./events.ts";
import { TMP_SUFFIX } from "./fs-utils.ts";
import type { ProjectStore } from "./projects.ts";
import type { PrototypeStore } from "./prototypes.ts";
import { GENERATED_DIRS, OBSERVED_PATHS, SYSTEMS_DIR, type SystemStore } from "./systems/store.ts";
import { workspaceFileOf, type Workspace } from "./workspace.ts";

const DEBOUNCE_MS = 75;
const SYSTEM_DEBOUNCE_MS = 250;

export interface WatchSystemsOptions {
  projects?: ProjectStore;
  systems: SystemStore;
  /** Called (debounced) after a system's sources changed and were reloaded. */
  onSystemChanged?: (id: string, exists: boolean) => void;
}

/**
 * Watch the workspace so edits made outside the API (agents writing files
 * directly, git checkouts, editors) refresh the indexes and notify listeners.
 * Returns a function that stops watching.
 */
export async function watchWorkspace(
  ws: Workspace,
  store: PrototypeStore,
  events: EventBus,
  options?: WatchSystemsOptions,
): Promise<() => Promise<void>> {
  const workspaceFile = workspaceFileOf(ws.root);
  const systemsDir = path.join(ws.designDir, SYSTEMS_DIR);
  const pending = new Map<string, { paths: Set<string>; timer: NodeJS.Timeout }>();
  const pendingSystems = new Map<string, { paths: Set<string>; timer: NodeJS.Timeout }>();
  const pendingProjects = new Map<string, NodeJS.Timeout>();
  let configTimer: NodeJS.Timeout | undefined;

  const isGenerated = (file: string): boolean => {
    const rel = path.relative(systemsDir, file);
    if (!rel || rel.startsWith("..")) return false;
    const [, top] = rel.split(path.sep);
    return (
      top !== undefined &&
      ((GENERATED_DIRS.includes(top) && !OBSERVED_PATHS.includes(top)) ||
        /^(dist|skill)\.(next|old)/.test(top))
    );
  };

  const targets = [ws.prototypesDir, workspaceFile];
  if (options) {
    await mkdir(systemsDir, { recursive: true });
    targets.push(systemsDir);
  }
  if (options?.projects) {
    await mkdir(ws.projectsDir, { recursive: true });
    targets.push(ws.projectsDir);
  }
  const watcher = watch(targets, {
    ignoreInitial: true,
    ignored: (file) => file.endsWith(TMP_SUFFIX) || isGenerated(file),
  });

  const flush = async (id: string): Promise<void> => {
    const batch = pending.get(id);
    pending.delete(id);
    if (!batch) return;
    try {
      const proto = await store.reloadOne(id);
      events.emit("prototype.changed", {
        id,
        exists: proto !== undefined,
        paths: [...batch.paths].sort(),
      });
    } catch (error) {
      console.error(`[design-tool] failed to reload prototype ${id}`, error);
    }
  };

  const flushSystem = async (id: string): Promise<void> => {
    const batch = pendingSystems.get(id);
    pendingSystems.delete(id);
    if (!batch || !options) return;
    const paths = [...batch.paths].sort();
    // Captures and the activity log are generated: notify, but don't reload or rebuild.
    if (paths.length && paths.every((p) => OBSERVED_PATHS.includes(p.split("/")[0]!))) {
      events.emit("system.changed", { id, exists: true, paths });
      return;
    }
    try {
      const system = await options.systems.reloadSystem(id);
      const exists = system !== undefined;
      events.emit("system.changed", { id, exists, paths });
      options.onSystemChanged?.(id, exists);
    } catch (error) {
      console.error(`[design-tool] failed to reload design system ${id}`, error);
    }
  };

  watcher.on("all", (_event, file) => {
    if (path.resolve(file) === path.resolve(workspaceFile)) {
      clearTimeout(configTimer);
      configTimer = setTimeout(() => {
        ws.reload()
          .then(() => events.emit("workspace.changed", {}))
          .catch((error: unknown) =>
            console.error("[design-tool] failed to reload workspace.json", error),
          );
      }, DEBOUNCE_MS);
      return;
    }
    const projectRel = path.relative(ws.projectsDir, file);
    if (options?.projects && projectRel && !projectRel.startsWith("..")) {
      const [id] = projectRel.split(path.sep);
      if (!id || id.startsWith(".")) return;
      clearTimeout(pendingProjects.get(id));
      pendingProjects.set(
        id,
        setTimeout(() => {
          pendingProjects.delete(id);
          options
            .projects!.reloadOne(id)
            .then((project) =>
              events.emit("project.changed", { id, exists: project !== undefined }),
            )
            .catch((error: unknown) =>
              console.error(`[design-tool] failed to reload project ${id}`, error),
            );
        }, DEBOUNCE_MS),
      );
      return;
    }
    const sysRel = path.relative(systemsDir, file);
    if (options && sysRel && !sysRel.startsWith("..")) {
      const [id, ...rest] = sysRel.split(path.sep);
      if (!id || id.startsWith(".")) return;
      const existing = pendingSystems.get(id);
      if (existing) clearTimeout(existing.timer);
      const paths = existing?.paths ?? new Set<string>();
      if (rest.length) paths.add(rest.join("/"));
      pendingSystems.set(id, {
        paths,
        timer: setTimeout(() => void flushSystem(id), SYSTEM_DEBOUNCE_MS),
      });
      return;
    }
    const rel = path.relative(ws.prototypesDir, file);
    if (!rel || rel.startsWith("..")) return;
    const [id, ...rest] = rel.split(path.sep);
    if (!id || id.startsWith(".")) return;
    const existing = pending.get(id);
    if (existing) clearTimeout(existing.timer);
    const paths = existing?.paths ?? new Set<string>();
    if (rest.length) paths.add(rest.join("/"));
    pending.set(id, { paths, timer: setTimeout(() => void flush(id), DEBOUNCE_MS) });
  });

  await new Promise<void>((resolve, reject) => {
    watcher.once("ready", () => resolve());
    watcher.once("error", reject);
  });

  return async () => {
    clearTimeout(configTimer);
    for (const { timer } of pending.values()) clearTimeout(timer);
    for (const { timer } of pendingSystems.values()) clearTimeout(timer);
    for (const timer of pendingProjects.values()) clearTimeout(timer);
    pendingProjects.clear();
    pending.clear();
    pendingSystems.clear();
    await watcher.close();
  };
}
