# Architecture

design-tool is an **open core with a thin UI**. All behavior lives in a headless core. The web UI,
HTTP API, MCP server, and CLI are thin adapters over it, so anything a person can do, an agent can do too.

```
                ┌──────────────────────────────────────────────┐
                │              @design-tool/core               │
                │  Workspace · PrototypeStore · EventBus       │
                │  CommandRegistry (zod schemas + handlers)    │
                │  File watcher (chokidar)                     │
                └───────▲───────────────▲───────────────▲──────┘
                        │               │               │
          ┌─────────────┴───┐   ┌───────┴───────┐   ┌───┴──────────────┐
          │ @design-tool/mcp│   │ @design-tool/ │   │ @design-tool/cli │
          │ tools+resources │   │ server (Hono) │   │ `dt` (generated  │
          │ stdio / HTTP    │   │ API·SSE·MCP   │   │ subcommands)     │
          └─────────────────┘   │ sandbox origin│   └──────────────────┘
                                └───────▲───────┘
                                        │ /api/commands, /api/events
                                ┌───────┴───────┐
                                │ apps/web      │
                                │ Preact UI     │
                                └───────────────┘
```

## Packages

| Package           | Responsibility                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Workspace discovery/init, on-disk format, prototype storage, the command registry, the event bus, and the file watcher. No HTTP, no UI.                                                        |
| `packages/mcp`    | Builds an `McpServer` from the registry: one tool per command (`prototype.create` → `prototype_create`), plus the `design-tool://guide` resource. Serves stdio or a web-standard HTTP handler. |
| `packages/server` | Hono app server (`/api/commands/:name`, `/api/events` SSE, `/mcp`, built UI) and a separate **sandbox server** for prototype files.                                                            |
| `packages/cli`    | The `dt` binary: `init`, `serve`, `mcp`, `mcp-config`, plus a subcommand per registry command, with flags derived from its JSON schema.                                                        |
| `apps/web`        | Preact + signals UI. Calls commands over HTTP and live-updates from SSE.                                                                                                                       |

## One command, every surface

Commands are defined once with `defineCommand({ name, title, description, kind, input, handler, format?, positional? })`:

- **HTTP:** `POST /api/commands/<name>` with a JSON body. `GET /api/commands` lists every command with its JSON Schema.
- **MCP:** a tool named with underscores, with `readOnlyHint` and `destructiveHint` annotations derived from `kind`.
- **CLI:** `dt <group> <action>` with flags derived from the schema, and optional human-readable `format` output.

Input is validated by zod in `CommandRegistry.run`, so every surface gets the same validation and error codes
(`NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `NO_WORKSPACE`, `INTERNAL`).

Keep the registry the single API contract. Avoid UI-only endpoints.

## Files are the source of truth

All state lives in `.design/` (see [workspace-format.md](workspace-format.md)). The core keeps an
in-memory index that's rebuilt from disk, and a chokidar watcher re-reads a prototype whenever files
change under its folder, whoever changed them. That covers the API, the CLI, a separate `dt mcp`
process, an agent writing files directly, a `git checkout`, or an editor. Writes are atomic (temp file

- rename), and temp files are ignored by the watcher.

Events are intentionally coarse: `prototype.changed { id, exists, paths }` and `workspace.changed`. The
UI refetches and bumps a per-prototype revision to reload affected iframes.

## Security model (local)

Prototypes are untrusted, agent-generated code.

- **Separate origin:** prototype files are served by a second server (default port `7421`). The app
  server (default `7420`) never serves prototype content.
- **Iframe sandbox:** `sandbox="allow-scripts allow-forms allow-popups allow-modals"` without
  `allow-same-origin`, so embedded prototypes get an opaque origin.
- **API guard:** requests must use a local `Host` header (DNS-rebinding protection). Browser requests with
  an `Origin` must come from the app origin or an explicit `--dev-origin`, which rejects the sandbox origin
  and `null`. State-changing requests must be `application/json`, which forces a CORS preflight that is never granted.
- **Path safety:** all file access goes through `safeJoin`, which rejects absolute paths and traversal.
  `prototype.json` can't be written as a file or read from the sandbox.
- Servers bind to `127.0.0.1` by default.

## Development notes

- Packages export `./src/index.ts` during development. Node ≥ 22.18 runs TypeScript natively (type
  stripping), so no build step is needed to run the CLI or tests. `publishConfig.exports` points to `dist/`.
- TypeScript must stay erasable (`erasableSyntaxOnly`): no enums, namespaces, or parameter properties.
- Toolchain: Vite+ (`vp check`, `vp test`, `vp pack`, `vp build`, `vp run`).
