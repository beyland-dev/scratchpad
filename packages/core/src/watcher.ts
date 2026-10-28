import path from "node:path";
import { watch } from "chokidar";
import type { EventBus } from "./events.ts";
import { TMP_SUFFIX } from "./fs-utils.ts";
import type { ProjectStore } from "./projects.ts";
import { ID_PATTERN } from "./schemas.ts";
import { GENERATED_DIRS, OBSERVED_PATHS, SYSTEMS_DIR } from "./systems/store.ts";
import { CACHE_DIR, PROTOTYPES_DIR, TRASH_DIR, type Workspace } from "./workspace.ts";

const DEBOUNCE_MS = 75;
const SYSTEM_DEBOUNCE_MS = 250;
/** Folders anywhere in a project that never hold watched content. */
const SKIPPED_DIRS = new Set([".git", "node_modules", TRASH_DIR, CACHE_DIR]);

export interface WatchOptions {
  /** Called (debounced) after a system's sources changed and were reloaded. */
  onSystemChanged?: (project: string, id: string, exists: boolean) => void;
}

interface Pending {
  paths: Set<string>;
  timer: NodeJS.Timeout;
}

/**
 * Watch the workspace so edits made outside the API (agents writing files directly, git pulls and
 * clones, editors) refresh the indexes and notify listeners. Returns a function that stops watching.
 */
export async function watchWorkspace(
  ws: Workspace,
  projects: ProjectStore,
  events: EventBus,
  options: WatchOptions = {},
): Promise<() => Promise<void>> {
  const pendingPrototypes = new Map<string, Pending>();
  const pendingSystems = new Map<string, Pending>();
  const pendingProjects = new Map<string, NodeJS.Timeout>();
  let configTimer: NodeJS.Timeout | undefined;

  /** Path segments relative to `projects/`, or undefined outside it. */
  const segmentsOf = (file: string): string[] | undefined => {
    const rel = path.relative(ws.projectsDir, file);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
    return rel.split(path.sep);
  };

  const ignored = (file: string): boolean => {
    if (file.endsWith(TMP_SUFFIX)) return true;
    const parts = segmentsOf(file);
    if (!parts) return false;
    // Dot-folders next to projects are staging areas (e.g. a clone in progress).
    if (parts[0]!.startsWith(".")) return true;
    if (parts.some((part) => SKIPPED_DIRS.has(part))) return true;
    const [, section, , top] = parts;
    return (
      section === SYSTEMS_DIR &&
      top !== undefined &&
      ((GENERATED_DIRS.includes(top) && !OBSERVED_PATHS.includes(top)) ||
        /^(dist|skill)\.(next|old)/.test(top))
    );
  };

  const watcher = watch([ws.projectsDir, ws.configFile], { ignoreInitial: true, ignored });

  const scheduleProject = (project: string): void => {
    clearTimeout(pendingProjects.get(project));
    pendingProjects.set(
      project,
      setTimeout(() => {
        pendingProjects.delete(project);
        projects
          .reloadOne(project)
          .then(({ project: loaded, scopeChanged }) =>
            events.emit("project.changed", {
              id: project,
              exists: loaded !== undefined,
              ...(scopeChanged ? { contents: true } : {}),
            }),
          )
          .catch((error: unknown) =>
            console.error(`[scratchpad] failed to reload project ${project}`, error),
          );
      }, DEBOUNCE_MS),
    );
  };

  const queue = (
    pending: Map<string, Pending>,
    key: string,
    rest: string[],
    delay: number,
    flush: (key: string, paths: string[]) => Promise<void>,
  ): void => {
    const existing = pending.get(key);
    if (existing) clearTimeout(existing.timer);
    const paths = existing?.paths ?? new Set<string>();
    if (rest.length) paths.add(rest.join("/"));
    pending.set(key, {
      paths,
      timer: setTimeout(() => {
        pending.delete(key);
        void flush(key, [...paths].sort());
      }, delay),
    });
  };

  const split = (key: string): [string, string] => {
    const slash = key.indexOf("/");
    return [key.slice(0, slash), key.slice(slash + 1)];
  };

  const flushPrototype = async (key: string, paths: string[]): Promise<void> => {
    const [project, id] = split(key);
    if (!projects.has(project)) return scheduleProject(project);
    try {
      const proto = await projects.scope(project).prototypes.reloadOne(id);
      events.emit("prototype.changed", { project, id, exists: proto !== undefined, paths });
    } catch (error) {
      console.error(`[scratchpad] failed to reload prototype ${key}`, error);
    }
  };

  const flushSystem = async (key: string, paths: string[]): Promise<void> => {
    const [project, id] = split(key);
    if (!projects.has(project)) return scheduleProject(project);
    // Captures and the activity log are generated: notify, but don't reload or rebuild.
    if (paths.length && paths.every((p) => OBSERVED_PATHS.includes(p.split("/")[0]!))) {
      events.emit("system.changed", { project, id, exists: true, paths });
      return;
    }
    try {
      const system = await projects.scope(project).systems.reloadSystem(id);
      const exists = system !== undefined;
      events.emit("system.changed", { project, id, exists, paths });
      options.onSystemChanged?.(project, id, exists);
    } catch (error) {
      console.error(`[scratchpad] failed to reload design system ${key}`, error);
    }
  };

  watcher.on("all", (_event, file) => {
    if (path.resolve(file) === path.resolve(ws.configFile)) {
      clearTimeout(configTimer);
      configTimer = setTimeout(() => {
        ws.reload()
          .then(() => events.emit("workspace.changed", {}))
          .catch((error: unknown) =>
            console.error("[scratchpad] failed to reload config.json", error),
          );
      }, DEBOUNCE_MS);
      return;
    }
    const parts = segmentsOf(file);
    if (!parts) return;
    const [project, section, id, ...rest] = parts;
    if (!project || !ID_PATTERN.test(project)) return;
    if (section === undefined || section === "project.json" || /^icon\.\w+$/.test(section)) {
      scheduleProject(project);
      return;
    }
    if (!id || !ID_PATTERN.test(id)) return;
    if (section === PROTOTYPES_DIR)
      queue(pendingPrototypes, `${project}/${id}`, rest, DEBOUNCE_MS, flushPrototype);
    else if (section === SYSTEMS_DIR)
      queue(pendingSystems, `${project}/${id}`, rest, SYSTEM_DEBOUNCE_MS, flushSystem);
  });

  await new Promise<void>((resolve, reject) => {
    watcher.once("ready", () => resolve());
    watcher.once("error", reject);
  });

  return async () => {
    clearTimeout(configTimer);
    for (const { timer } of pendingPrototypes.values()) clearTimeout(timer);
    for (const { timer } of pendingSystems.values()) clearTimeout(timer);
    for (const timer of pendingProjects.values()) clearTimeout(timer);
    pendingPrototypes.clear();
    pendingSystems.clear();
    pendingProjects.clear();
    await watcher.close();
  };
}
