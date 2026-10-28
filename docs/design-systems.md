# Design systems

A design system turns a product's real UI into reusable, verified building blocks that agents
use to make prototypes that look like the product. It lives in `.design/systems/<id>/`:

```text
.design/systems/vscode/
  system.json         name, prefix, themes, root context, capture provenance, notes
  tokens.json         design tokens (CSS custom properties) with per-theme values
  base.css            global styles (@font-face, …)
  assets/             fonts and icons referenced by base.css
  components/<name>/  component.json (API, examples, references), component.js, component.css
  captures/<label>/   reference captures from the running product (generated)
  activity.jsonl      audit activity log (generated)
  source/             local clone of the system's git source (gitignored; never read by Scratchpad)
  dist/               built system.css, system.js, catalog.json, specimen.html (generated)
  skill/              generated agent skill (SKILL.md + references)
```

## How a system is built

1. **Capture.** `capture.element` opens the running product (a URL, or an existing browser over
   CDP), and stores one element's DOM, the CSS rules that match it (annotated with their source
   stylesheet and position), its geometry and computed styles, and a screenshot. Capture each
   element in every theme (`chat-input-dark`, `chat-input-light`).
2. **Tokens.** `capture.tokens` reads runtime CSS custom properties per theme; `token.import`
   merges them with names, descriptions and source locations from the codebase.
3. **Components.** Each component is a light-DOM custom element (`ds.Element`) whose host _is_
   the captured root element, so the captured CSS (including `>` combinators) applies unchanged.
   `cssCaptures` pulls a capture's rules into the component at build time. Context components
   (e.g. `<vsc-workbench>`, `<vsc-sidebar>`) recreate the ancestors that captured rules depend on.
4. **Verify.** `capture.verify` renders each component example next to its reference capture in
   the same theme, width and viewport and compares element geometry and computed styles. A
   component is _verified_ only when every referenced element matches.
5. **Build.** `system.build` merges all component CSS in cascade order (deduplicating shared rules
   and merging their selector lists), compiles `system.js`, and regenerates the skill.

The **Activity** tab of a system shows this pipeline live: token, capture, component and
verification counts, what needs attention (drifting or unverified components, build warnings),
the captures (latest first, expandable to all), and a feed of everything agents do. The
**Components** tab (the default), **Tokens** (colors, typography, spacing, shadows and icons, each
with a details panel) and **Usage** tabs browse the results.

## Using a system in a prototype

```html
<link rel="stylesheet" href="/s/vscode/system.css" />
<script type="module" src="/s/vscode/system.js"></script>

<vsc-workbench theme="dark-2026">
  <vsc-chat-view><vsc-chat-input></vsc-chat-input></vsc-chat-view>
</vsc-workbench>
```

### Themes in the viewer

The viewer (and Compare) offers a prototype's design system themes, so prototypes don't need
their own theme toggles. Set the theme a prototype opens in (above, `theme="dark-2026"`) and let
the viewer switch it. It works through a small bridge in every built `system.js` (and in every
framework prototype build):

- `?theme=<id>` in the prototype's URL applies that theme on load. The viewer adds it to the
  frame, "Open in a new tab" and Compare, and keeps it in its own URL (`/p/<id>?theme=<id>`).
- `{ type: "dt-theme", theme: "<id>" }` posted by the parent window switches the theme live,
  without reloading (so the prototype keeps its state). Messages from other windows and unknown
  theme ids are ignored.
- When the page is parsed, the bridge posts `{ type: "dt-theme-ready", system, themes, theme }`
  to the parent. The viewer only shows its theme control after this handshake, for a prototype
  whose design system (below) matches.

A theme is applied by setting `theme` on every root context element (`system.rootContext`,
including ones added later) or, for package systems, `data-theme` and the theme's classes on
`<html>`. Without a URL theme or message, nothing changes.

A prototype's design system is its `system` field, else (for plain HTML) the system whose
`/s/<id>/system.css` or `system.js` its entry HTML loads, else its project's only design system.
The API returns it as `resolvedSystem`.

Agents get the same information from the generated skill (`skills.install` /
`system.exportSkill`) and the MCP tools `system_get`, `component_search`, `component_get` and
`token_search`; `component_get` returns a ready-to-paste snippet already wrapped in its contexts.

## Package design systems (existing libraries)

A design system can also be an existing library, such as shadcn/ui, Primer React or Radix Themes,
customized for a product (`"kind": "package"` in `system.json`). Instead of capturing components into
custom elements, the library is installed and configured in the system's folder, and prototypes use it
directly from React.

```text
.design/systems/acme-ui/
  system.json         kind "package", framework "react", library { name, package, docsUrl }, styles
  package.json        the library and its dependencies (scaffolded with Vite, React and Tailwind)
  vite.config.ts      used to build the specimen page and every prototype that uses the system
  src/index.css       theme variables (light under :root, dark under .dark): the system's tokens
  src/components/     the library's components, plus the product's customized ones
  stories/<name>.stories.tsx   one exported React component per component example
  components/<name>/  component.json: JSX tag, import line, story module, docs link, examples
  node_modules/       shared by every prototype built with the system (gitignored)
  source/             optional clone of the product's repo (gitignored)
```

- **Tokens** are read live from the theme stylesheet (`styles`). Theme classes map to selectors: the
  default theme's variables come from `:root`, a theme with `classes: "dark"` from `.dark`. Entries in
  `tokens.json` with the same variable add descriptions.
- **Components** keep the same metadata as captured ones, but `tag` is the JSX name (`Button`), and
  `import`, `story` (the module rendering the examples) and `docsUrl` point to the code and the
  official docs. Captured-system concepts (attributes, verification, component.js) don't apply.
- **Build:** `system.build` runs the system's own Vite (in a child process) to bundle the stories into
  `dist/specimen.html`, which the app renders like captured specimens (same URL parameters). Until
  `npm install` has run, the build is skipped with a warning.
- **Prototypes:** `prototype.create { framework: "react", system }` creates an `index.html` shell
  loading `main.tsx`. The sandbox builds it on demand with the system's Vite and `node_modules`
  (imports like `@/components/ui/button` resolve to the system), caches the build in
  `.design/.cache/builds/<id>/` until its files or the system change, and shows build errors in the
  viewer. Prototypes still run sandboxed on the separate origin.

Plain-HTML prototypes can still use a package system's look through its CSS variables, but its
components are React, so prototypes that want them should be React prototypes.

## Format notes

- **`themeSheets`**: captured stylesheets with theme-specific rules (e.g. a generated color-theme
  sheet). Their rules are scoped to the capture's theme; rules that only set token variables are
  dropped because tokens already define them.
- **`hostTag`**: the native element a component's host stands in for (`li`, `a`, …). Type
  selectors in captured CSS (`.actions-container > li`) are widened to match the custom element.
- **Classless wrappers**: a custom element without classes (e.g. `<vsc-select>` with
  `display: contents`) is transparent to verification paths.
- **References**: `{ capture, example, theme, width, root, ignore }`. `root` selects the element
  in the specimen that corresponds to the captured root; `ignore` takes class selectors (e.g.
  `.scrollbar`) for parts that depend on transient state.
- **Inline stylesheets** are labeled by a hash of their content (`inline-<hash>`), so labels stay
  stable across captures.
- **Runtime ids**: generated ids such as VS Code's `list_id_N` differ between pages; normalize them
  across a capture pair so both themes share the same component CSS.
