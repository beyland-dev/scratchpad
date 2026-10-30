import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Core, initWorkspace } from "@beyland/sprue-core";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { createMcpServer, toolNameFor } from "../src/index.ts";

let root: string;
let core: Core;
let client: Client;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "sp-mcp-"));
  await initWorkspace(root, { project: "MCP Test", example: false });
  core = await Core.open({ root });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createMcpServer(core).connect(serverTransport);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await core.close();
  await rm(root, { recursive: true, force: true });
});

test("exposes every core command as a tool with annotations", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  expect(names).toEqual(
    core.registry
      .list()
      .map((c) => toolNameFor(c.name))
      .sort(),
  );
  const list = tools.find((t) => t.name === "prototype_list");
  expect(list?.annotations).toMatchObject({ readOnlyHint: true });
  const del = tools.find((t) => t.name === "prototype_delete");
  expect(del?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  const create = tools.find((t) => t.name === "prototype_create");
  expect(create?.inputSchema).toMatchObject({ type: "object", required: ["title"] });
});

test("creates prototypes and returns structured results", async () => {
  const result = await client.callTool({
    name: "prototype_create",
    arguments: {
      title: "From Agent",
      html: "<h1>Agent</h1>",
      createdBy: { kind: "agent", name: "test" },
    },
  });
  expect(result.isError).toBeFalsy();
  expect(result.structuredContent).toMatchObject({
    prototype: { id: "from-agent", createdBy: { kind: "agent" } },
  });
  expect(core.prototypes.get("from-agent").title).toBe("From Agent");

  const variant = await client.callTool({
    name: "prototype_createVariant",
    arguments: { id: "from-agent" },
  });
  expect(variant.structuredContent).toMatchObject({ prototype: { variantOf: "from-agent" } });
});

test("reports errors as tool errors", async () => {
  const result = await client.callTool({ name: "prototype_get", arguments: { id: "missing" } });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("NOT_FOUND");
});

test("serves the workspace guide resource", async () => {
  const result = await client.readResource({ uri: "sprue://guide" });
  const first = result.contents[0];
  expect(first && "text" in first ? first.text : "").toContain("# Sprue");
});

test("serves the audit skill as a resource and a prompt", async () => {
  const resource = await client.readResource({ uri: "sprue://skills/design-system-audit" });
  const first = resource.contents[0];
  expect(first && "text" in first ? first.text : "").toContain("name: design-system-audit");
  const prompt = await client.getPrompt({
    name: "audit_design_system",
    arguments: { source: "vscode", system: "vscode" },
  });
  const message = prompt.messages[0]!.content;
  expect(message.type === "text" ? message.text : "").toContain(
    "Audit source `vscode` into the design system `vscode`",
  );
});

test("design system tools are exposed", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  expect(names).toEqual(
    expect.arrayContaining([
      "system_get",
      "component_search",
      "component_get",
      "token_search",
      "skills_install",
    ]),
  );
});
