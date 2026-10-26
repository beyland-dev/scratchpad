export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Call a core command through the HTTP API. Every UI action goes through here. */
export async function call<T>(name: string, input: unknown = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/commands/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the design-tool server. Is `dt serve` running?");
  }
  const body = (await response.json().catch(() => undefined)) as
    | { ok: true; result: T }
    | { ok: false; error: { code: string; message: string } }
    | undefined;
  if (!body) throw new ApiError("INTERNAL", `Unexpected response (${response.status})`);
  if (!body.ok) throw new ApiError(body.error.code, body.error.message);
  return body.result;
}

export type ServerEvent =
  | { type: "prototype.changed"; data: { id: string; exists: boolean; paths: string[] } }
  | { type: "workspace.changed"; data: Record<string, never> }
  | {
      type: "system.changed";
      data: { id: string; exists: boolean; paths: string[]; built?: boolean };
    }
  | { type: "ready"; data: { name: string } };

/** Subscribe to live server events. EventSource reconnects automatically. */
export function subscribe(
  onEvent: (event: ServerEvent) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const source = new EventSource("/api/events");
  const forward = (type: ServerEvent["type"]) => (message: MessageEvent<string>) => {
    try {
      onEvent({ type, data: JSON.parse(message.data) } as ServerEvent);
    } catch {
      // ignore malformed events
    }
  };
  const handlers = {
    ready: forward("ready"),
    "prototype.changed": forward("prototype.changed"),
    "workspace.changed": forward("workspace.changed"),
    "system.changed": forward("system.changed"),
  };
  for (const [type, handler] of Object.entries(handlers))
    source.addEventListener(type, handler as EventListener);
  source.addEventListener("ready", () => onStatus(true));
  source.onerror = () => onStatus(false);
  return () => source.close();
}
