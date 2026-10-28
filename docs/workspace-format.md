# Workspace format (v1)

A design workspace is any folder containing `.design/workspace.json`. Tools find it by walking up
from the current directory, or from `--workspace <dir>` / `$DT_WORKSPACE`.

```
<workspace>/
  AGENTS.md                       # created by `dt init` if missing; points agents at .design/AGENTS.md
  .design/
    workspace.json                # workspace config (below)
    AGENTS.md                     # conventions for agents (also served as MCP resource scratchpad://guide)
    .gitignore                    # ignores .cache/ and .trash/
    projects/
      <id>/
        project.json              # project metadata (below)
        icon.svg                  # optional icon: icon.svg, icon.png, icon.webp or icon.jpg
    prototypes/
      <id>/
        prototype.json            # metadata (below)
        index.html                # entry file (configurable)
        ...                       # any other files: pages, CSS, JS, images
    .trash/                       # soft-deleted prototypes (`<id>-<timestamp>`)
    .cache/                       # reserved for derived data
```

## `workspace.json`

```json
{
  "version": 1,
  "name": "My Product",
  "description": "optional",
  "sources": [
    {
      "id": "web-app",
      "name": "web-app",
      "kind": "local",
      "location": "../web-app",
      "notes": "tokens in src/theme, components in src/ui",
      "addedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "server": { "port": 7420, "sandboxPort": 7421, "host": "127.0.0.1" }
}
```

- `sources[].kind` is `local` (path, absolute or relative to the workspace root) or `git` (URL).
  Sources are **read-only references**. scratchpad never writes to them.
- `server` is optional and overrides the default ports and host for `dt serve`.

## Projects

A project is a product or effort being designed. Prototypes and design systems belong to a
project through their `project` field; nothing is nested on disk, so moving work between projects
is a one-field change and viewer URLs stay stable. `dt init` creates one project named after the
workspace. While a workspace has exactly one project, new prototypes and systems default to it.

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
- Items whose `project` is missing or unknown show up under **Trash** in the app.
- A folder without `project.json` is still a project (name inferred from the id, issue reported).

## Prototype ids

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
  "project": "web-app",
  "group": "checkout-redesign",
  "variantOf": "checkout-stepper",
  "entry": "index.html",
  "createdBy": { "kind": "agent", "name": "copilot" },
  "sourceRefs": ["web-app"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

| Field                    | Required | Notes                                                                                                                                                                                                                                                                |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                  | yes      | Inferred from the entry's `<title>` or the folder name if missing.                                                                                                                                                                                                   |
| `status`                 | no       | `draft` (default), `review`, `approved`, or `archived`.                                                                                                                                                                                                              |
| `tags`                   | no       | Free-form strings.                                                                                                                                                                                                                                                   |
| `project`                | no       | Id of the project it belongs to.                                                                                                                                                                                                                                     |
| `group`                  | no       | Exploration name used to cluster prototypes.                                                                                                                                                                                                                         |
| `variantOf`              | no       | Id of the prototype this is an alternative of. A prototype and all its variants form a family, ordered by `createdAt`; the newest is the "Latest" version. Versions share the family's `title` (renaming one renames all); `description` says what each one changes. |
| `entry`                  | no       | Entry file, default `index.html`.                                                                                                                                                                                                                                    |
| `createdBy`              | no       | `{ kind: "agent" \| "human", name? }`.                                                                                                                                                                                                                               |
| `sourceRefs`             | no       | Ids of workspace sources used as references.                                                                                                                                                                                                                         |
| `framework`              | no       | `react`: the entry is an HTML shell loading `main.tsx`, built on demand with a package design system (see docs/design-systems.md).                                                                                                                                   |
| `system`                 | no       | With `framework`: the package design system it's built with (defaults to the project's only one).                                                                                                                                                                    |
| `createdAt`, `updatedAt` | yes      | ISO timestamps. Inferred from the filesystem if missing.                                                                                                                                                                                                             |

### Lenient loading

Workspaces get edited by hand and by agents, so loading is forgiving:

- A folder with files but **no `prototype.json`** is still a prototype. Its metadata is inferred.
- **Invalid fields** are dropped individually, and the problem is reported in the prototype's `issues`
  (shown in the UI). The rest of the metadata is kept.
- A **missing entry file** is reported as an issue.

## Versioning

`workspace.json` carries `version`. Future format changes will bump it and ship a migration.
