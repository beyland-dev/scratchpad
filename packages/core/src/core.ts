import path from "node:path";
import { CommandRegistry } from "./registry.ts";
import { builtinCommands } from "./commands.ts";
import { buildSystem, type BuildResult } from "./systems/build.ts";
import { systemCommands } from "./systems/commands.ts";
import { SystemStore } from "./systems/store.ts";
import type { AnyCommand } from "./registry.ts";
import { EventBus } from "./events.ts";
import { PrototypeStore } from "./prototypes.ts";
import type { PrototypeUrls, WorkspaceUrls } from "./schemas.ts";
import { watchWorkspace } from "./watcher.ts";
import { Workspace } from "./workspace.ts";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 7420;
export const DEFAULT_SANDBOX_PORT = 7421;

export interface OpenCoreOptions {
  /** Workspace root (the folder containing `.design/`). */
  root: string;
  /** Watch the filesystem for external changes (and rebuild design systems when their sources change). */
  watch?: boolean;
  /** Extra commands to register (e.g. capture commands from @design-tool/capture). */
  commands?: AnyCommand[];
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
  readonly prototypes: PrototypeStore;
  readonly systems: SystemStore;
  readonly events = new EventBus();
  readonly registry = new CommandRegistry().register(...builtinCommands, ...systemCommands);
  #urls: WorkspaceUrls | undefined;
  #builds = new Map<string, LastBuild>();
  #buildQueue = new Map<string, Promise<BuildResult>>();
  #buildSignatures = new Map<string, string>();
  #sandboxProvider: (() => Promise<string>) | undefined;
  #stopWatching: (() => Promise<void>) | undefined;

  private constructor(workspace: Workspace) {
    this.workspace = workspace;
    this.prototypes = new PrototypeStore(workspace);
    this.systems = new SystemStore(workspace);
  }

  static async open(options: OpenCoreOptions): Promise<Core> {
    const core = new Core(await Workspace.open(path.resolve(options.root)));
    if (options.commands?.length) core.registry.register(...options.commands);
    await core.prototypes.load();
    await core.systems.load();
    if (options.watch) await core.startWatching();
    return core;
  }

  run<T = unknown>(name: string, input?: unknown): Promise<T> {
    return this.registry.run(this, name, input) as Promise<T>;
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

  prototypeUrls(id: string): PrototypeUrls {
    const proto = this.prototypes.get(id);
    const entry = proto.entry.split("/").map(encodeURIComponent).join("/");
    return {
      viewer: `${this.urls.app}/p/${encodeURIComponent(id)}`,
      raw: `${this.urls.sandbox}/p/${encodeURIComponent(id)}/${entry}`,
    };
  }

  /** Build a design system (serialized per system) and remember the outcome. */
  buildSystem(id: string): Promise<BuildResult> {
    const previous = this.#buildQueue.get(id) ?? Promise.resolve(undefined);
    const run = previous
      .catch(() => undefined)
      .then(() => buildSystem(this.systems, id))
      .then(
        async (result) => {
          this.#builds.set(id, { ok: true, at: result.builtAt, result });
          const signature = JSON.stringify([
            result.css.bytes,
            result.js.bytes,
            result.components,
            result.tokens,
            result.warnings,
          ]);
          if (this.#buildSignatures.get(id) !== signature) {
            this.#buildSignatures.set(id, signature);
            await this.systems.logActivity(id, {
              kind: "build",
              title: `Built ${result.components} components · system.css ${(result.css.bytes / 1024).toFixed(0)} KB`,
              detail: result.warnings.length
                ? result.warnings.join("\n")
                : `${result.css.captured} captured rules (${result.css.duplicates} shared) · ${result.tokens} tokens`,
              status: result.warnings.length ? "warn" : "ok",
            });
          }
          this.events.emit("system.changed", { id, exists: true, paths: [], built: true });
          return result;
        },
        async (error: unknown) => {
          await this.systems.logActivity(id, {
            kind: "build",
            title: "Build failed",
            detail: (error as Error).message,
            status: "error",
          });
          this.#builds.set(id, {
            ok: false,
            at: new Date().toISOString(),
            error: (error as Error).message,
          });
          throw error;
        },
      );
    this.#buildQueue.set(id, run);
    return run;
  }

  lastBuild(id: string): LastBuild | undefined {
    return this.#builds.get(id);
  }

  async startWatching(): Promise<void> {
    if (this.#stopWatching) return;
    this.#stopWatching = await watchWorkspace(this.workspace, this.prototypes, this.events, {
      systems: this.systems,
      onSystemChanged: (id, exists) => {
        if (exists)
          this.buildSystem(id).catch((error: unknown) =>
            console.error(`[design-tool] building ${id} failed:`, (error as Error).message),
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
