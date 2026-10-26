import path from "node:path";
import { isCoreError, type Core, type CoreErrorCode } from "@design-tool/core";
import { createMcpHttpHandler } from "@design-tool/mcp";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { streamSSE } from "hono/streaming";
import { localGuard } from "./guard.ts";
import { fileResponse } from "./static.ts";

export interface AppOptions {
  core: Core;
  /** Directory with the built web UI (apps/web/dist). */
  webRoot?: string;
  allowedHosts?: string[];
  /** Origins allowed to call the API from a browser (the app origin, dev servers). */
  allowedOrigins?: () => string[];
  /** SSE heartbeat interval in ms. */
  heartbeatMs?: number;
}

const STATUS_BY_CODE: Record<CoreErrorCode, ContentfulStatusCode> = {
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  NO_WORKSPACE: 500,
  INTERNAL: 500,
};

export function createApp(options: AppOptions): Hono {
  const { core } = options;
  const app = new Hono();
  const guard = localGuard({
    allowedHosts: options.allowedHosts,
    allowedOrigins: options.allowedOrigins,
  });
  const mcpGuard = localGuard({
    allowedHosts: options.allowedHosts,
    allowedOrigins: options.allowedOrigins,
    requireJson: false,
  });
  const mcp = createMcpHttpHandler(core);

  app.use("/api/*", guard);
  app.use("/mcp", mcpGuard);

  app.get("/api/health", (c) => c.json({ ok: true, name: core.workspace.config.name }));

  app.get("/api/commands", (c) => c.json({ ok: true, result: core.registry.describe() }));

  app.post("/api/commands/:name", async (c) => {
    const name = c.req.param("name");
    let input: unknown = {};
    const body = await c.req.text();
    if (body.trim()) {
      try {
        input = JSON.parse(body);
      } catch {
        return c.json(
          {
            ok: false,
            error: { code: "INVALID_INPUT", message: "Request body is not valid JSON" },
          },
          400,
        );
      }
    }
    try {
      return c.json({ ok: true, result: await core.run(name, input) });
    } catch (error) {
      if (isCoreError(error)) {
        return c.json(
          {
            ok: false,
            error: { code: error.code, message: error.message, details: error.details },
          },
          STATUS_BY_CODE[error.code],
        );
      }
      console.error(`[design-tool] command ${name} failed`, error);
      return c.json(
        {
          ok: false,
          error: { code: "INTERNAL", message: (error as Error).message ?? "Internal error" },
        },
        500,
      );
    }
  });

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = core.events.subscribe((event) => {
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
      });
      const heartbeat = setInterval(
        () => void stream.writeSSE({ event: "ping", data: "{}" }),
        options.heartbeatMs ?? 15_000,
      );
      await stream.writeSSE({
        event: "ready",
        data: JSON.stringify({ name: core.workspace.config.name }),
      });
      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(heartbeat);
      unsubscribe();
    }),
  );

  app.all("/mcp", (c) => mcp.fetch(c.req.raw));

  app.all("/api/*", (c) =>
    c.json({ ok: false, error: { code: "NOT_FOUND", message: "Unknown API route" } }, 404),
  );

  app.get("*", async (c) => {
    if (!options.webRoot) return c.html(MISSING_UI_HTML);
    const root = path.resolve(options.webRoot);
    const requested = path.resolve(root, `.${decodeURIComponent(c.req.path)}`);
    if (requested.startsWith(root + path.sep) && path.extname(requested)) {
      const immutable = requested.includes(`${path.sep}assets${path.sep}`);
      const asset = await fileResponse(requested, {
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      });
      if (asset) return asset;
      return c.notFound();
    }
    // SPA fallback for client-side routes.
    return (
      (await fileResponse(path.join(root, "index.html"), { "cache-control": "no-cache" })) ??
      c.html(MISSING_UI_HTML)
    );
  });

  return app;
}

const MISSING_UI_HTML = `<!doctype html><meta charset="utf-8"><title>design-tool</title>
<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>design-tool</h1>
<p>The API is running, but the web UI hasn't been built. Run <code>pnpm build</code> in the design-tool repo,
or use <code>pnpm dev</code> for the development UI.</p>
<p>API: <a href="/api/commands">/api/commands</a> · MCP: <code>/mcp</code></p>
</body>`;
