export interface CoreEvents {
  /** A prototype's metadata or files changed (or it was created/removed). */
  "prototype.changed": { id: string; exists: boolean; paths: string[] };
  /** A project's metadata or icon changed (or it was created/removed). */
  "project.changed": { id: string; exists: boolean };
  /** `.design/workspace.json` changed. */
  "workspace.changed": Record<string, never>;
  /** A design system's sources changed, or it was rebuilt. */
  "system.changed": { id: string; exists: boolean; paths: string[]; built?: boolean };
}

export type CoreEventName = keyof CoreEvents;

export type CoreEvent = {
  [K in CoreEventName]: { type: K; data: CoreEvents[K] };
}[CoreEventName];

type Listener = (event: CoreEvent) => void;

export class EventBus {
  #listeners = new Set<Listener>();

  emit<K extends CoreEventName>(type: K, data: CoreEvents[K]): void {
    const event = { type, data } as CoreEvent;
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[design-tool] event listener failed", error);
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
