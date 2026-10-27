import { access } from "node:fs/promises";
import path from "node:path";
import { DIST_DIR, PROTOTYPE_META_FILE, isCoreError, safeJoin, type Core } from "@design-tool/core";
import { Hono } from "hono";
import { fileResponse } from "./static.ts";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const SANDBOX_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "cross-origin-resource-policy": "cross-origin",
  "referrer-policy": "no-referrer",
  // Sandboxed iframes have an opaque ("null") origin, so fonts and module scripts load in CORS mode.
  // Prototype files are public within the sandbox origin, which holds no credentials.
  "access-control-allow-origin": "*",
};

export interface SandboxOptions {
  core: Core;
  allowedHosts?: string[];
}

/**
 * Serves prototype files on a separate origin so untrusted prototype code
 * can never read the app's origin, cookies, or API responses.
 */
export function createSandboxApp(options: SandboxOptions): Hono {
  const { core } = options;
  const hosts = new Set([...LOCAL_HOSTNAMES, ...(options.allowedHosts ?? [])]);
  const app = new Hono();

  app.use("*", async (c, next) => {
    const host = c.req.header("host") ?? "";
    const hostname = host.startsWith("[")
      ? host.slice(0, host.indexOf("]") + 1)
      : (host.split(":")[0] ?? "");
    if (!hosts.has(hostname.toLowerCase())) return c.text("Host not allowed", 403);
    await next();
  });

  app.get("/p/:id", (c) => c.redirect(`/p/${encodeURIComponent(c.req.param("id"))}/`, 301));

  // Project icons. Agent-written SVGs are untrusted, so they're served here (never on the app
  // origin) and with a CSP that blocks scripts if one is opened directly.
  app.get("/projects/:id/icon", async (c) => {
    const id = c.req.param("id");
    if (!core.projects.has(id)) return c.text("Not found", 404, SANDBOX_HEADERS);
    const file = core.projects.iconPathOf(id);
    const response = file
      ? await fileResponse(file, {
          ...SANDBOX_HEADERS,
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        })
      : undefined;
    return response ?? c.text("Not found", 404, SANDBOX_HEADERS);
  });

  // Design system builds: /s/<system>/system.css, system.js, specimen.html, assets/…
  app.get("/s/:id/*", async (c) => {
    const id = c.req.param("id");
    const prefix = `/s/${encodeURIComponent(id)}/`;
    let rest: string;
    try {
      rest = (c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : "")
        .split("/")
        .map(decodeURIComponent)
        .join("/");
    } catch {
      return c.text("Bad path", 400, SANDBOX_HEADERS);
    }
    if (!core.systems.has(id)) return c.text("Not found", 404, SANDBOX_HEADERS);
    // Captured references (screenshots, DOM) for side-by-side verification in the UI.
    const captureMatch =
      /^~captures\/([^/]+)\/(screenshot\.png|dom\.html|capture\.json|rules\.css|geometry\.json)$/.exec(
        rest,
      );
    if (captureMatch) {
      try {
        const response = await fileResponse(
          path.join(core.systems.captureDirOf(id, captureMatch[1]!), captureMatch[2]!),
          SANDBOX_HEADERS,
        );
        return response ?? c.text("Not found", 404, SANDBOX_HEADERS);
      } catch {
        return c.text("Not found", 404, SANDBOX_HEADERS);
      }
    }
    try {
      const dist = path.join(core.systems.dirOf(id), DIST_DIR);
      if (!(await pathExists(path.join(dist, "catalog.json")))) await core.buildSystem(id);
      const response = await fileResponse(safeJoin(dist, rest || "specimen.html"), SANDBOX_HEADERS);
      return response ?? c.text("Not found", 404, SANDBOX_HEADERS);
    } catch (error) {
      if (isCoreError(error)) return c.text(error.message, 400, SANDBOX_HEADERS);
      return c.text(`Build failed: ${(error as Error).message}`, 500, SANDBOX_HEADERS);
    }
  });

  app.get("/p/:id/*", async (c) => {
    const id = c.req.param("id");
    const prefix = `/p/${encodeURIComponent(id)}/`;
    const rawRest = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : "";
    let rest: string;
    try {
      rest = rawRest.split("/").map(decodeURIComponent).join("/");
    } catch {
      return c.text("Bad path", 400, SANDBOX_HEADERS);
    }
    const proto = core.prototypes.has(id) ? core.prototypes.get(id) : undefined;
    if (proto?.framework) {
      // Built by the design system's Vite on demand (cached until its files change).
      try {
        const dir = await core.buildPrototype(id);
        const relative = rest === "" ? proto.entry : rest;
        const response = await fileResponse(safeJoin(dir, relative), SANDBOX_HEADERS);
        return response ?? c.text("Not found", 404, SANDBOX_HEADERS);
      } catch (error) {
        if (rest !== "" && !/\.html?$/i.test(rest))
          return c.text("Build failed", 500, SANDBOX_HEADERS);
        return c.html(buildErrorPage(proto.title, (error as Error).message), 500, SANDBOX_HEADERS);
      }
    }
    try {
      const dir = core.prototypes.dirOf(id);
      const entry = proto ? proto.entry : "index.html";
      const relative = rest === "" ? entry : rest;
      if (relative === PROTOTYPE_META_FILE) return c.text("Not found", 404, SANDBOX_HEADERS);
      const response = await fileResponse(safeJoin(dir, relative), SANDBOX_HEADERS);
      return response ?? c.text("Not found", 404, SANDBOX_HEADERS);
    } catch (error) {
      if (isCoreError(error)) return c.text(error.message, 400, SANDBOX_HEADERS);
      throw error;
    }
  });

  app.get("*", (c) => c.text("design-tool prototype sandbox", 404, SANDBOX_HEADERS));

  return app;
}

function buildErrorPage(title: string, message: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${esc(title)}: build failed</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; padding: 32px; font: 14px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
      h1 { margin: 0 0 4px; font-size: 16px; color: #c22f3c; }
      p { margin: 0 0 16px; opacity: 0.7; }
      pre { margin: 0; padding: 14px 16px; border-radius: 8px; background: color-mix(in srgb, CanvasText 6%, Canvas); font: 12px/1.55 ui-monospace, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    <h1>Couldn't build this prototype</h1>
    <p>It's rebuilt automatically when its files or its design system change.</p>
    <pre>${esc(message)}</pre>
  </body>
</html>
`;
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
