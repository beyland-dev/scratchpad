import type { AddressInfo } from "node:net";
import { DEFAULT_HOST, DEFAULT_PORT, DEFAULT_SANDBOX_PORT, type Core } from "@beyland/sprue-core";
import { createAdaptorServer, type ServerType } from "@hono/node-server";
import type { Hono } from "hono";
import { createApp } from "./app.ts";
import { createSandboxApp } from "./sandbox.ts";

export interface StartServerOptions {
  core: Core;
  host?: string;
  port?: number;
  sandboxPort?: number;
  /** Fail instead of trying the next free port when a port is taken. */
  strictPort?: boolean;
  /** Directory with the built web UI. */
  webRoot?: string;
  /** Extra hostnames accepted in the Host header. */
  allowedHosts?: string[];
  /** Extra browser origins allowed to call the API (e.g. a Vite dev server). */
  extraOrigins?: string[];
}

export interface RunningServer {
  url: string;
  sandboxUrl: string;
  close(): Promise<void>;
}

const PORT_ATTEMPTS = 20;

async function listen(
  app: Hono,
  host: string,
  port: number,
  strict: boolean,
): Promise<{ server: ServerType; port: number }> {
  let lastError: unknown;
  const attempts = strict || port === 0 ? 1 : PORT_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const candidate = port + i;
    const server = createAdaptorServer({ fetch: app.fetch });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(candidate, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return { server, port: (server.address() as AddressInfo).port };
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw lastError;
}

function displayHost(host: string): string {
  if (host === "0.0.0.0" || host === "::") return "localhost";
  return host.includes(":") ? `[${host}]` : host;
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    if ("closeAllConnections" in server) server.closeAllConnections();
  });
}

/** Start the app server (UI, API, SSE, MCP) and the sandbox server for prototype files. */
export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  const { core } = options;
  const settings = core.workspace.config.server ?? {};
  const host = options.host ?? settings.host ?? DEFAULT_HOST;
  const strict = options.strictPort ?? false;
  let appUrl = "";

  const sandbox = await listen(
    createSandboxApp({ core, allowedHosts: options.allowedHosts }),
    host,
    options.sandboxPort ?? settings.sandboxPort ?? DEFAULT_SANDBOX_PORT,
    strict,
  );
  const sandboxUrl = `http://${displayHost(host)}:${sandbox.port}`;

  const appServer = await listen(
    createApp({
      core,
      webRoot: options.webRoot,
      allowedHosts: options.allowedHosts,
      allowedOrigins: () => [appUrl, ...(options.extraOrigins ?? [])],
    }),
    host,
    options.port ?? settings.port ?? DEFAULT_PORT,
    strict,
  ).catch(async (error: unknown) => {
    await closeServer(sandbox.server);
    throw error;
  });
  appUrl = `http://${displayHost(host)}:${appServer.port}`;

  core.setUrls({ app: appUrl, sandbox: sandboxUrl });

  return {
    url: appUrl,
    sandboxUrl,
    async close() {
      core.setUrls(undefined);
      await Promise.all([closeServer(appServer.server), closeServer(sandbox.server)]);
    },
  };
}

/** Start only the sandbox server (e.g. for capture/verification from the CLI or a stdio MCP process). */
export async function startSandbox(options: {
  core: Core;
  host?: string;
  port?: number;
}): Promise<{ url: string; close(): Promise<void> }> {
  const host = options.host ?? DEFAULT_HOST;
  const sandbox = await listen(
    createSandboxApp({ core: options.core }),
    host,
    options.port ?? 0,
    options.port !== undefined,
  );
  return {
    url: `http://${displayHost(host)}:${sandbox.port}`,
    close: () => closeServer(sandbox.server),
  };
}
