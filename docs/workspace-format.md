# Workspace format (v2)

Scratchpad keeps everything in one folder per machine: `~/.scratchpad` (override it with
`$SCRATCHPAD_HOME` or `--home <dir>`). It's created on first use. Each project folder inside it is
self-contained, so it can be its own git repo, shared with collaborators (see [Git](#git)).

```
~/.scratchpad/
  config.json                     # machine-local settings (below); never committed
  AGENTS.md                       # conventions for agents (also the MCP resource scratchpad://guide)
  .cache/                         # derived data: React prototype builds, review previews
  .trash/                         # deleted projects (`project-<id>-<timestamp>`)
  projects/
    <project>/                    # one folder per project, often a git repo of its own
      project.json                # project metadata (below)
      icon.svg                    # optional icon: icon.svg, icon.png, icon.webp or icon.jpg
      .gitignore                  # generated and local-only files (written when the project is created)
      prototypes/
        <id>/
          prototype.json          # metadata (below)
          index.html              # entry file (configurable)
          ...                     # any other files: pages, CSS, JS, images
      systems/
        <id>/                     # design systems (see design-systems.md)
      reviews/
        <id>/
          review.json             # a review: prototypes packaged for feedback (below)
      .trash/                     # deleted prototypes, systems, components and reviews (gitignored)
```

Version 2 is a breaking change from v1 (`.design/` folders found by walking up from the current
directory, with prototypes and systems shared across projects). There's no automatic migration.

## `config.json`

```json
{
  "version": 2,
  "sources": [
    {
      "id": "web-app",
      "name": "web-app",
      "kind": "local",
      "location": "/Users/me/code/web-app",
      "notes": "tokens in src/theme, components in src/ui",
      "addedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "server": { "port": 7420, "sandboxPort": 7421, "host": "127.0.0.1" }
}
```

- `sources[].kind` is `local` (an absolute path) or `git` (URL). Sources are **read-only
  references**: Scratchpad never writes to them. They're machine-local, since paths differ between
  collaborators.
- `server` is optional and overrides the default ports and host for `scratchpad serve`.

## Projects

A project is a product or effort being designed. Its prototypes, design systems and reviews live in
its folder, so moving work between projects moves folders (`prototype.update { project }` does it
for a prototype). When the workspace has exactly one project, new prototypes and systems go into it
by default.

```json
{
  "name": "Web App",
  "description": "optional",
  "color": "#5b5bd6",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

- `color` (optional) tints the generated icon used when the project has no icon file, and `pattern`
  (optional, an integer) picks its abstract pattern. Without them, both are derived from the id.
- The icon is served from the sandbox origin, never the app origin, since it may be agent-written SVG.
- A folder without `project.json` is still a project (name inferred from the id, issue reported).

### `.gitignore`

New projects get a `.gitignore` for generated and local-only files: `.trash/`, `.cache/`, and each
design system's `dist/`, `skill/`, `source/`, `node_modules/` and `activity.jsonl`. Captures are
committed, so collaborators can see what components are verified against.

## Ids and references

Ids are folder names, unique **within a project**. Commands take a prototype, design system or
review as `project/id` (e.g. `web-app/checkout`), or just `id` when only one project has it; an
ambiguous id is an error that lists the matches. In files, references stay local to the project:
a prototype's `variantOf` and `system` name items in the same project.

### Prototype ids

The folder name is the id. Ids match `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$`. Generated ids are
lowercase slugs of the title, made unique with `-2`, `-3`, and so on. Variants default to `<root-id>-v<n>`, where
`<root-id>` is the family's original prototype and `<n>` is the family size after the fork.

## `prototype.json`

```json
{
  "title": "Checkout — single page",
  "description": "What this explores and why",
  "status": "draft",
  "tags": ["checkout"],
  "group": "checkout-redesign",
  "variantOf": "checkout-stepper",
  "entry": "index.html",
  "createdBy": { "kind": "agent", "name": "copilot" },
  "sourceRefs": ["web-app"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

| Field                    | Required | Notes                                                                                                                                                                                                                                                                                      |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`                  | yes      | Inferred from the entry's `<title>` or the folder name if missing.                                                                                                                                                                                                                         |
| `status`                 | no       | `draft` (default), `review`, `approved`, or `archived`.                                                                                                                                                                                                                                    |
| `tags`                   | no       | Free-form strings.                                                                                                                                                                                                                                                                         |
| `group`                  | no       | Exploration name used to cluster prototypes.                                                                                                                                                                                                                                               |
| `variantOf`              | no       | Id of the prototype (in the same project) this is an alternative of. A prototype and all its variants form a family, ordered by `createdAt`; the newest is the "Latest" version. Versions share the family's `title` (renaming one renames all); `description` says what each one changes. |
| `entry`                  | no       | Entry file, default `index.html`.                                                                                                                                                                                                                                                          |
| `createdBy`              | no       | `{ kind: "agent" \| "human", name? }`.                                                                                                                                                                                                                                                     |
| `sourceRefs`             | no       | Ids of sources (in `config.json`) used as references.                                                                                                                                                                                                                                      |
| `framework`              | no       | `react`: the entry is an HTML shell loading `main.tsx`, built on demand with a package design system (see docs/design-systems.md).                                                                                                                                                         |
| `system`                 | no       | A design system in the same project. With `framework`: the package system it's built with (defaults to the project's only one); otherwise the system whose themes the viewer offers (inferred from the `../../systems/<id>/` files it loads).                                              |
| `createdAt`, `updatedAt` | yes      | ISO timestamps. Inferred from the filesystem if missing.                                                                                                                                                                                                                                   |

### Lenient loading

Workspaces get edited by hand and by agents, so loading is forgiving:

- A folder with files but **no `prototype.json`** is still a prototype. Its metadata is inferred.
- **Invalid fields** are dropped individually, and the problem is reported in the prototype's `issues`
  (shown in the UI). The rest of the metadata is kept.
- A **missing entry file** is reported as an issue.

## Reviews

A review packages prototypes (specific versions) of a project for people to give feedback on. It's
published in **rounds**: each publish is a frozen, self-contained static copy (see
`packages/core/src/review-manifest.ts` for the exported `review.json` the reviewer app reads).

```json
{
  "title": "Checkout options",
  "intro": "Two takes on a faster checkout.",
  "questions": ["Which feels faster?"],
  "presentation": "both",
  "device": "desktop",
  "items": [
    { "prototype": "checkout-single", "label": "Option A" },
    { "prototype": "checkout-single-v2", "label": "Option B", "note": "Bigger pay button" }
  ],
  "slug": "checkout-options-3f9a1c2e",
  "rounds": [
    {
      "round": 1,
      "publishedAt": "2026-01-01T00:00:00.000Z",
      "target": "github-pages",
      "url": "https://owner.github.io/web-app/checkout-options-3f9a1c2e/round-1/",
      "path": "checkout-options-3f9a1c2e/round-1",
      "prototypes": [{ "id": "checkout-single", "updatedAt": "2026-01-01T00:00:00.000Z" }]
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

- `items[].label` and `note` are what reviewers see; prototype titles, descriptions and ids aren't
  exported.
- `presentation` is `sequence` (one at a time), `compare` (side by side) or `both`; `device` is the
  viewport options open at.
- Publishing pushes the round to the `gh-pages` branch of the project's remote under `<slug>/round-<n>/`,
  plus `<slug>/index.html`, which redirects to the latest round. `slug` is random, so links are
  hard to guess, and pages carry `noindex`, but anyone with a link can open it.
- `rounds[].prototypes` records what was published, so the app can show which options changed since.

## Git

Any project folder can be a git repo. `project.git.link` turns it into one (with a first commit) and
links it to a new GitHub repo (via the `gh` CLI) or an existing empty remote; `project.clone` adds a
collaborator's project by cloning it into `projects/`. `project.git.commit`, `pull`, `push` and
`sync` (commit, pull with rebase, push) share changes. A conflicting pull is rolled back and reports
the files, so the folder is never left mid-rebase.

## Versioning

`config.json` carries `version`. Future format changes will bump it and ship a migration.
