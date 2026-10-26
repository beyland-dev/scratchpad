import type { MiddlewareHandler } from "hono";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]", "::1"];

function hostnameOf(hostHeader: string): string {
  if (hostHeader.startsWith("[")) return hostHeader.slice(0, hostHeader.indexOf("]") + 1);
  return hostHeader.split(":")[0] ?? "";
}

export interface GuardOptions {
  /** Extra hostnames accepted in the Host header (e.g. a LAN IP when binding 0.0.0.0). */
  allowedHosts?: string[];
  /** Origins allowed to make browser requests, e.g. the app's own origin. */
  allowedOrigins?: () => string[];
  /** Require a JSON content type on state-changing methods. Default true. */
  requireJson?: boolean;
}

/**
 * Protects local endpoints from DNS rebinding and cross-site requests:
 * - the Host header must be a local (or explicitly allowed) hostname;
 * - browser requests carrying an Origin header must come from an allowed origin
 *   (the sandbox origin and sandboxed `null` origins are rejected);
 * - state-changing requests must be JSON, which forces a CORS preflight that we never grant.
 */
export function localGuard(options: GuardOptions = {}): MiddlewareHandler {
  const hosts = new Set(
    [...LOCAL_HOSTNAMES, ...(options.allowedHosts ?? [])].map((h) => h.toLowerCase()),
  );
  return async (c, next) => {
    const host = c.req.header("host");
    if (!host || !hosts.has(hostnameOf(host).toLowerCase())) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "Host not allowed" } }, 403);
    }
    const origin = c.req.header("origin");
    if (origin !== undefined) {
      const allowed = options.allowedOrigins?.() ?? [];
      if (!allowed.includes(origin)) {
        return c.json(
          { ok: false, error: { code: "FORBIDDEN", message: `Origin ${origin} not allowed` } },
          403,
        );
      }
    }
    if (options.requireJson === false) return next();
    if (
      c.req.method === "POST" ||
      c.req.method === "PUT" ||
      c.req.method === "PATCH" ||
      c.req.method === "DELETE"
    ) {
      const type = c.req.header("content-type") ?? "";
      if (!type.toLowerCase().startsWith("application/json")) {
        return c.json(
          {
            ok: false,
            error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Expected application/json" },
          },
          415,
        );
      }
    }
    await next();
  };
}
