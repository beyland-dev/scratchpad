import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CommandRegistry } from "./registry.ts";
import { builtinCommands } from "./commands.ts";
import { buildSystem, type BuildResult } from "./systems/build.ts";
import { buildInto, buildSignature, prototypeHeadScript, runVite } from "./systems/package.ts";
import type { Prototype } from "./schemas.ts";
import { systemCommands } from "./systems/commands.ts";
import type { AnyCommand } from "./registry.ts";
import { EventBus } from "./events.ts";
import { gitCommands } from "./git-commands.ts";
import { ProjectGit, execRunner, type Runner } from "./git.ts";
import { CoreError } from "./errors.ts";
import { PrototypeIndex, SystemIndex } from "./indexes.ts";
import { ProjectStore } from "./projects.ts";
import { refKey } from "./refs.ts";
import type { ProjectUrls, PrototypeUrls, WorkspaceUrls } from "./schemas.ts";
import { watchWorkspace } from "./watcher.ts";
import { Workspace } from "./workspace.ts";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 7420;
export const DEFAULT_SANDBOX_PORT = 7421;

export interface OpenCoreOptions {
  /** Workspace root (`~/.scratchpad` by default, see `defaultWorkspaceRoot`). Created if missing. */
  root: string;
  /** Watch the filesystem for external changes (and rebuild design systems when their sources change). */
  watch?: boolean;
  /** Extra commands to register (e.g. capture commands from @beyland/scratchpad-capture). */
  commands?: AnyCommand[];
  /** Runs git (and gh); replaceable in tests. */
  gitRunner?: Runner;
}

export interface LastBuild {
  ok: boolean;
  at: string;
  result?: BuildResult;
  error?: string;
}

/** The headless application: workspace, stores, events, and the command registry. */
export class Core {
  readonly workspace: Workspace;
  /** Projects, each with the stores of its folder's contents (`projects.scope(id)`). */
  readonly projects: ProjectStore;
  /** Prototypes across projects, addressed as `project/id` (or an id only one project has). */
  readonly prototypes: PrototypeIndex;
  /** Design systems across projects, addressed as `project/id` (or an id only one project has). */
  readonly systems: SystemIndex;
  readonly events = new EventBus();
  readonly registry = new CommandRegistry().register(
    ...builtinCommands,
    ...systemCommands,
    ...gitCommands,
  );
  gitRunner: Runner = execRunner;
  #urls: WorkspaceUrls | undefined;
  #builds = new Map<string, LastBuild>();
  #buildQueue = new Map<string, Promise<BuildResult>>();
  #buildSignatures = new Map<string, string>();
  #sandboxProvider: (() => Promise<string>) | undefined;
  #prototypeBuilds = new Map<string, Promise<string>>();
  #prototypeFailures = new Map<string, { signature: string; error: Error }>();
  #stopWatching: (() => Promise<void>) | undefined;

  private constructor(workspace: Workspace) {
    this.workspace = workspace;
    this.projects = new ProjectStore(workspace);
    this.prototypes = new PrototypeIndex(this);
    this.systems = new SystemIndex(this);
  }

  static async open(options: OpenCoreOptions): Promise<Core> {
    const core = new Core(await Workspace.open(path.resolve(options.root)));
    if (options.commands?.length) core.registry.register(...options.commands);
    if (options.gitRunner) core.gitRunner = options.gitRunner;
    await core.projects.load();
    if (options.watch) await core.startWatching();
    return core;
  }

  run<T = unknown>(name: string, input?: unknown): Promise<T> {
    return this.registry.run(this, name, input) as Promise<T>;
  }

  /** Git operations on a project's folder. */
  git(project: string): ProjectGit {
    return new ProjectGit(this.projects.scope(project).dir, this.gitRunner);
  }

  /**
   * Re-read a project and everything in it (e.g. after a git pull or clone), and tell listeners.
   * The watcher would get there too, but callers want the result right away.
   */
  async reloadProject(id: string): Promise<void> {
    const { project, scopeChanged } = await this.projects.reloadOne(id);
    if (project && !scopeChanged) await this.projects.scope(id).load();
    this.events.emit("project.changed", { id, exists: project !== undefined, contents: true });
  }

  /** URLs for the app and sandbox servers. Defaults to configured/default ports when no server has registered. */
  get urls(): WorkspaceUrls {
    if (this.#urls) return this.#urls;
    const server = this.workspace.config.server ?? {};
    const host = server.host ?? DEFAULT_HOST;
    return {
      app: `http://${host}:${server.port ?? DEFAULT_PORT}`,
      sandbox: `http://${host}:${server.sandboxPort ?? DEFAULT_SANDBOX_PORT}`,
    };
  }

  setUrls(urls: WorkspaceUrls | undefined): void {
    this.#urls = urls;
  }

  /** Lets processes without a running server (CLI, stdio MCP) start a private sandbox on demand. */
  setSandboxProvider(provider: (() => Promise<string>) | undefined): void {
    this.#sandboxProvider = provider;
  }

  /** A reachable sandbox origin: the running server's, or one started on demand. */
  async sandboxUrl(): Promise<string> {
    if (this.#urls) return this.#urls.sandbox;
    if (this.#sandboxProvider) return this.#sandboxProvider();
    return this.urls.sandbox;
  }

  projectUrls(id: string): ProjectUrls {
    this.projects.get(id);
    const version = this.projects.iconVersionOf(id);
    return {
      app: `${this.urls.app}/projects/${encodeURIComponent(id)}`,
      ...(version
        ? { icon: `${this.urls.sandbox}/projects/${encodeURIComponent(id)}/~icon?v=${version}` }
        : {}),
    };
  }

  /**
   * The project new work goes into: the given one (which must exist), or, when omitted, the
   * workspace's only project.
   */
  resolveProject(project: string | undefined): string {
    if (project !== undefined) {
      if (!this.projects.has(project))
        throw new CoreError(
          "NOT_FOUND",
          `No project with id ${JSON.stringify(project)}. Create it with project.create, or list them with project.list.`,
        );
      return project;
    }
    const all = this.projects.list();
    if (all.length === 1) return all[0]!.id;
    throw new CoreError(
      "INVALID_INPUT",
      all.length
        ? `Pass a project: one of ${all.map((p) => p.id).join(", ")}`
        : "There are no projects yet. Create one with project.create first.",
    );
  }

  /** Sandbox URL of a project's folder: prototypes and systems are served under it. */
  projectSandboxUrl(project: string): string {
    return `${this.urls.sandbox}/projects/${encodeURIComponent(project)}`;
  }

  prototypeUrls(ref: string): PrototypeUrls {
    const proto = this.prototypes.get(ref);
    const entry = proto.entry.split("/").map(encodeURIComponent).join("/");
    const project = encodeURIComponent(proto.project);
    return {
      viewer: `${this.urls.app}/projects/${project}/p/${encodeURIComponent(proto.id)}`,
      raw: `${this.projectSandboxUrl(proto.project)}/prototypes/${encodeURIComponent(proto.id)}/${entry}`,
    };
  }

  /** Build a design system (serialized per system) and remember the outcome. */
  buildSystem(ref: string): Promise<BuildResult> {
    const { store, id, scope } = this.systems.locate(ref);
    const key = refKey(scope.id, id);
    const previous = this.#buildQueue.get(key) ?? Promise.resolve(undefined);
    const run = previous
      .catch(() => undefined)
      .then(() => buildSystem(store, id))
      .then(
        async (result) => {
          this.#builds.set(key, { ok: true, at: result.builtAt, result });
          const signature = JSON.stringify([
            result.css.bytes,
            result.js.bytes,
            result.components,
            result.tokens,
            result.warnings,
          ]);
          if (this.#buildSignatures.get(key) !== signature) {
            this.#buildSignatures.set(key, signature);
            await store.logActivity(id, {
              kind: "build",
              title: `Built ${result.components} components · ${result.files.includes("system.css") ? "system.css" : "specimen"} ${(result.css.bytes / 1024).toFixed(0)} KB`,
              detail: result.warnings.length
                ? result.warnings.join("\n")
                : `${result.css.captured} captured rules (${result.css.duplicates} shared) · ${result.tokens} tokens`,
              status: result.warnings.length ? "warn" : "ok",
            });
          }
          this.events.emit("system.changed", {
            project: scope.id,
            id,
            exists: true,
            paths: [],
            built: true,
          });
          return result;
        },
        async (error: unknown) => {
          await store.logActivity(id, {
            kind: "build",
            title: "Build failed",
            detail: (error as Error).message,
            status: "error",
          });
          this.#builds.set(key, {
            ok: false,
            at: new Date().toISOString(),
            error: (error as Error).message,
          });
          throw error;
        },
      );
    this.#buildQueue.set(key, run);
    return run;
  }

  /**
   * The design system (in its project) a prototype uses, for its theme options in the viewer: its
   * `system`; for a framework prototype, the package system it builds against; else the system its
   * entry HTML loads (`../../systems/<id>/system.css` or `system.js`); else its project's only one.
   */
  resolvePrototypeSystem(proto: Prototype): string | undefined {
    const systems = this.projects.scope(proto.project).systems;
    if (proto.system && systems.has(proto.system)) return proto.system;
    if (proto.framework) {
      try {
        return this.prototypeSystem(proto);
      } catch {
        return undefined;
      }
    }
    const scope = this.projects.scope(proto.project);
    const loaded = scope.prototypes.has(proto.id)
      ? scope.prototypes.systemRefs(proto.id).find((id) => systems.has(id))
      : undefined;
    if (loaded) return loaded;
    const inProject = systems.list();
    return inProject.length === 1 ? inProject[0]!.id : undefined;
  }

  /** The package design system (in its project) a framework prototype builds against. */
  prototypeSystem(proto: Pick<Prototype, "id" | "project" | "system" | "framework">): string {
    const systems = this.projects.scope(proto.project).systems;
    if (proto.system) {
      const system = systems.get(proto.system);
      if (system.kind !== "package")
        throw new CoreError(
          "INVALID_INPUT",
          `Prototype ${proto.id} uses design system ${system.id}, which is a captured system (use it from plain HTML instead).`,
        );
      return system.id;
    }
    const candidates = systems.list().filter((s) => s.kind === "package");
    if (candidates.length === 1) return candidates[0]!.id;
    throw new CoreError(
      "INVALID_INPUT",
      candidates.length
        ? `Prototype ${proto.id} needs a \`system\`: its project has several package design systems (${candidates.map((s) => s.id).join(", ")}).`
        : `Prototype ${proto.id} is a ${proto.framework} prototype but there's no package design system to build it with. Create one (system.create with kind "package") or set its \`system\`.`,
    );
  }

  /**
   * Build a framework prototype with its design system's Vite (cached until its files or the
   * system's change). Returns the folder with the built HTML and assets.
   */
  buildPrototype(ref: string): Promise<string> {
    const { scope, store, id } = this.prototypes.locate(ref);
    const key = refKey(scope.id, id);
    const previous = this.#prototypeBuilds.get(key) ?? Promise.resolve("");
    const run = previous
      .catch(() => "")
      .then(async () => {
        const proto = store.get(id);
        if (!proto.framework)
          throw new CoreError("INVALID_INPUT", `Prototype ${key} is plain HTML; it isn't built`);
        const systemId = this.prototypeSystem(proto);
        const systemDir = scope.systems.dirOf(systemId);
        const protoDir = store.dirOf(id);
        const headScript = prototypeHeadScript(scope.systems.get(systemId));
        const sources = await buildSignature([
          { dir: protoDir },
          {
            dir: systemDir,
            ignore: (rel) =>
              /^(dist|skill|captures|source)(\.|\/|$)/.test(rel) ||
              rel === "activity.jsonl" ||
              (rel.startsWith("node_modules/") && rel !== "node_modules/.package-lock.json"),
          },
        ]);
        // The injected script is part of the output too: rebuild when Scratchpad changes it.
        const signature = `${sources}:${createHash("sha256").update(headScript).digest("hex").slice(0, 16)}`;
        const target = path.join(this.workspace.cacheDir, "builds", scope.id, id);
        await mkdir(path.dirname(target), { recursive: true });
        const stamp = path.join(target, ".signature");
        if ((await readFile(stamp, "utf8").catch(() => "")) === signature) return target;
        const failed = this.#prototypeFailures.get(key);
        if (failed?.signature === signature) throw failed.error;
        const inputs = (await store.listFiles(id))
          .map((f) => f.path)
          .filter((f) => /\.html?$/i.test(f));
        try {
          await buildInto(target, async (outDir) => {
            await runVite({ systemDir, root: protoDir, inputs, headScript, outDir });
            await writeFile(path.join(outDir, ".signature"), signature);
          });
          this.#prototypeFailures.delete(key);
          return target;
        } catch (error) {
          this.#prototypeFailures.set(key, { signature, error: error as Error });
          throw error;
        }
      });
    this.#prototypeBuilds.set(key, run);
    return run;
  }

  lastBuild(ref: string): LastBuild | undefined {
    const { scope, id } = this.systems.locate(ref);
    return this.#builds.get(refKey(scope.id, id));
  }

  /**
   * Move a prototype to another project (its folder moves). Its `variantOf` link is dropped unless
   * the target project has that prototype too, and so is its `system` unless the target has it.
   */
  async movePrototype(ref: string, toProject: string): Promise<Prototype> {
    const { scope, store, id } = this.prototypes.locate(ref);
    const target = this.projects.scope(toProject);
    if (target.id === scope.id) return store.get(id);
    const system = store.get(id).system;
    const moved = await target.prototypes.adopt(store, id, {
      keepSystem: system !== undefined && target.systems.has(system),
    });
    this.events.emit("prototype.changed", { project: scope.id, id, exists: false, paths: [] });
    this.events.emit("prototype.changed", { project: target.id, id, exists: true, paths: [] });
    return moved;
  }

  async startWatching(): Promise<void> {
    if (this.#stopWatching) return;
    this.#stopWatching = await watchWorkspace(this.workspace, this.projects, this.events, {
      onSystemChanged: (project, id, exists) => {
        if (exists)
          this.buildSystem(refKey(project, id)).catch((error: unknown) =>
            console.error(
              `[scratchpad] building ${project}/${id} failed:`,
              (error as Error).message,
            ),
          );
      },
    });
  }

  async close(): Promise<void> {
    await this.#stopWatching?.();
    this.#stopWatching = undefined;
  }
}

export function openCore(options: OpenCoreOptions): Promise<Core> {
  return Core.open(options);
}
