import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Core, initWorkspace } from "@beyland/sprue-core";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  PickerUnavailableError,
  createApp,
  createSandboxApp,
  startServer,
  type RunningServer,
} from "../src/index.ts";

let root: string;
let core: Core;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dt-server-"));
  await initWorkspace(root, { project: "Server Test" });
  core = await Core.open({ root });
});

afterEach(async () => {
  await core.close();
  await rm(root, { recursive: true, force: true });
});

const HOST = { host: "127.0.0.1:7420" };
const JSON_HEADERS = { ...HOST, "content-type": "application/json" };

function call(
  app: ReturnType<typeof createApp>,
  name: string,
  input: unknown,
  headers: Record<string, string> = JSON_HEADERS,
) {
  return app.request(`/api/commands/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
}

describe("app API", () => {
  test("runs commands and maps errors to status codes", async () => {
    const app = createApp({ core });
    const created = await call(app, "prototype.create", { title: "Api Proto", html: "<p>x</p>" });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      ok: true,
      result: { prototype: { id: "api-proto" } },
    });

    const missing = await call(app, "prototype.get", { id: "nope" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const invalid = await call(app, "prototype.create", { title: "" });
    expect(invalid.status).toBe(400);

    const list = await app.request("/api/commands", { headers: HOST });
    const body = (await list.json()) as { result: { name: string }[] };
    expect(body.result.map((c) => c.name)).toContain("prototype.createVariant");
  });

  test("guards against foreign hosts, origins, and non-JSON posts", async () => {
    const app = createApp({ core, allowedOrigins: () => ["http://127.0.0.1:7420"] });
    expect(
      (
        await call(
          app,
          "workspace.info",
          {},
          { host: "evil.example", "content-type": "application/json" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await call(app, "workspace.info", {}, { ...JSON_HEADERS, origin: "http://127.0.0.1:7421" }))
        .status,
    ).toBe(403);
    expect(
      (await call(app, "workspace.info", {}, { ...JSON_HEADERS, origin: "null" })).status,
    ).toBe(403);
    expect(
      (await call(app, "workspace.info", {}, { ...HOST, "content-type": "text/plain" })).status,
    ).toBe(415);
    expect(
      (await call(app, "workspace.info", {}, { ...JSON_HEADERS, origin: "http://127.0.0.1:7420" }))
        .status,
    ).toBe(200);
  });

  test("folder picker endpoint returns the chosen path, null, or unavailable", async () => {
    const pick = async (picker: () => Promise<string | null>) => {
      const app = createApp({ core, pickFolder: picker });
      const res = await app.request("/api/pick-folder", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    expect(await pick(async () => "/tmp/app")).toMatchObject({
      status: 200,
      body: { ok: true, result: { path: "/tmp/app" } },
    });
    expect((await pick(async () => null)).body).toMatchObject({ result: { path: null } });
    expect(
      await pick(async () => {
        throw new PickerUnavailableError("none");
      }),
    ).toMatchObject({ status: 501, body: { ok: false, error: { code: "UNAVAILABLE" } } });
    const foreign = await createApp({ core, pickFolder: async () => "/x" }).request(
      "/api/pick-folder",
      { method: "POST", headers: { ...JSON_HEADERS, origin: "https://evil.example" }, body: "{}" },
    );
    expect(foreign.status).toBe(403);
  });

  test("serves the built UI with SPA fallback", async () => {
    const webRoot = path.join(root, "web");
    await mkdir(path.join(webRoot, "assets"), { recursive: true });
    await writeFile(path.join(webRoot, "index.html"), "<div id=app></div>");
    await writeFile(path.join(webRoot, "assets", "app.js"), "console.log(1)");
    const app = createApp({ core, webRoot });
    const page = await app.request("/projects/server-test/p/welcome", { headers: HOST });
    expect(await page.text()).toBe("<div id=app></div>");
    const asset = await app.request("/assets/app.js", { headers: HOST });
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect((await app.request("/assets/missing.js", { headers: HOST })).status).toBe(404);
  });
});

describe("sandbox", () => {
  test("serves project icons with a no-script CSP", async () => {
    await core.run("project.create", {
      name: "Iconic",
      icon: {
        format: "svg",
        content: '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
      },
    });
    const sandbox = createSandboxApp({ core });
    const icon = await sandbox.request("/projects/iconic/~icon", { headers: HOST });
    expect(icon.status).toBe(200);
    expect(icon.headers.get("content-type")).toContain("image/svg+xml");
    expect(icon.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect((await sandbox.request("/projects/server-test/~icon", { headers: HOST })).status).toBe(
      404,
    );
    expect((await sandbox.request("/projects/missing/~icon", { headers: HOST })).status).toBe(404);
  });

  test("React prototypes are built on demand; failures render an explanation", async () => {
    await core.run("system.create", { id: "kit", name: "Kit", kind: "package" });
    await core.run("prototype.create", { title: "App", framework: "react" });
    const sandbox = createSandboxApp({ core });
    const page = await sandbox.request("/projects/server-test/prototypes/app/", { headers: HOST });
    expect(page.status).toBe(500);
    const html = await page.text();
    expect(html).toContain("build this prototype");
    expect(html).toContain("npm install");
    expect(
      (await sandbox.request("/projects/server-test/prototypes/app/assets/x.js", { headers: HOST }))
        .status,
    ).toBe(500);
  });

  test("serves design system builds, building on demand", async () => {
    await core.run("system.create", { id: "acme", name: "Acme", prefix: "acme" });
    await core.run("component.create", {
      system: "acme",
      name: "x",
      tag: "acme-x",
      title: "X",
      css: ".acme-x{color:red}",
      js: "ds.define('acme-x', class extends ds.Element {});",
    });
    const sandbox = createSandboxApp({ core });
    const css = await sandbox.request("/projects/server-test/systems/acme/system.css", {
      headers: HOST,
    });
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("text/css");
    expect(await css.text()).toContain(".acme-x{color:red}");
    expect(
      (await sandbox.request("/projects/server-test/systems/acme/specimen.html", { headers: HOST }))
        .status,
    ).toBe(200);
    expect(
      (
        await sandbox.request("/projects/server-test/systems/acme/../../project.json", {
          headers: HOST,
        })
      ).status,
    ).not.toBe(200);
    expect(
      (await sandbox.request("/projects/server-test/systems/missing/system.css", { headers: HOST }))
        .status,
    ).toBe(404);
  });

  test("serves prototype files but not metadata or traversal", async () => {
    await core.prototypes.create("server-test", {
      title: "Sand",
      html: "<h1>sand</h1>",
      files: [{ path: "css/a b.css", content: "b{}" }],
    });
    const sandbox = createSandboxApp({ core });
    const page = await sandbox.request("/projects/server-test/prototypes/sand/", { headers: HOST });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("cache-control")).toBe("no-store");
    // Sandboxed (opaque-origin) frames load fonts and module scripts in CORS mode.
    expect(page.headers.get("access-control-allow-origin")).toBe("*");
    expect(await page.text()).toBe("<h1>sand</h1>");
    expect(
      await (
        await sandbox.request("/projects/server-test/prototypes/sand/css/a%20b.css", {
          headers: HOST,
        })
      ).text(),
    ).toBe("b{}");
    expect(
      (await sandbox.request("/projects/server-test/prototypes/sand", { headers: HOST })).status,
    ).toBe(301);
    expect(
      (
        await sandbox.request("/projects/server-test/prototypes/sand/prototype.json", {
          headers: HOST,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await sandbox.request("/projects/server-test/prototypes/sand/..%2F..%2Fproject.json", {
          headers: HOST,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await sandbox.request("/projects/server-test/prototypes/sand/", {
          headers: { host: "evil.example" },
        })
      ).status,
    ).toBe(403);
  });
});

describe("running server", () => {
  let server: RunningServer;

  beforeEach(async () => {
    await core.startWatching();
    server = await startServer({ core, port: 0, sandboxPort: 0 });
  });

  afterEach(async () => {
    await server.close();
  });

  test("reports live URLs and streams change events over SSE", async () => {
    expect(core.prototypeUrls("welcome").viewer).toBe(
      `${server.url}/projects/server-test/p/welcome`,
    );

    const controller = new AbortController();
    const response = await fetch(`${server.url}/api/events`, { signal: controller.signal });
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let received = "";
    const waitFor = async (needle: string) => {
      while (!received.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) throw new Error("stream ended");
        received += value;
      }
    };
    await waitFor("event: ready");

    await mkdir(path.join(root, "projects/server-test/prototypes/sse-proto"), { recursive: true });
    await writeFile(
      path.join(root, "projects/server-test/prototypes/sse-proto/index.html"),
      "<p>hi</p>",
    );
    await waitFor('"id":"sse-proto"');
    expect(received).toContain("event: prototype.changed");
    controller.abort();

    const raw = await fetch(core.prototypeUrls("sse-proto").raw);
    expect(await raw.text()).toBe("<p>hi</p>");
  });

  test("serves MCP over streamable HTTP", async () => {
    const client = new Client({ name: "http-test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.url}/mcp`)));
    const result = await client.callTool({
      name: "prototype_create",
      arguments: { title: "Via HTTP" },
    });
    expect(result.structuredContent).toMatchObject({ prototype: { id: "via-http" } });
    await client.close();
  });
});
