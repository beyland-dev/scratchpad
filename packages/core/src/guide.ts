export const AGENTS_GUIDE_RESOURCE = "scratchpad://guide";

/** Conventions for agents working in Scratchpad. Written to `~/.scratchpad/AGENTS.md` and served over MCP. */
export function renderAgentsGuide(): string {
  return `# Scratchpad

Scratchpad holds design prototypes that are created mostly by agents and reviewed by people.
These conventions apply whether you use the MCP tools or edit files directly.

## Layout

Everything lives in one folder per machine, \`~/.scratchpad\` (or \`$SCRATCHPAD_HOME\`). Each
project folder is self-contained and is often its own git repo, shared with collaborators.

\`\`\`
~/.scratchpad/
  config.json               # machine-local settings: reference sources, server ports
  AGENTS.md                 # this guide
  projects/
    <project>/              # one folder per project; the folder name is the id (often a git repo)
      project.json          # name, description, color
      icon.svg              # optional icon (svg, png, webp or jpg)
      prototypes/
        <id>/               # one folder per prototype; the folder name is the id
          prototype.json    # metadata (managed by Scratchpad; see schema below)
          index.html        # entry file, served in a sandbox
          ...               # any other pages/assets, referenced with relative paths
      systems/
        <id>/               # design systems (tokens + components) used by this project's prototypes
      reviews/
        <id>/review.json    # prototypes packaged for people to give feedback on
      .gitignore            # generated and local-only files (builds, node_modules, trash)
\`\`\`

## Projects and ids

A **project** is a product or effort being designed (e.g. a web app, a marketing site). Its
prototypes and design systems live inside its folder. Check \`project.list\` (or
\`workspace.info\`) and **put new work in the right project** with \`project\`; if none fits, create
one with \`project.create\`. With exactly one project, new work goes into it automatically.

Ids are unique **within a project** (they're folder names). Wherever a command takes a prototype or
design system id, you can pass \`project/id\` (e.g. \`web-app/checkout\`), or just \`id\` when only one
project has it. Results include both \`id\` and \`project\`.

## Prototypes

- A prototype is a **self-contained static web page or mini-site**. Use plain
  HTML/CSS/JS. Inline everything or use **relative paths** (never root-absolute ones like
  \`/styles.css\`), so the prototype works wherever it's hosted.
- Prototypes run in a **sandboxed iframe on a separate origin**. They can run
  scripts but can't access the Scratchpad app, cookies, or storage of other
  prototypes. Don't rely on \`localStorage\` persisting.
- Make prototypes **realistic**: real-looking content, the product's actual
  design tokens and components (see *Design systems* and *Sources*), and real interaction states
  where they matter.
- Prefer **many small explorations** over one big page. Use:
  - \`group\` to cluster prototypes exploring the same problem (e.g. "checkout-redesign").
  - **variants** (\`prototype.createVariant\`) for alternatives of an existing
    prototype. Variants are linked with \`variantOf\`. A prototype and its variants
    form one family: the gallery shows a single card that opens the **newest**
    version, and the viewer labels versions V1, V2, … Latest by creation time.
    Versions share the family's title (renaming one renames all), so put what a
    variant changes in its \`description\`.
- Never overwrite someone else's prototype to try an alternative. Create a variant.
- Set \`status\` as work progresses: \`draft\` → \`review\` → \`approved\` (or \`archived\`).

### prototype.json

\`\`\`json
{
  "title": "Checkout — single page",
  "description": "What this explores and why",
  "status": "draft",
  "tags": ["checkout"],
  "group": "checkout-redesign",
  "system": "web-app-ui",
  "variantOf": "checkout-stepper",
  "entry": "index.html",
  "createdBy": { "kind": "agent", "name": "copilot" },
  "sourceRefs": ["web-app"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
\`\`\`

\`variantOf\` and \`system\` refer to items in the same project. If you write files directly, a
folder with just an \`index.html\` is also picked up. Metadata is then inferred from the folder
name and the page \`<title>\`.

## Sources

\`config.json\` lists **reference sources**: product codebases and other places that are the
source of truth for the design system (tokens, components, styles, copy). They're local to this
machine. **Treat sources as read-only.** Read them to match the product's look and feel, and
record which sources you used in \`sourceRefs\`.

## Design systems

A project can contain **design systems** in \`systems/<id>/\`: libraries of web components and
themed tokens codified from a real product. When a prototype should look like that product,
**build it from the design system** instead of writing CSS from scratch:

- \`system_list\` / \`system_get\` give you what's available and the two lines to include. A plain
  HTML prototype at \`prototypes/<id>/index.html\` loads its project's system with relative paths:
  \`../../systems/<system>/system.css\` and \`../../systems/<system>/system.js\` (one more \`../\`
  per folder level for pages in subfolders).
- \`component_search\` / \`component_get\` show components, their attributes and states, and a ready-to-paste snippet.
- \`token_search\` finds tokens (\`var(--…)\`) to style anything custom.
- Each system also has a generated skill (\`skills_install\` exports it for your agent).
- **Don't build theme toggles into prototypes.** Set the theme the prototype opens in (e.g. the
  root context's \`theme\` attribute) and leave switching to Scratchpad's viewer, which offers the
  system's themes for prototypes that use it. Set the prototype's \`system\` when it isn't obvious
  (it's inferred from the \`systems/<id>/system.js\` it loads, or the project's only system).

To create or extend a design system from a codebase, follow the **design-system-audit** skill
(MCP resource \`scratchpad://skills/design-system-audit\`, or \`skills_install\`).

### Package design systems and React prototypes

A design system can also be an **existing library** (shadcn/ui, Primer, …) installed and
configured in its folder (\`kind: "package"\`): a Vite + React project with \`package.json\`,
\`vite.config.ts\`, the theme stylesheet (\`src/index.css\`) and one shared \`node_modules\`.

- **Setting one up:** \`system_create { kind: "package", library: { name, package, docsUrl } }\` scaffolds
  the folder; run \`npm install\` there and add the library (for shadcn/ui:
  \`npx shadcn@latest init -t vite -b radix -y --no-monorepo <components…>\`). Put the product's
  customizations (theme variables under \`:root\` / \`.dark\`, fonts, wrapped components) in the folder.
- **Describing components:** write \`stories/<name>.stories.tsx\` (one exported React component per
  example), then \`component_create { system, name, tag: "Button", title, description, import, story,
  docsUrl, examples: [{ title, html: "<JSX>", story: "<export>" }] }\`. Tokens come from the theme
  stylesheet automatically. \`system_build\` renders the stories for the app.
- **Prototypes:** \`prototype_create { framework: "react", system }\`. The entry is an HTML shell that
  loads \`main.tsx\`; import the theme (\`import "@/index.css"\`) and components (\`@/components/ui/…\`).
  Scratchpad builds it with the system's Vite on demand (build errors show in the viewer). Never
  install packages into a prototype; add dependencies to the design system.

## Reviews (feedback)

A **review** packages specific prototype versions of a project for people to give feedback on:
reviewers see them as labeled options (\`Option A\`, …; internal titles, descriptions and ids stay
private) with your intro and questions, one at a time and/or side by side. Create one with
\`review.create { project, title, intro, questions, items: [{ prototype, label?, note? }] }\`, check it
with \`review.preview\` (a local URL), and \`review.publish\` it: each publish is a frozen round on
GitHub Pages from the project's repo (the project must be shared first), and the review keeps a
stable link to the latest round. Published reviews are public to anyone with the link.

## Sharing projects with git

\`project.git.status\` shows whether a project is a repo and what's uncommitted, to push or to pull.
\`project.git.link\` shares it (a new GitHub repo, or an empty remote), \`project.clone\` adds a shared
project, and \`project.git.sync\` commits, pulls and pushes. Only sync when the person asks: it
publishes their work to collaborators.

## Tools

The same operations are available over MCP, the HTTP API (\`POST /api/commands/<name>\`),
and the \`scratchpad\` (\`sp\`) CLI:

| Command | Purpose |
|---|---|
| \`workspace.info\` | Orient yourself: projects, sources, counts, groups, URLs |
| \`project.list\` / \`project.get\` | Browse projects and what's in them |
| \`project.create\` / \`project.update\` / \`project.delete\` | Manage projects (name, color, icon) |
| \`source.list\` / \`source.add\` / \`source.remove\` | Manage reference sources |
| \`prototype.list\` / \`prototype.get\` | Browse prototypes |
| \`prototype.create\` | New prototype (\`html\` or \`files\`) |
| \`prototype.createVariant\` | Copy a prototype as a linked alternative |
| \`prototype.writeFile\` / \`prototype.readFile\` | Edit prototype files |
| \`prototype.update\` | Edit metadata (status, group, tags, …) or move it to another project |
| \`prototype.delete\` | Move to the project's trash |
| \`prototype.urls\` | Viewer + raw URLs to share with a person |
| \`review.create\` / \`review.update\` / \`review.get\` / \`review.list\` | Package prototypes for feedback |
| \`review.preview\` / \`review.publish\` / \`review.export\` | Preview, publish a round to GitHub Pages, or export a static copy |
| \`project.git.status\` / \`project.git.link\` / \`project.clone\` | Share projects as git repos |
| \`project.git.commit\` / \`pull\` / \`push\` / \`sync\` | Exchange changes with collaborators |

MCP tool names use underscores instead of dots (e.g. \`prototype_create\`).

After creating or changing prototypes, **share the viewer URL** so a person can
review, compare, and switch between variants.
`;
}

export const EXAMPLE_PROTOTYPE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to Scratchpad</title>
    <style>
      :root { --accent: #5b5bd6; --fg: #1c1c24; --muted: #6b6b7b; --bg: #f7f7fb; --card: #fff; }
      * { box-sizing: border-box; }
      body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
      main { max-width: 44rem; margin: 0 auto; padding: 3rem 1.5rem; }
      h1 { font-size: 2rem; margin: 0 0 .5rem; }
      p { color: var(--muted); }
      ol { padding-left: 1.25rem; }
      li { margin: .5rem 0; }
      code { background: #ececf4; padding: .1rem .35rem; border-radius: 4px; font-size: .9em; }
      .card { background: var(--card); border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 1px 3px rgb(0 0 0 / .08); margin-top: 1.5rem; }
      button { font: inherit; background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: .6rem 1rem; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Welcome 👋</h1>
      <p>This is an example prototype. Each prototype is a folder in <code>~/.scratchpad/projects/&lt;project&gt;/prototypes/</code> with an <code>index.html</code>.</p>
      <div class="card">
        <strong>Next steps</strong>
        <ol>
          <li>Register your product codebase as a source: <code>sp source add ../my-app</code></li>
          <li>Connect an agent over MCP: <code>sp mcp</code> (see the README for config snippets)</li>
          <li>Ask it to create a few prototype variants and watch them appear here.</li>
        </ol>
        <button type="button" onclick="this.textContent = 'Scripts work in the sandbox ✓'">Try me</button>
      </div>
    </main>
  </body>
</html>
`;
