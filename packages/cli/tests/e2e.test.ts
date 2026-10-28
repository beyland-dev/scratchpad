import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { BIN_PATH, main } from "../src/index.ts";

// End-to-end: real processes for `dt serve` and `dt mcp`, talking over HTTP and stdio.

let dir: string;
let serve: ChildProcess;
let serverInfo: { url: string; sandboxUrl: string; mcpUrl: string };

const silent = { stdout: () => {}, stderr: () => {}, env: {} };

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dt-e2e-"));
  expect(await main(["init", "--name", "E2E"], { ...silent, cwd: dir })).toBe(0);
  expect(
    await main(["prototype", "create", "--title", "From CLI", "--html", "<h1>cli</h1>"], {
      ...silent,
      cwd: dir,
    }),
  ).toBe(0);

  serve = spawn(
    process.execPath,
    [BIN_PATH, "serve", "--json", "--no-open", "--port", "0", "--sandbox-port", "0", "-w", dir],
    {
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  serverInfo = await new Promise((resolve, reject) => {
    let buffer = "";
    serve.stdout!.setEncoding("utf8");
    serve.stdout!.on("data", (chunk: string) => {
      buffer += chunk;
      try {
        resolve(JSON.parse(buffer));
      } catch {
        // wait for the full JSON payload
      }
    });
    serve.once("exit", (code) => reject(new Error(`dt serve exited with ${code}`)));
  });
});

afterAll(async () => {
  if (serve && serve.exitCode === null) {
    const exited = new Promise((resolve) => serve.once("exit", resolve));
    serve.kill("SIGTERM");
    await exited;
  }
  await rm(dir, { recursive: true, force: true });
});

async function api<T>(name: string, input: unknown = {}): Promise<T> {
  const response = await fetch(`${serverInfo.url}/api/commands/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { ok: boolean; result: T };
  expect(body.ok).toBe(true);
  return body.result;
}

test("an agent over stdio MCP creates prototypes that the running server sees and serves", async () => {
  const client = new Client({ name: "e2e-stdio", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [BIN_PATH, "mcp", "-w", dir] }),
  );
  try {
    const info = await client.callTool({ name: "workspace_info", arguments: {} });
    expect(info.structuredContent).toMatchObject({ name: "E2E" });

    const created = await client.callTool({
      name: "prototype_create",
      arguments: {
        title: "Agent Idea",
        group: "ideas",
        html: "<h1>agent</h1>",
        createdBy: { kind: "agent", name: "e2e" },
      },
    });
    expect(created.isError).toBeFalsy();
    await client.callTool({
      name: "prototype_createVariant",
      arguments: { id: "agent-idea", description: "Idea B" },
    });
  } finally {
    await client.close();
  }

  // The server picks up files written by the separate MCP process via its watcher.
  await expect
    .poll(
      async () =>
        (await api<{ prototypes: { id: string }[] }>("prototype.list")).prototypes
          .map((p) => p.id)
          .sort(),
      {
        timeout: 5000,
      },
    )
    .toEqual(["agent-idea", "agent-idea-v2", "from-cli", "welcome"]);

  const urls = await api<{ raw: string; viewer: string }>("prototype.urls", {
    id: "agent-idea-v2",
  });
  expect(urls.viewer).toBe(`${serverInfo.url}/p/agent-idea-v2`);
  expect(urls.raw.startsWith(serverInfo.sandboxUrl)).toBe(true);
  expect(await (await fetch(urls.raw)).text()).toBe("<h1>agent</h1>");
});

test("an agent over HTTP MCP can iterate on a prototype", async () => {
  const client = new Client({ name: "e2e-http", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(serverInfo.mcpUrl)));
  try {
    const result = await client.callTool({
      name: "prototype_writeFile",
      arguments: { id: "from-cli", path: "index.html", content: "<h1>cli v2</h1>" },
    });
    expect(result.isError).toBeFalsy();
  } finally {
    await client.close();
  }
  const raw = (await api<{ raw: string }>("prototype.urls", { id: "from-cli" })).raw;
  expect(await (await fetch(raw)).text()).toBe("<h1>cli v2</h1>");
});

test("the API rejects browser requests from the sandbox origin", async () => {
  const response = await fetch(`${serverInfo.url}/api/commands/workspace.info`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: serverInfo.sandboxUrl },
    body: "{}",
  });
  expect(response.status).toBe(403);
});
