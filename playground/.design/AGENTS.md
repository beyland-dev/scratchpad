# Design workspace: VSC Design

This folder is a **design-tool workspace**. It holds design prototypes that are
created mostly by agents and reviewed by people. These conventions apply
whether you use the MCP tools or edit files directly.

## Layout

```
.design/
  workspace.json            # workspace name + reference sources (product codebases)
  projects/
    <id>/                   # one folder per project; the folder name is the id
      project.json          # name, description, color
      icon.svg              # optional icon (svg, png, webp or jpg)
  prototypes/
    <id>/                   # one folder per prototype; the folder name is the id
      prototype.json        # metadata (managed by design-tool; see schema below)
      index.html            # entry file, served in a sandbox
      ...                   # any other pages/assets, referenced with relative paths
  AGENTS.md                 # this guide
```

## Projects

A workspace holds one or more **projects**: the products or efforts being designed (e.g. a web
app, a marketing site). Every prototype and design system belongs to a project through its
`project` field. Check `project.list` (or `workspace.info`) and **put new work in the right
project**. If none fits, create one with `project.create`. When a workspace has exactly one
project, new prototypes and systems go into it automatically.

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
    prototype. Variants are linked with `variantOf`. A prototype and its variants
    form one family: the gallery shows a single card that opens the **newest**
    version, and the viewer labels versions V1, V2, … Latest by creation time.
- Never overwrite someone else's prototype to try an alternative. Create a variant.
- Set `status` as work progresses: `draft` → `review` → `approved` (or `archived`).

### prototype.json

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

If you write files directly, a folder with just an `index.html` is also picked
up. Metadata is then inferred from the folder name and the page `<title>`.

## Sources

`workspace.json` lists **reference sources**: product codebases and other
places that are the source of truth for the design system (tokens, components,
styles, copy). **Treat sources as read-only.** Read them to match the product's
look and feel, and record which sources you used in `sourceRefs`.

## Design systems

A workspace can contain **design systems** in `.design/systems/<id>/`: libraries of web
components and themed tokens codified from a real product. When a prototype should look like
that product, **build it from the design system** instead of writing CSS from scratch:

- `system_list` / `system_get` give you what's available and the two lines to include.
- `component_search` / `component_get` show components, their attributes and states, and a ready-to-paste snippet.
- `token_search` finds tokens (`var(--…)`) to style anything custom.
- Each system also has a generated skill (`skills_install` puts it in `.github/skills`).

To create or extend a design system from a codebase, follow the **design-system-audit** skill
(MCP resource `design-tool://skills/design-system-audit`, or `skills_install`).

### Package design systems and React prototypes

A design system can also be an **existing library** (shadcn/ui, Primer, …) installed and
configured in its folder (`kind: "package"`): a Vite + React project with `package.json`,
`vite.config.ts`, the theme stylesheet (`src/index.css`) and one shared `node_modules`.

- **Setting one up:** `system_create { kind: "package", library: { name, package, docsUrl } }` scaffolds
  the folder; run `npm install` there and add the library (for shadcn/ui:
  `npx shadcn@latest init -t vite -b radix -y --no-monorepo <components…>`). Put the product's
  customizations (theme variables under `:root` / `.dark`, fonts, wrapped components) in the folder.
- **Describing components:** write `stories/<name>.stories.tsx` (one exported React component per
  example), then `component_create { system, name, tag: "Button", title, description, import, story,
  docsUrl, examples: [{ title, html: "<JSX>", story: "<export>" }] }`. Tokens come from the theme
  stylesheet automatically. `system_build` renders the stories for the app.
- **Prototypes:** `prototype_create { framework: "react", system }`. The entry is an HTML shell that
  loads `main.tsx`; import the theme (`import "@/index.css"`) and components (`@/components/ui/…`).
  design-tool builds it with the system's Vite on demand (build errors show in the viewer). Never
  install packages into a prototype; add dependencies to the design system.

## Tools

The same operations are available over MCP, the HTTP API (`POST /api/commands/<name>`),
and the `dt` CLI:

| Command | Purpose |
|---|---|
| `workspace.info` | Orient yourself: projects, sources, counts, groups, URLs |
| `project.list` / `project.get` | Browse projects and what's in them |
| `project.create` / `project.update` / `project.delete` | Manage projects (name, color, icon) |
| `source.list` / `source.add` / `source.remove` | Manage reference sources |
| `prototype.list` / `prototype.get` | Browse prototypes |
| `prototype.create` | New prototype (`html` or `files`) |
| `prototype.createVariant` | Copy a prototype as a linked alternative |
| `prototype.writeFile` / `prototype.readFile` | Edit prototype files |
| `prototype.update` | Edit metadata (status, project, group, tags, …) |
| `prototype.delete` | Move to trash |
| `prototype.urls` | Viewer + raw URLs to share with a person |

MCP tool names use underscores instead of dots (e.g. `prototype_create`).

After creating or changing prototypes, **share the viewer URL** so a person can
review, compare, and switch between variants.
