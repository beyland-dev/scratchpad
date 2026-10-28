import type { Core } from "./core.ts";
import { CoreError } from "./errors.ts";
import type {
  CreatePrototypeInput,
  PrototypeFilter,
  PrototypeStore,
  ReadFileResult,
  UpdatePrototypeInput,
} from "./prototypes.ts";
import { parseRef } from "./refs.ts";
import type { Review, ReviewInput, ReviewStore } from "./reviews.ts";
import type { ProjectScope } from "./scope.ts";
import type { Author, FileEncoding, Prototype, PrototypeFileEntry } from "./schemas.ts";
import type { ActivityEntry, ComponentQuery, SystemStore, TokenQuery } from "./systems/store.ts";
import type {
  ComponentFileInput,
  DesignComponent,
  DesignSystem,
  SystemFile,
  Token,
  TokenInput,
} from "./systems/schemas.ts";

export interface Located<S> {
  scope: ProjectScope;
  store: S;
  id: string;
}

/** Find which project's store holds `ref` (`project/id`, or an id only one project has). */
function locate<S>(
  core: Core,
  ref: string,
  noun: string,
  storeOf: (scope: ProjectScope) => S,
  has: (store: S, id: string) => boolean,
): Located<S> {
  const { project, id } = parseRef(ref);
  if (project) {
    const scope = core.projects.scope(project);
    return { scope, store: storeOf(scope), id };
  }
  const matches = core.projects.scopes().filter((scope) => has(storeOf(scope), id));
  if (matches.length === 1) return { scope: matches[0]!, store: storeOf(matches[0]!), id };
  if (matches.length === 0)
    throw new CoreError("NOT_FOUND", `No ${noun} with id ${JSON.stringify(id)}`);
  throw new CoreError(
    "INVALID_INPUT",
    `Several projects have a ${noun} ${JSON.stringify(id)} (${matches.map((m) => `${m.id}/${id}`).join(", ")}); pass it as project/id`,
  );
}

/**
 * Prototypes across every project. Methods take a reference (`project/id`, or an id that only one
 * project has) and forward to that project's {@link PrototypeStore}.
 */
export class PrototypeIndex {
  readonly #core: Core;

  constructor(core: Core) {
    this.#core = core;
  }

  locate(ref: string): Located<PrototypeStore> {
    return locate(
      this.#core,
      ref,
      "prototype",
      (scope) => scope.prototypes,
      (store, id) => store.has(id),
    );
  }

  /** Every project's prototypes (or one project's), newest first. */
  list(filter: PrototypeFilter & { project?: string } = {}): Prototype[] {
    const { project, ...rest } = filter;
    const scopes = project ? [this.#core.projects.scope(project)] : this.#core.projects.scopes();
    return scopes
      .flatMap((scope) => scope.prototypes.list(rest))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  has(ref: string): boolean {
    try {
      const { store, id } = this.locate(ref);
      return store.has(id);
    } catch {
      return false;
    }
  }

  get(ref: string): Prototype {
    const { store, id } = this.locate(ref);
    return store.get(id);
  }

  dirOf(ref: string): string {
    const { store, id } = this.locate(ref);
    return store.dirOf(id);
  }

  systemRefs(ref: string): string[] {
    const { store, id } = this.locate(ref);
    return store.systemRefs(id);
  }

  family(ref: string): Prototype[] {
    const { store, id } = this.locate(ref);
    return store.family(id);
  }

  listFiles(ref: string): Promise<PrototypeFileEntry[]> {
    const { store, id } = this.locate(ref);
    return store.listFiles(id);
  }

  create(project: string, input: CreatePrototypeInput): Promise<Prototype> {
    return this.#core.projects.scope(project).prototypes.create(input);
  }

  update(ref: string, patch: UpdatePrototypeInput): Promise<Prototype> {
    const { store, id } = this.locate(ref);
    return store.update(id, patch);
  }

  writeFile(
    ref: string,
    relPath: string,
    content: string,
    encoding?: FileEncoding,
  ): Promise<PrototypeFileEntry> {
    const { store, id } = this.locate(ref);
    return store.writeFile(id, relPath, content, encoding);
  }

  readFile(ref: string, relPath: string, encoding?: FileEncoding): Promise<ReadFileResult> {
    const { store, id } = this.locate(ref);
    return store.readFile(id, relPath, encoding);
  }

  createVariant(
    ref: string,
    input: { id?: string; description?: string; createdBy?: Author } = {},
  ): Promise<Prototype> {
    const { store, id } = this.locate(ref);
    return store.createVariant(id, input);
  }

  delete(ref: string): Promise<{ id: string; project: string; trashedTo: string }> {
    const { store, id } = this.locate(ref);
    return store.delete(id);
  }
}

/**
 * Design systems across every project. Methods take a reference (`project/id`, or an id that only
 * one project has) and forward to that project's {@link SystemStore}.
 */
export class SystemIndex {
  readonly #core: Core;

  constructor(core: Core) {
    this.#core = core;
  }

  locate(ref: string): Located<SystemStore> {
    return locate(
      this.#core,
      ref,
      "design system",
      (scope) => scope.systems,
      (store, id) => store.has(id),
    );
  }

  /** Every project's systems (or one project's). */
  list(project?: string): DesignSystem[] {
    const scopes = project ? [this.#core.projects.scope(project)] : this.#core.projects.scopes();
    return scopes
      .flatMap((scope) => scope.systems.list())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  has(ref: string): boolean {
    try {
      const { store, id } = this.locate(ref);
      return store.has(id);
    } catch {
      return false;
    }
  }

  get(ref: string): DesignSystem {
    const { store, id } = this.locate(ref);
    return store.get(id);
  }

  dirOf(ref: string): string {
    const { store, id } = this.locate(ref);
    return store.dirOf(id);
  }

  create(
    project: string,
    id: string,
    input: Omit<SystemFile, "version" | "createdAt" | "updatedAt">,
  ): Promise<DesignSystem> {
    return this.#core.projects.scope(project).systems.create(id, input);
  }

  update(
    ref: string,
    patch: Partial<Omit<SystemFile, "version" | "createdAt" | "updatedAt">>,
  ): Promise<DesignSystem> {
    const { store, id } = this.locate(ref);
    return store.update(id, patch);
  }

  remove(ref: string): Promise<{ id: string; project: string; trashedTo: string }> {
    const { store, id } = this.locate(ref);
    return store.remove(id);
  }

  writeFile(
    ref: string,
    relPath: string,
    content: string,
    encoding?: FileEncoding,
  ): Promise<{ path: string; size: number }> {
    const { store, id } = this.locate(ref);
    return store.writeFile(id, relPath, content, encoding);
  }

  tokens(ref: string): Promise<Token[]> {
    const { store, id } = this.locate(ref);
    return store.tokens(id);
  }

  importTokens(
    ref: string,
    incoming: TokenInput[],
    mode?: "merge" | "replace",
  ): Promise<{ added: number; updated: number; total: number }> {
    const { store, id } = this.locate(ref);
    return store.importTokens(id, incoming, mode);
  }

  searchTokens(ref: string, q?: TokenQuery): Promise<{ tokens: Token[]; total: number }> {
    const { store, id } = this.locate(ref);
    return store.searchTokens(id, q);
  }

  captureDirOf(ref: string, label: string): string {
    const { store, id } = this.locate(ref);
    return store.captureDirOf(id, label);
  }

  listCaptures(ref: string): Promise<string[]> {
    const { store, id } = this.locate(ref);
    return store.listCaptures(id);
  }

  components(ref: string): DesignComponent[] {
    const { store, id } = this.locate(ref);
    return store.components(id);
  }

  component(ref: string, name: string): DesignComponent {
    const { store, id } = this.locate(ref);
    return store.component(id, name);
  }

  componentByTag(ref: string, tag: string): DesignComponent | undefined {
    const { store, id } = this.locate(ref);
    return store.componentByTag(id, tag);
  }

  searchComponents(ref: string, q?: ComponentQuery): DesignComponent[] {
    const { store, id } = this.locate(ref);
    return store.searchComponents(id, q);
  }

  createComponent(
    ref: string,
    name: string,
    input: Omit<ComponentFileInput, "createdAt" | "updatedAt">,
    files?: { css?: string; js?: string },
  ): Promise<DesignComponent> {
    const { store, id } = this.locate(ref);
    return store.createComponent(id, name, input, files);
  }

  updateComponent(
    ref: string,
    name: string,
    patch: Partial<Omit<ComponentFileInput, "createdAt" | "updatedAt">>,
  ): Promise<DesignComponent> {
    const { store, id } = this.locate(ref);
    return store.updateComponent(id, name, patch);
  }

  removeComponent(
    ref: string,
    name: string,
  ): Promise<{ name: string; removed: true; trashedTo: string }> {
    const { store, id } = this.locate(ref);
    return store.removeComponent(id, name);
  }

  writeComponentFile(
    ref: string,
    name: string,
    relPath: string,
    content: string,
    encoding?: FileEncoding,
  ): Promise<{ path: string; size: number }> {
    const { store, id } = this.locate(ref);
    return store.writeComponentFile(id, name, relPath, content, encoding);
  }

  readComponentFile(ref: string, name: string, relPath: string): Promise<Buffer | undefined> {
    const { store, id } = this.locate(ref);
    return store.readComponentFile(id, name, relPath);
  }

  componentFiles(ref: string, name: string): Promise<{ path: string; size: number }[]> {
    const { store, id } = this.locate(ref);
    return store.componentFiles(id, name);
  }

  logActivity(ref: string, entry: Omit<ActivityEntry, "at">): Promise<void> {
    const { store, id } = this.locate(ref);
    return store.logActivity(id, entry);
  }

  activity(ref: string, limit?: number): Promise<ActivityEntry[]> {
    const { store, id } = this.locate(ref);
    return store.activity(id, limit);
  }
}

/** Reviews across every project, addressed as `project/id` (or an id only one project has). */
export class ReviewIndex {
  readonly #core: Core;

  constructor(core: Core) {
    this.#core = core;
  }

  locate(ref: string): Located<ReviewStore> {
    return locate(
      this.#core,
      ref,
      "review",
      (scope) => scope.reviews,
      (store, id) => store.has(id),
    );
  }

  list(project?: string): Review[] {
    const scopes = project ? [this.#core.projects.scope(project)] : this.#core.projects.scopes();
    return scopes
      .flatMap((scope) => scope.reviews.list())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(ref: string): Review {
    const { store, id } = this.locate(ref);
    return store.get(id);
  }

  create(project: string, input: ReviewInput & { title: string; id?: string }): Promise<Review> {
    return this.#core.projects.scope(project).reviews.create(input);
  }
}
