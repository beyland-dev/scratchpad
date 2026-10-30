# Sprue

Sprue is an open-source, local-first agentic design workspace.

Product design work is currently spread across many tools: Figma, prototyping, docs, Slack and Teams threads, research platforms, meeting recordings, and handoff. Sprue aims to condense and consolidate that loop into a single agent-driveable surface.

## Installation

### Desktop

Download the latest installer for macOS, Windows, or Linux from
[GitHub Releases](https://github.com/beyland-dev/sprue/releases/latest), then
open the downloaded file and follow the installation prompts.

### CLI (optional)

Install the `sp` CLI globally with npm:

```sh
npm install --global @sprue/cli
```

Alternatively, install it from the desktop app by opening the command palette (`⌘K`) and
running the "Install `sp` in PATH" command.

## CLI

```text
sp serve                     Start app + sandbox servers (--port, --sandbox-port, --host, --no-open)
sp mcp                       MCP server over stdio
sp mcp-config [client]       Print MCP config snippets (--install to add Sprue to the client)
sp commands                  List core commands with JSON schemas

sp workspace info
sp project list | get <id> | create | update <id> | delete <id> | clone <url>
sp project git status | link | commit | pull | push | sync [project]
sp source list | add <location> | remove <id>
sp prototype list | get <id> | create | update <id> | create-variant <id>
sp prototype write-file <id> <path> --content @file | read-file <id> <path>
sp prototype delete <id> | urls <id>
sp review list | get <id> | create | update <id> | delete <id>
sp review preview <id> | publish <id> | export <id> <folder>

sp system list | get <id> | create | build <id> | coverage <id> | activity <id>
sp capture element | tokens | verify | outline | evaluate | list <system>
sp component list | get | create | update | search
sp skills install
```

Every core command is generated from the same registry that powers MCP and HTTP. Flags come from each command's schema (`sp prototype create --help`). Ids can be `project/id`. Values starting with `@` are read from files, and `--json` prints machine-readable output. `--home <dir>` picks another workspace folder.

## Development

The toolchain is [Vite+](https://viteplus.dev) (`vp`). Packages are consumed as TypeScript source during development (Node runs `.ts` natively), and `vp pack` builds `dist/` for publishing.

See [docs/architecture.md](docs/architecture.md), [docs/workspace-format.md](docs/workspace-format.md) and [docs/design-systems.md](docs/design-systems.md).

```bash
pnpm install
pnpm dev        # Vite dev server (http://localhost:5173) + API server on ~/.sprue (or $SPRUE_HOME)
pnpm test       # All package tests (Vitest via `vp test`)
pnpm check      # Format + lint + type check (`vp check`)
pnpm ready      # Check + test + build
pnpm sp <args>  # Run the CLI from source
```

### Desktop

The Electron shell starts the same local Sprue server and opens the bundled web UI, using the same `~/.sprue` workspace as the CLI:

```bash
pnpm --filter @beyland/sprue-desktop build:standalone
pnpm --filter @beyland/sprue-desktop start
```

Desktop packaging commands create unsigned artifacts in `apps/desktop/release/`:

```bash
pnpm --filter @beyland/sprue-desktop dist:mac    # Apple silicon and Intel DMGs
pnpm --filter @beyland/sprue-desktop dist:win    # x86_64 NSIS .exe installer
pnpm --filter @beyland/sprue-desktop dist:linux  # x86_64 AppImage and .deb
```

The `Desktop builds` GitHub Actions workflow runs the corresponding build on each operating system when manually dispatched or when a `v*` tag is pushed.

## License

[MIT](LICENSE)
