# Sprue

An open-source, local-first workspace for **design prototyping with agents**.

Agents create lots of prototypes. People view, compare, and switch between them, then share them
with others for feedback. Everything is plain files in project folders that can each be a git
repo, and every capability is available to agents over **MCP**, a **CLI**, and an **HTTP API**.

> **Status:** early. The prototype loop, design systems, git-based project sharing, and publishing
> reviews to GitHub Pages work end to end. See the [roadmap](#roadmap) for what's next.

## Why

Product design work is spread across many tools: prototyping, docs, Slack and Teams threads,
research platforms, meeting recordings, and handoff. Sprue aims to bring that loop together:

**product codebase (context)** → **many agent-made prototypes** → **feedback from real people** → **iteration** → **handoff to production agents**

## Quickstart

Requirements: Node.js ≥ 22.18 and git. Install the self-contained CLI from npm, then start the app:

```bash
npm install --global @beyland/sprue
sp serve                              # opens http://127.0.0.1:7420
```

The CLI includes the visual UI, HTTP API, MCP server, and isolated prototype server. The GitHub CLI
(`gh`, signed in) is only needed to create GitHub repos and publish reviews to GitHub Pages.

To run from a source checkout instead:

```bash
pnpm install
pnpm build                          # builds the packages, the web UI and the reviewer app

pnpm sp serve                       # opens http://127.0.0.1:7420
```

Everything lives in `~/.sprue` (choose another folder in Settings, set `SPRUE_HOME`, or pass
`--home <dir>`); it's created on first use. Create a project from the sidebar, or:

```bash
pnpm sp project create --name "Web app"
pnpm sp project clone git@github.com:owner/web-app-designs.git   # or start from a shared one
```

Register the product codebase as a **read-only reference source**, so agents can match its design
system:

```bash
pnpm sp source add ~/code/web-app --notes "tokens in src/theme, components in src/ui"
```

### Connect an agent

```bash
npx -y @beyland/sprue mcp-config <client> --install   # copilot, claude, codex, antigravity, muse, cursor, opencode, pi
npx -y @beyland/sprue mcp-config                      # or just print every client's snippet
```

No global install needed: run from npx, the config launches Sprue through npx too (installing
globally with `npm install -g @beyland/sprue` gives you a plain `sp` command instead).

- **stdio:** `sp mcp`. Recommended; it works without the server running.
- **HTTP:** `http://127.0.0.1:7420/mcp` while `sp serve` is running.

The stdio command waits silently for an MCP client and uses `~/.sprue` by default.
`--install` adds Sprue to the client's user-level config with absolute executable paths, so it
works even when the client doesn't share your shell's `PATH` (re-run it after switching Node
versions). JSON configs (Copilot's `~/.copilot/mcp-config.json`, used by VS Code, the Copilot app, and the CLI, Cursor,
Antigravity, Muse Code, OpenCode, Pi) are merged in place, keeping other servers and comments; Claude Code and Codex
are configured through their own `claude mcp add` / `codex mcp add`. It's idempotent, and a
different existing `sprue` entry requires `--force`.

Then ask your agent something like:

> Use the Sprue MCP server. Read the `sprue://guide` resource and call `workspace_info`.
> Then create 3 prototype variants of a simpler checkout in the right project, grouped as "checkout-redesign", matching
> our design system from the registered sources. Share the viewer URLs.

Prototypes appear in the gallery live as the agent writes them.

## Concepts

| Concept           | What it is                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace**     | `~/.sprue`: machine-local settings (`config.json`) and every project.                                                                                                                                                                                                 |
| **Project**       | A product or effort being designed (e.g. a web app): a self-contained folder (`projects/<id>/`) with its prototypes, design systems and reviews. It can be its own git repo, shared with collaborators.                                                               |
| **Prototype**     | A self-contained folder of HTML/CSS/JS (`projects/<p>/prototypes/<id>/`) with a `prototype.json` for metadata. Ids are unique per project; commands accept `project/id`.                                                                                              |
| **Group**         | A free-form exploration name clustering related prototypes (e.g. `checkout-redesign`).                                                                                                                                                                                |
| **Variant**       | A prototype linked to another via `variantOf`. A prototype and its variants form one family with one name, told apart as V1, V2, … Latest: one gallery card that opens the latest version.                                                                            |
| **Source**        | A product codebase (local path or git URL) used as a read-only reference for tokens, components, and styles.                                                                                                                                                          |
| **Design system** | Tokens and verified web components codified from a running product, or an existing library (shadcn/ui, Primer, …) customized for React prototypes (`projects/<p>/systems/<id>/`), plus a generated agent skill. See [docs/design-systems.md](docs/design-systems.md). |
| **Review**        | Prototypes (specific versions) packaged for people to give feedback on, with labels, an intro and questions. Each publish is a frozen round on GitHub Pages (`projects/<p>/reviews/<id>/`).                                                                           |

## The app

- **Projects:** a sidebar lists projects as icon tiles (collapsible to a narrow rail; press `[`). Each project has tabs for its prototypes, design systems, feedback and handoff (handoff is a placeholder for now). **New project** starts one or clones a shared one from a repo.
- **Sharing a project:** **Share project** in the header puts the project folder in a git repo (a new GitHub repo, or an existing empty one). Then **Sync** commits your changes, pulls collaborators' and pushes, with counts of what's pending; Commit, Pull and Push are in its menu.
- **Gallery:** a grid with one card per variant family: single prototypes show their preview, and families show a folder of their newest versions. Filter by status and group, search titles, descriptions, groups and tags (press `/`), and select cards to compare or to **request feedback**.
- **Viewer:** a full-window stage with device presets (Desktop / Laptop / Tablet / Mobile), multi-page navigation, a version switcher (V1, V2, … Latest as tabs, or a ‹ V3 · 3/9 › stepper with a list of every version for large families; ← → or 1–9), and an optional details panel (status, group, tags, files).
- **Variants:** **New variant** in the viewer, or in a card's ⋯ menu, forks a version of the prototype: the new variant starts as a copy of its files, and the app gives you a prompt that asks an agent for the change. For families with several versions, you pick which one to fork.
- **Compare:** prototypes side by side at the same viewport and theme.
- **Feedback:** reviews package prototype versions for people outside the app. New reviews stay in the browser until their first save. Label the options (internal names stay private), add context and questions, choose one-at-a-time and/or side-by-side, **Preview** exactly what reviewers will see, and **Publish** a round to GitHub Pages from the project's repo. Each round is frozen; a stable link always opens the latest one, and the app shows which options changed since the last round. Deleting a review removes its published rounds from `gh-pages` before moving the local review to trash.
- **Design systems:** browse components with examples in every theme, explore tokens visually (colors, type scale, spacing, shadows, icons) with per-token details, and watch an audit live (progress, what needs attention, captures with screenshot, DOM, matched CSS and geometry, activity) with verification results.
- **Settings:** in the sidebar. Choose the app's theme, find current agent/product connection commands, and restore or permanently delete content from workspace and project trash.
- **Live updates:** edits from agents, the CLI, git pulls, or your editor appear immediately. The app only shows the connection status when it's lost.
- **Sandboxing:** prototypes run in sandboxed iframes on a separate origin (port `7421`), so untrusted agent code can't reach the app or API. Published reviews keep the same sandboxing.

## CLI

The CLI is `sprue`, or `sp` for short.

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

Every core command is generated from the same registry that powers MCP and HTTP. Flags come from
each command's schema (`sp prototype create --help`). Ids can be `project/id`. Values starting with
`@` are read from files, and `--json` prints machine-readable output. `--home <dir>` picks another
workspace folder.

## Development

```bash
pnpm install
pnpm dev        # Vite dev server (http://localhost:5173) + API server on ~/.sprue (or $SPRUE_HOME)
pnpm test       # all package tests (Vitest via `vp test`)
pnpm check      # format + lint + type check (`vp check`)
pnpm ready      # check + test + build
pnpm sp <args>  # run the CLI from source
```

### Desktop app

The Electron shell starts the same local Sprue server and opens the bundled web UI, using the
same `~/.sprue` workspace as the CLI:

```bash
pnpm --filter @beyland/sprue-desktop build:standalone
pnpm --filter @beyland/sprue-desktop start
```

The app bundles the `sp` CLI, run by its own runtime (no Node.js needed): **Install 'sp' command
in PATH** in the command palette (⌘K) links it into `/usr/local/bin` on macOS or `~/.local/bin`
on Linux, and **Settings → Connections** adds Sprue to an agent's MCP config in one click. Both
launch Sprue through the app's launcher script, so they keep working as the app updates.

Desktop packaging commands create unsigned artifacts in `apps/desktop/release/`:

```bash
pnpm --filter @beyland/sprue-desktop dist:mac    # universal macOS DMG
pnpm --filter @beyland/sprue-desktop dist:win    # x86_64 NSIS .exe installer
pnpm --filter @beyland/sprue-desktop dist:linux  # x86_64 AppImage and .deb
```

The `Desktop builds` GitHub Actions workflow runs the corresponding build on each operating system
when manually dispatched or when a `v*` tag is pushed.

The toolchain is [Vite+](https://viteplus.dev) (`vp`). Packages are consumed as TypeScript source
during development (Node runs `.ts` natively), and `vp pack` builds `dist/` for publishing.

See [docs/architecture.md](docs/architecture.md), [docs/workspace-format.md](docs/workspace-format.md) and [docs/design-systems.md](docs/design-systems.md).

## Roadmap

1. **Foundation + prototype core** ✅: workspace format, command registry, HTTP/MCP/CLI, gallery/viewer/compare.
2. **Design-system context** (in progress): capture tokens and components from a running product, verify them against the real UI, and generate agent skills. The VS Code audit is the testbed.
3. **Docs editor:** Markdown-based UX and research plans with a rich editor, linked to prototypes.
4. **Feedback + sharing** (in progress): ✅ git-backed projects and reviews published to GitHub Pages; next, collecting feedback in published reviews (comments pinned to prototypes) and more hosts.
5. **Connectors:** Slack/Teams threads, unmoderated research tools, meeting transcripts, with synthesis that feeds back into iterations.
6. **Handoff:** bundles of the chosen prototype, spec, design-system mapping, and decisions for production agents.
7. **Extensibility:** skills, prompt templates, and plugin connectors.

## License

[MIT](LICENSE)
