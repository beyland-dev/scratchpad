# Architecture

Sprue is an **open core with a thin UI**. All behavior lives in a headless core. The web UI,
HTTP API, MCP server, and CLI are thin adapters over it, so anything a person can do, an agent can do too.

```
              ┌────────────────────────────────────────────────┐
              │              @beyland/sprue-core          │
              │  Workspace · ProjectStore → ProjectScope       │
              │    (prototypes · systems · reviews per project)│
              │  CommandRegistry · EventBus · file watcher     │
              │  git (project repos) · review export/publish   │
              └──────▲────────────────▲─────────────────▲──────┘
                     │                │                 │
       ┌─────────────┴──┐   ┌─────────┴────────┐   ┌────┴────────────────┐
       │ sprue-mcp │   │ sprue-server│   │ @beyland/sprue │
       │ tools+resources│   │ Hono: API·SSE·MCP│   │ CLI: `sprue`,  │
       │ stdio / HTTP   │   │ + sandbox origin │   │ `sp` (generated)    │
       └────────────────┘   └─────────▲────────┘   └─────────────────────┘
                                      │ /api/commands, /api/events
                              ┌───────┴───────┐        ┌───────────────────┐
                              │ apps/web      │        │ apps/review       │
                              │ Preact UI     │        │ static reviewer   │
                              └───────────────┘        │ app (exports)     │
                                                       └───────────────────┘
```

## Packages

| Package            | Responsibility                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`    | The workspace (`~/.sprue`), per-project storage, the command registry, the event bus, the file watcher, git operations, and review export/publish. No HTTP, no UI.                       |
| `packages/mcp`     | Builds an `McpServer` from the registry: one tool per command (`prototype.create` → `prototype_create`), plus the `sprue://guide` resource. Serves stdio or a web-standard HTTP handler. |
| `packages/server`  | Hono app server (`/api/commands/:name`, `/api/events` SSE, `/mcp`, built UI) and a separate **sandbox server** for prototype files, design system builds and review previews.            |
| `packages/cli`     | The `sprue` (`sp`) binary: `serve`, `mcp`, `mcp-config`, plus a subcommand per registry command, with flags derived from its JSON schema.                                                |
| `packages/capture` | Playwright-based capture and verification of components from running products.                                                                                                           |
| `apps/web`         | Preact + signals UI. Calls commands over HTTP and live-updates from SSE.                                                                                                                 |
| `apps/review`      | The static reviewer app copied into every review export: reads `review.json` and shows the options. Relative URLs only, so it works from any host and sub-path.                          |

## One command, every surface

Commands are defined once with `defineCommand({ name, title, description, kind, input, handler, format?, positional? })`:

- **HTTP:** `POST /api/commands/<name>` with a JSON body. `GET /api/commands` lists every command with its JSON Schema.
- **MCP:** a tool named with underscores, with `readOnlyHint` and `destructiveHint` annotations derived from `kind`.
- **CLI:** `sp <group> <action>` (up to three words, e.g. `sp project git status`) with flags derived
  from the schema, and optional human-readable `format` output.

Input is validated by zod in `CommandRegistry.run`, so every surface gets the same validation and error codes
(`NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `NO_WORKSPACE`, `INTERNAL`).

Keep the registry the single API contract. Avoid UI-only endpoints.

## Projects and references

Each project folder has a `ProjectScope` with its own `PrototypeStore`, `SystemStore` and
`ReviewStore`, which work with plain ids, as if the project were the whole world. `core.prototypes`,
`core.systems` and `core.reviews` span projects: they take a reference (`project/id`, or an id only
one project has), find the right scope, and forward. Generated artifacts (skills, system builds)
only ever see local ids. The web app identifies items by `project/id` too.

## Files are the source of truth

All state lives in `~/.sprue` (see [workspace-format.md](workspace-format.md)). The core keeps an
in-memory index that's rebuilt from disk, and a chokidar watcher re-reads a prototype, system,
review or project whenever files change under its folder, whoever changed them: the API, the CLI, a
separate `sp mcp` process, an agent writing files directly, a `git pull` or clone, or an editor.
The watcher skips `.git`, `node_modules`, trash, caches and generated folders. Writes are atomic
(temp file + rename), and temp files are ignored by the watcher.

Events are intentionally coarse: `prototype.changed`, `system.changed` and `review.changed`
(`{ project, id, exists }`), `project.changed` (`contents: true` when a whole folder appeared or
disappeared), and `workspace.changed`. The UI refetches and bumps per-item revisions to reload
affected iframes.

## Sharing

- **Git:** a project folder can be its own repo. Git (and `gh`, to create GitHub repos) runs as
  child processes with argument lists, never through a shell, using the user's own credentials.
- **Reviews:** `review.export` writes a self-contained static site: the reviewer app, `review.json`
  (only reviewer-facing fields), and frozen copies of the prototypes and the design system builds
  they load, laid out like the project folder so relative links keep working. `review.publish`
  pushes it as a new round to the `gh-pages` branch of the project's remote and turns on GitHub
  Pages. The preview is the same export, served from the sandbox origin.

## Security model (local)

Prototypes are untrusted, agent-generated code.

- **Separate origin:** prototype files are served by a second server (default port `7421`). The app
  server (default `7420`) never serves prototype content.
- **Iframe sandbox:** `sandbox="allow-scripts allow-forms allow-popups allow-modals"` without
  `allow-same-origin`, so embedded prototypes get an opaque origin, in the app and in published
  reviews alike. (Static hosts must send `Access-Control-Allow-Origin: *` for module scripts and
  fonts in opaque-origin frames; GitHub Pages does.)
- **API guard:** requests must use a local `Host` header (DNS-rebinding protection). Browser requests with
  an `Origin` must come from the app origin or an explicit `--dev-origin`, which rejects the sandbox origin
  and `null`. State-changing requests must be `application/json`, which forces a CORS preflight that is never granted.
- **Path safety:** all file access goes through `safeJoin`, which rejects absolute paths and traversal.
  `prototype.json` can't be written as a file or read from the sandbox.
- **Published reviews are public:** anyone with the link can open them; links are random and pages
  carry `noindex`, but they aren't access-controlled.
- Servers bind to `127.0.0.1` by default.

## Development notes

- Packages export `./src/index.ts` during development. Node ≥ 22.18 runs TypeScript natively (type
  stripping), so no build step is needed to run the CLI or tests. `publishConfig.exports` points to `dist/`.
- TypeScript must stay erasable (`erasableSyntaxOnly`): no enums, namespaces, or parameter properties.
- Toolchain: Vite+ (`vp check`, `vp test`, `vp pack`, `vp build`, `vp run`).
