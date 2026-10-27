---
name: acme3-design-system
description: Build design-tool prototypes that look exactly like acme3, using its codified design system — 0 web components () and 0 theme tokens. Use when creating or editing a prototype that should match acme3, or when looking up its components, states, tokens, or icons.
---

# acme3 design system



This library was codified from the real product. Components render the product's real DOM and are styled by its real CSS, so composing them gives pixel-accurate results. **Compose; don't recreate.**

## Setup

In a prototype's `index.html` (design-tool serves these paths on the prototype sandbox):

```html
<link rel="stylesheet" href="/s/acme3/system.css" />
<script type="module" src="/s/acme3/system.js"></script>
```

Themes: `light` (Light), `dark` (Dark). Default: `light`.

## Rules

1. **Compose from the components below.** Don't hand-copy markup or CSS from the source code. If something you need is missing, use the closest component, keep custom parts minimal, and say what's missing.
2. **Respect required context.** A component only looks right inside the context elements listed in "Must be inside" (outermost first).
3. **Use tokens for anything custom.** Style custom parts with `var(--…)` tokens (see references/tokens.md or the `token_search` tool), never literal colors or sizes, so both themes work.
4. **Load `system.js` as a module** (as above), and put components in the HTML or create them with `document.createElement`. Attributes are reactive; children are read when an element first connects.
5. **Use real states.** Set state attributes (`disabled`, `checked`, `focused`, …) instead of restyling.
6. **Check your work.** View the prototype in design-tool (and take a screenshot if your tools allow) in each theme.

## Components

Full API (attributes, slots, states, examples): [references/components.md](references/components.md), or the `component_get` tool.

## Tokens

0 tokens, available as CSS custom properties and themed per theme. Largest groups: .

Find tokens with the `token_search` tool (e.g. query "button background") or in [references/tokens.md](references/tokens.md).

## Tools

When the design-tool MCP server is connected: `system_get` (overview), `component_search` / `component_get` (find and read components), `token_search` (find tokens), `prototype_create` / `prototype_writeFile` (build the prototype).
