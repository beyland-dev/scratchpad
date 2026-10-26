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

The **Overview** tab of a system shows this pipeline live: token, capture, component and
verification counts, the latest captures, and an activity feed of everything agents do.

## Using a system in a prototype

```html
<link rel="stylesheet" href="/s/vscode/system.css" />
<script type="module" src="/s/vscode/system.js"></script>

<vsc-workbench theme="dark-2026">
  <vsc-chat-view><vsc-chat-input></vsc-chat-input></vsc-chat-view>
</vsc-workbench>
```

Agents get the same information from the generated skill (`skills.install` /
`system.exportSkill`) and the MCP tools `system_get`, `component_search`, `component_get` and
`token_search`; `component_get` returns a ready-to-paste snippet already wrapped in its contexts.

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
