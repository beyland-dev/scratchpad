# Design workspace: Playground

This folder is a **design-tool workspace**. It holds design prototypes that are
created mostly by agents and reviewed by people. These conventions apply
whether you use the MCP tools or edit files directly.

## Layout

```
.design/
  workspace.json            # workspace name + reference sources (product codebases)
  prototypes/
    <id>/                   # one folder per prototype; the folder name is the id
      prototype.json        # metadata (managed by design-tool; see schema below)
      index.html            # entry file, served in a sandbox
      ...                   # any other pages/assets, referenced with relative paths
  AGENTS.md                 # this guide
```

## Prototypes

- A prototype is a **self-contained static web page or mini-site**. Use plain
  HTML/CSS/JS. Inline everything or use relative paths. CDN scripts are fine if
  necessary, but keep it so the prototype works when opened alone.
- Prototypes run in a **sandboxed iframe on a separate origin**. They can run
  scripts but can't access the design-tool app, cookies, or storage of other
  prototypes. Don't rely on `localStorage` persisting.
- Make prototypes **realistic**: real-looking content, the product's actual
  design tokens and components (see *Sources*), and real interaction states
  where they matter.
- Prefer **many small explorations** over one big page. Use:
  - `group` to cluster prototypes exploring the same problem (e.g. "checkout-redesign").
  - **variants** (`prototype.createVariant`) for alternatives of an existing
    prototype. Variants are linked with `variantOf` and people can flip between
    them in the viewer.
- Never overwrite someone else's prototype to try an alternative. Create a variant.
- Set `status` as work progresses: `draft` → `review` → `approved` (or `archived`).

### prototype.json

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

If you write files directly, a folder with just an `index.html` is also picked
up. Metadata is then inferred from the folder name and the page `<title>`.

## Sources

`workspace.json` lists **reference sources**: product codebases and other
places that are the source of truth for the design system (tokens, components,
styles, copy). **Treat sources as read-only.** Read them to match the product's
look and feel, and record which sources you used in `sourceRefs`.

## Tools

The same operations are available over MCP, the HTTP API (`POST /api/commands/<name>`),
and the `dt` CLI:

| Command | Purpose |
|---|---|
| `workspace.info` | Orient yourself: sources, counts, groups, URLs |
| `source.list` / `source.add` / `source.remove` | Manage reference sources |
| `prototype.list` / `prototype.get` | Browse prototypes |
| `prototype.create` | New prototype (`html` or `files`) |
| `prototype.createVariant` | Copy a prototype as a linked alternative |
| `prototype.writeFile` / `prototype.readFile` | Edit prototype files |
| `prototype.update` | Edit metadata (status, group, tags, …) |
| `prototype.delete` | Move to trash |
| `prototype.urls` | Viewer + raw URLs to share with a person |

MCP tool names use underscores instead of dots (e.g. `prototype_create`).

After creating or changing prototypes, **share the viewer URL** so a person can
review, compare, and switch between variants.
