---
name: acme2-design-system
description: Build React prototypes with acme2, the project's shadcn/ui design system — 0 components () and 0 theme tokens. Use when creating or editing a prototype that should look like this product.
---

# acme2 design system

A storefront design system.

acme2 is shadcn/ui ([docs](https://ui.shadcn.com/docs)), installed and configured in the design system's folder. Prototypes import its real components, so they look and behave like the product. **Compose; don't recreate.**

## Setup

Create the prototype as a React prototype; design-tool builds it with the system's Vite and shared node_modules:

```
prototype_create { title, framework: "react", system: "acme2", files: [{ path: "main.tsx", content }] }
```

The entry `index.html` is a shell that loads `main.tsx`. In `main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import "@/index.css";


createRoot(document.getElementById("root")!).render(<App />);
```

Themes: `light`, `dark` (class `dark` on <html>). Default: `light`.

## Rules

1. **Compose from the components below**, imported from `@/components/…`. Don't restyle them; use their variants and props.
2. **Use the theme for anything custom**: Tailwind utilities backed by the tokens (`bg-primary`, `text-muted-foreground`, `border`, `rounded-lg`) or `var(--…)`, never literal colors.
3. **Don't install packages from a prototype.** Dependencies live in the design system; ask for anything missing.
4. **Check your work** in design-tool's viewer, in each theme.

## Components

| Component | What | Import | Docs |
|---|---|---|---|


Examples and props: `component_get`, or the official docs.

## Tools

When the design-tool MCP server is connected: `system_get` (overview), `component_search` / `component_get` (components and examples), `token_search` (theme tokens), `prototype_create` / `prototype_writeFile` (build the prototype).
