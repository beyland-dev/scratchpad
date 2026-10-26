export const AGENTS_GUIDE_RESOURCE = "design-tool://guide";

/** Conventions for agents working in a design workspace. Written to `.design/AGENTS.md` and served over MCP. */
export function renderAgentsGuide(workspaceName: string): string {
  return `# Design workspace: ${workspaceName}

This folder is a **design-tool workspace**. It holds design prototypes that are
created mostly by agents and reviewed by people. These conventions apply
whether you use the MCP tools or edit files directly.

## Layout

\`\`\`
.design/
  workspace.json            # workspace name + reference sources (product codebases)
  prototypes/
    <id>/                   # one folder per prototype; the folder name is the id
      prototype.json        # metadata (managed by design-tool; see schema below)
      index.html            # entry file, served in a sandbox
      ...                   # any other pages/assets, referenced with relative paths
  AGENTS.md                 # this guide
\`\`\`

## Prototypes

- A prototype is a **self-contained static web page or mini-site**. Use plain
  HTML/CSS/JS. Inline everything or use relative paths. CDN scripts are fine if
  necessary, but keep it so the prototype works when opened alone.
- Prototypes run in a **sandboxed iframe on a separate origin**. They can run
  scripts but can't access the design-tool app, cookies, or storage of other
  prototypes. Don't rely on \`localStorage\` persisting.
- Make prototypes **realistic**: real-looking content, the product's actual
  design tokens and components (see *Sources*), and real interaction states
  where they matter.
- Prefer **many small explorations** over one big page. Use:
  - \`group\` to cluster prototypes exploring the same problem (e.g. "checkout-redesign").
  - **variants** (\`prototype.createVariant\`) for alternatives of an existing
    prototype. Variants are linked with \`variantOf\`. A prototype and its variants
    form one family: the gallery shows a single card that opens the **newest**
    version, and the viewer labels versions V1, V2, … Latest by creation time.
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
  "variantOf": "checkout-stepper",
  "entry": "index.html",
  "createdBy": { "kind": "agent", "name": "copilot" },
  "sourceRefs": ["web-app"],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
\`\`\`

If you write files directly, a folder with just an \`index.html\` is also picked
up. Metadata is then inferred from the folder name and the page \`<title>\`.

## Sources

\`workspace.json\` lists **reference sources**: product codebases and other
places that are the source of truth for the design system (tokens, components,
styles, copy). **Treat sources as read-only.** Read them to match the product's
look and feel, and record which sources you used in \`sourceRefs\`.

## Design systems

A workspace can contain **design systems** in \`.design/systems/<id>/\`: libraries of web
components and themed tokens codified from a real product. When a prototype should look like
that product, **build it from the design system** instead of writing CSS from scratch:

- \`system_list\` / \`system_get\` give you what's available and the two lines to include.
- \`component_search\` / \`component_get\` show components, their attributes and states, and a ready-to-paste snippet.
- \`token_search\` finds tokens (\`var(--…)\`) to style anything custom.
- Each system also has a generated skill (\`skills_install\` puts it in \`.github/skills\`).

To create or extend a design system from a codebase, follow the **design-system-audit** skill
(MCP resource \`design-tool://skills/design-system-audit\`, or \`skills_install\`).

## Tools

The same operations are available over MCP, the HTTP API (\`POST /api/commands/<name>\`),
and the \`dt\` CLI:

| Command | Purpose |
|---|---|
| \`workspace.info\` | Orient yourself: sources, counts, groups, URLs |
| \`source.list\` / \`source.add\` / \`source.remove\` | Manage reference sources |
| \`prototype.list\` / \`prototype.get\` | Browse prototypes |
| \`prototype.create\` | New prototype (\`html\` or \`files\`) |
| \`prototype.createVariant\` | Copy a prototype as a linked alternative |
| \`prototype.writeFile\` / \`prototype.readFile\` | Edit prototype files |
| \`prototype.update\` | Edit metadata (status, group, tags, …) |
| \`prototype.delete\` | Move to trash |
| \`prototype.urls\` | Viewer + raw URLs to share with a person |

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
    <title>Welcome to your design workspace</title>
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
      <p>This is an example prototype. Each prototype is a folder in <code>.design/prototypes/</code> with an <code>index.html</code>.</p>
      <div class="card">
        <strong>Next steps</strong>
        <ol>
          <li>Register your product codebase as a source: <code>dt source add ../my-app</code></li>
          <li>Connect an agent over MCP: <code>dt mcp</code> (see the README for config snippets)</li>
          <li>Ask it to create a few prototype variants and watch them appear here.</li>
        </ol>
        <button type="button" onclick="this.textContent = 'Scripts work in the sandbox ✓'">Try me</button>
      </div>
    </main>
  </body>
</html>
`;
