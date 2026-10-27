# Agentic design tool

An open-source, local-first workspace for **design prototyping with agents**.

Agents create lots of prototypes. People view, compare, and switch between them.
Everything is plain files in a git-friendly folder, and every capability is
available to agents over **MCP**, a **CLI**, and an **HTTP API**.

> **Status:** early (Phase 1). The core prototype loop works end to end. See the [roadmap](#roadmap)
> for what's next: design-system context from messy codebases, docs, feedback, connectors, and handoff.

## Why

Product design work is spread across many tools: prototyping, docs, Slack and Teams threads,
research platforms, meeting recordings, and handoff. design-tool aims to bring that loop together:

**product codebase (context)** → **many agent-made prototypes** → **feedback from real people** → **iteration** → **handoff to production agents**

## Quickstart

Requirements: Node.js ≥ 22.18 and pnpm (the repo pins pnpm 12 via `packageManager`).

```bash
pnpm install
pnpm build                       # builds the packages and the web UI

# Create a workspace anywhere (e.g. next to your product repo)
pnpm dt init ../my-designs --name "My Product"
pnpm dt serve -w ../my-designs   # opens http://127.0.0.1:7420
```

Register the product codebase as a **read-only reference source**, so agents can match
its design system:

```bash
pnpm dt source add ../my-product -w ../my-designs --notes "tokens in src/theme, components in src/ui"
```

### Connect an agent

```bash
pnpm dt mcp-config -w ../my-designs          # prints snippets for VS Code, Claude Code, Cursor, Copilot CLI
pnpm dt init ../other --mcp vscode,claude    # or write project-level MCP configs during init
```

- **stdio:** `dt mcp -w <workspace>`. Recommended; it works without the server running.
- **HTTP:** `http://127.0.0.1:7420/mcp` while `dt serve` is running.

Then ask your agent something like:

> Use the design-tool MCP server. Read the `design-tool://guide` resource and call `workspace_info`.
> Then create 3 prototype variants of a simpler checkout in the right project, grouped as "checkout-redesign", matching
> our design system from the registered sources. Share the viewer URLs.

Prototypes appear in the gallery live as the agent writes them.

## Concepts

| Concept           | What it is                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**       | A product or effort being designed (e.g. a web app). Prototypes and design systems belong to one via their `project` field. Lives in `.design/projects/<id>/` with an optional icon.                                                                                                  |
| **Workspace**     | A folder containing `.design/`. Commit it to git, or keep it next to your product repo.                                                                                                                                                                                               |
| **Prototype**     | A self-contained folder of HTML/CSS/JS (`.design/prototypes/<id>/`) with a `prototype.json` for metadata.                                                                                                                                                                             |
| **Group**         | A free-form exploration name clustering related prototypes (e.g. `checkout-redesign`).                                                                                                                                                                                                |
| **Variant**       | A prototype linked to another via `variantOf`. A prototype and its variants form one family: one gallery card that opens the latest version.                                                                                                                                          |
| **Source**        | A product codebase (local path or git URL) used as a read-only reference for tokens, components, and styles.                                                                                                                                                                          |
| **Design system** | Either tokens and verified web components codified from a running product, or an existing library (shadcn/ui, Primer, …) installed and customized for React prototypes (`.design/systems/<id>/`), plus a generated agent skill. See [docs/design-systems.md](docs/design-systems.md). |

## The app

- **Projects:** a sidebar lists projects as icon tiles (collapsible to a narrow rail; press `[`). Each project has its own prototypes and design systems.
- **Gallery:** a grid with one card per variant family: single prototypes show their preview, and families show a folder of their newest versions. Filter by status and group, search titles, descriptions, groups and tags (press `/`), and select 2+ cards to compare.
- **Viewer:** a full-window stage with device presets (Desktop / Laptop / Tablet / Mobile), multi-page navigation, a version switcher (V1, V2, … Latest; ← → or 1–9), and an optional details panel (status, group, tags, files).
- **Compare:** up to 4 prototypes side by side at the same viewport.
- **Design systems:** browse components with examples in every theme, explore tokens visually (colors, type scale, spacing, shadows, icons) with per-token details, and watch an audit live (progress, what needs attention, captures with screenshot, DOM, matched CSS and geometry, activity) with verification results.
- **Live updates:** edits from agents, the CLI, or your editor appear immediately. The app only shows the connection status when it's lost.
- **Sandboxing:** prototypes run in sandboxed iframes on a separate origin (port `7421`), so untrusted agent code can't reach the app or API.

## CLI

```text
dt init [dir]                Create a workspace (--name, --no-example, --mcp vscode,claude,cursor)
dt serve                     Start app + sandbox servers (--port, --sandbox-port, --host, --no-open)
dt mcp                       MCP server over stdio
dt mcp-config [client]       Print MCP config snippets
dt commands                  List core commands with JSON schemas

dt workspace info
dt project list | get <id> | create | update <id> | delete <id>
dt source list | add <location> | remove <id>
dt prototype list | get <id> | create | update <id> | create-variant <id>
dt prototype write-file <id> <path> --content @file | read-file <id> <path>
dt prototype delete <id> | urls <id>

dt system list | get <id> | create | build <id> | coverage <id> | activity <id>
dt capture element | tokens | verify | outline | evaluate | list <system>
dt component list | get | create | update | search
dt skills install
```

Every core command is generated from the same registry that powers MCP and HTTP. Flags come from
each command's schema (`dt prototype create --help`). Values starting with `@` are read from
files, and `--json` prints machine-readable output.

## Development

```bash
pnpm install
pnpm dev        # Vite dev server (http://localhost:5173) + API server on a ./playground workspace
pnpm test       # all package tests (Vitest via `vp test`)
pnpm check      # format + lint + type check (`vp check`)
pnpm ready      # check + test + build
pnpm dt <args>  # run the CLI from source
```

The toolchain is [Vite+](https://viteplus.dev) (`vp`). Packages are consumed as TypeScript source
during development (Node runs `.ts` natively), and `vp pack` builds `dist/` for publishing.

See [docs/architecture.md](docs/architecture.md), [docs/workspace-format.md](docs/workspace-format.md) and [docs/design-systems.md](docs/design-systems.md).

## Roadmap

1. **Foundation + prototype core** ✅: workspace format, command registry, HTTP/MCP/CLI, gallery/viewer/compare.
2. **Design-system context** (in progress): capture tokens and components from a running product, verify them against the real UI, and generate agent skills. The VS Code audit is the testbed.
3. **Docs editor:** Markdown-based UX and research plans with a rich editor, linked to prototypes.
4. **Feedback + sharing:** comments pinned to prototypes, and share links for real people.
5. **Connectors:** Slack/Teams threads, unmoderated research tools, meeting transcripts, with synthesis that feeds back into iterations.
6. **Handoff:** bundles of the chosen prototype, spec, design-system mapping, and decisions for production agents.
7. **Extensibility:** skills, prompt templates, and plugin connectors.

## License

[MIT](LICENSE)
