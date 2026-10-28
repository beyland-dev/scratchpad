/** The generic audit procedure shipped with design-tool (installed with `skills.install`). */
export const AUDIT_SKILL_NAME = "design-system-audit";

export const AUDIT_SKILL = `---
name: ${AUDIT_SKILL_NAME}
description: Audit an existing product codebase and codify its design system — tokens, foundations, components, states and patterns — into a design-tool library of verified web components, then publish an agent skill for building prototypes with it. Use when asked to audit, extract, catalog or codify a codebase's design system, components, styles, tokens or UI patterns, or to extend or fix an existing design-tool design system.
---

# Auditing a codebase into a design system

You turn a real product's UI into a **design system library** in a design-tool workspace: themed **tokens**, light-DOM **web components** that render the product's real DOM, styled by its **real CSS**, and a generated **skill** that lets other agents build pixel-accurate prototypes from it.

## Principles

1. **Values come from the running app; meaning comes from the source.** Capture resolved CSS, variables and geometry from a running instance. Take names, descriptions, states and source locations from the code.
2. **Capture, don't transcribe.** Never hand-copy CSS values or rules. Use \`capture_element\` and \`capture_tokens\` so the library stays exact and traceable (every captured rule carries an \`@capture\` provenance comment).
3. **Nothing is done until it is verified.** A component is finished when \`capture_verify\` reports \`verified\` for its references, or its remaining differences are explained in its description.
4. **Breadth first, then depth.** Go in this order: tokens and foundations → contexts → leaf components → composite components → patterns.
5. **Mirror the real DOM.** A component's host element *is* the root element of the captured markup: it carries the same classes, and its children are structured exactly like \`dom.html\`. This keeps the real selectors (including \`>\` combinators) working when components nest.

## 0. Prerequisites

- The codebase is registered as a source (\`source_add\`). Read it there; never modify it.
- Run \`capture_setup\` once (installs a headless browser).
- You need a running instance of the app (step 2). If you can't get one, stop and ask the user.

## 1. Inventory the codebase

Work out, from the source:
- **The styling approach:** CSS files, CSS modules, CSS-in-JS, Tailwind, inline styles.
- **Where tokens are defined:** CSS custom properties, theme files, token or color registries.
- **The themes:** names, kinds, and how the active theme is applied (classes or attributes on a root element).
- **The icon system:** icon font, sprite, or SVG components.
- **Where the components live, and existing UI catalogs:** Storybook, fixtures, component explorers, screenshot tests. These are the best capture sources.
- **How to run the app** for capture.

Record this in the system's \`notes\` (\`system_update\`). Agree on the scope with the user if the product is large.

## 2. Get a runtime to capture from

In order of preference:
1. **An isolated component catalog** (Storybook, fixture or component explorer): many states, deterministic, fast.
2. **A running web build** (dev server, web version of the app).
3. **The desktop (Electron/Chromium) app over CDP.** Launch it with \`--remote-debugging-port=9222\`, then use the target \`{ "cdp": "http://127.0.0.1:9222", "page": "<title or url text>" }\`.

Explore with \`capture_outline\` (DOM outline with classes, roles, sizes) to find selectors. Reach states with target \`steps\`: \`hover\`, \`click\`, \`press\`, \`type\`, \`waitFor\`, \`eval\`, or \`script\` (Playwright code with \`page\`). Use them to open menus, hover, focus, switch themes, and so on.

## 3. Create the system

Call \`system_create\` with:
- \`id\`, \`name\`, and a short \`prefix\` for tags (e.g. \`vsc\`).
- \`sourceId\`.
- \`themes\`: one per theme, with the **classes the app's root element carries** in that theme. Use the default theme as \`defaultTheme\`.
- \`rootContext\`: the tag of your root context element (e.g. \`vsc-workbench\`).
- \`themeSelector\`: how themed variables are scoped. Use \`{classes}\` for the theme's classes, e.g. \`.monaco-workbench{classes}\`.
- \`attribution\`: licenses for the CSS and fonts you capture.

## 4. Tokens

- Run \`capture_tokens\` once per theme, against the element that defines the variables, with the app's variable prefix. This gives exact resolved values per theme.
- Enrich them from source with \`token_import\` (merge mode; tokens match by \`cssVar\`): canonical \`name\`, \`description\`, \`group\`, \`type\`, \`source\` (file and line). For hundreds or thousands of tokens, write a small script that reads the registry or theme files and emits JSON, then import in batches of a few hundred.
- Theme-independent tokens (spacing, radius, font sizes) can use \`themeIndependent: true\`.

## 5. Foundations

- **Fonts and icon fonts:** \`capture_element\` reports \`fonts\` with URLs. Download the files and store them with \`system_writeFile\` (\`assets/…\`, base64). Write \`base.css\` with \`@font-face\` rules using relative URLs (\`assets/…\`), plus any global rules the app applies (such as platform font stacks).
- **Icons:** make an icon component (e.g. \`<vsc-icon name="…">\`) that renders the app's icon markup. Its glyph CSS must come from capture or from the source mapping.
- Check that typography, spacing, radius, shadow and motion values exist as tokens.

## 6. Contexts

Most app CSS depends on ancestors, e.g. \`.workbench .chat-view .input …\`. Each capture records its \`ancestors\`.
- **Root context:** the app's root element (theme classes, font, color, background). It reads \`theme\` and calls \`ds.applyTheme(this, …)\`.
- **Intermediate contexts:** containers that component selectors depend on. Use \`kind: "context"\`, set \`hostClass\` to the container's classes, and capture the container (excluding unrelated children) so its own CSS (font, color, padding) is included.
- Components list their contexts in \`requires\`, outermost first.

## 7. Components (repeat for each)

1. **Capture** every important variant and state in the running app with \`capture_element\`, \`system\` and \`label\` (e.g. \`button-primary\`, \`button-secondary-disabled-dark\`). The default \`stateClasses\` keep \`.focused\`, \`.disabled\` and other state rules. Pass \`theme\`. Use \`exclude\` for third-party internals.
2. **Read** \`dom.html\` and \`rules.css\` (\`capture_get\`).
3. **Design the API.** Use attributes for variants and states (mapping to the real state classes) and slots for content. Don't add styling attributes. Model what the product actually does.
4. **Write \`component.js\`.** \`class X extends ds.Element\` with:
   - \`static hostClass\` (the root's classes)
   - \`static props\` (observed attributes)
   - \`render()\`, which builds the inner DOM exactly like \`dom.html\` using \`ds.h("tag.class1.class2", attrs, ...children)\`, \`ds.icon(name)\`, \`this.slotted(name)\`, \`this.attr()\`, \`this.flag()\` and \`this.setClasses({...})\` for state classes on the host
   - a closing call to \`ds.define("<tag>", X)\`
   
   If the root must be a native element (\`a\`, \`button\`, \`input\`), render it inside, set \`hostDisplay: "contents"\`, and remember that \`>\` selectors then see the native element, not the host. Add interactivity (focus classes, toggles) that mirrors the real app where it's cheap.
5. **Use \`rules.css\` as \`component.css\`**, unchanged. Rules shared between components are deduplicated and kept in cascade order by \`system_build\`, so don't strip "duplicates" yourself.
6. **Create the component** with \`component_create\`, including:
   - \`tag\`, \`kind\`, \`title\`, \`category\`
   - \`description\` and \`usage\` (when to use it and when not)
   - \`attributes\`, \`slots\`, \`states\`
   - \`requires\` and \`uses\`
   - \`sources\` (file and line)
   - \`examples\`: one per reference, with the same content as the capture. The app renders each example on its own, scaled to fit its card or detail page. Give any context that sizes itself from its container (lists, split views, editors, side bars) an explicit size, for example \`<x-settings-editor style="height: 300px">\`, or the component renders clipped. The first example is the component's card preview, so make it show the component itself rather than a whole screen around it.
   - \`references\`: \`{ capture, example, theme, width? }\`
7. **Verify** with \`capture_verify\` and fix until it's \`verified\`. Common fixes:
   - **Inherited font or color wrong:** a context's own CSS is missing. Capture the context.
   - **Structure or class differences:** compare against \`dom.html\`. Paths sort classes, and a state class changes the path.
   - **Width differs:** set the reference \`width\`, or check context padding.
   - **Nondeterministic parts** (caret, animation, time): add \`ignore\` selectors and explain them.
8. **Look at it** with \`component_screenshot\` in each theme.

## 8. Patterns

Compose components into recognizable product UI (\`kind: "pattern"\`, \`uses: [...]\`). Patterns should be built **from components**, not from new copies of captured markup. Capture the real composite and verify the pattern against it. Patterns are what prove that mix-and-match works.

## 9. Build and publish

- Run \`system_build\` and resolve its warnings. If variables are used but not defined as tokens, add those tokens (or accept the fallback and say so). Add examples where missing.
- Use \`system_coverage\` for the report: how many components are verified versus drifting, plus gaps.
- Run \`system_exportSkill\` (\`target: "github"\` or \`"claude"\`) so prototyping agents get the generated skill.
- Report to the user: coverage, what's verified, known gaps, and how to use the library.

## Pitfalls

- **Third-party widgets** (code editors, charts): exclude their internals from capture and render a stand-in with the same box metrics, font and colors. Document it in the component's description.
- **Theme-specific rules** (e.g. \`.dark .x\`) are only captured while that theme is active. Capture in each theme.
- **Inline styles set by JavaScript** (measured widths and so on) aren't in \`rules.css\`. Reproduce them in \`render()\` or measure at runtime like the app does.
- **Huge components:** split them into smaller nestable components plus a pattern. Agents compose better with small parts.
- **Large outputs:** \`capture_element\` with a \`system\` returns a summary; read details with \`capture_get\`.
`;
