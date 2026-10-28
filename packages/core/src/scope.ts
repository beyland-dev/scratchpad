import path from "node:path";
import { PrototypeStore } from "./prototypes.ts";
import { SystemStore } from "./systems/store.ts";
import { TRASH_DIR, type Workspace } from "./workspace.ts";

/** Where a project's stores keep their files. */
export interface ScopeContext {
  workspace: Workspace;
  /** Project id. */
  project: string;
  /** The project folder (`projects/<id>/`). */
  dir: string;
  /** Soft-deleted items (`projects/<id>/.trash/`, gitignored). */
  trashDir: string;
}

/**
 * Everything inside one project folder. Ids are unique within a project, so the stores work with
 * plain (unqualified) ids; {@link Core} picks the scope from a `project/id` reference.
 */
export class ProjectScope {
  readonly id: string;
  readonly dir: string;
  readonly context: ScopeContext;
  readonly prototypes: PrototypeStore;
  readonly systems: SystemStore;

  constructor(workspace: Workspace, id: string) {
    this.id = id;
    this.dir = path.join(workspace.projectsDir, id);
    this.context = {
      workspace,
      project: id,
      dir: this.dir,
      trashDir: path.join(this.dir, TRASH_DIR),
    };
    this.prototypes = new PrototypeStore(this.context);
    this.systems = new SystemStore(this.context);
  }

  async load(): Promise<void> {
    await this.prototypes.load();
    await this.systems.load();
  }
}
