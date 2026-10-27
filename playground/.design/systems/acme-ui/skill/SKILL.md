---
name: acme-ui-design-system
description: Build React prototypes with Acme UI, the project's shadcn/ui design system — 12 components (Button, Avatar, Badge, Input, Label, Select, …) and 32 theme tokens. Use when creating or editing a prototype that should look like this product.
---

# Acme UI design system

shadcn/ui, customized with Acme's brand theme.

Acme UI is shadcn/ui ([docs](https://ui.shadcn.com/docs)), installed and configured in the design system's folder. Prototypes import its real components, so they look and behave like the product. **Compose; don't recreate.**

## Setup

Create the prototype as a React prototype; design-tool builds it with the system's Vite and shared node_modules:

```
prototype_create { title, framework: "react", system: "acme-ui", files: [{ path: "main.tsx", content }] }
```

The entry `index.html` is a shell that loads `main.tsx`. In `main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import "@/index.css";
import { Button } from "@/components/ui/button";

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
| `Button` | Button: Triggers an action. | `import { Button } from "@/components/ui/button";` | [docs](https://ui.shadcn.com/docs/components/button) |
| `Avatar` | Avatar: User image with initials fallback. | `import { Avatar, AvatarFallback } from "@/components/ui/avatar";` | [docs](https://ui.shadcn.com/docs/components/avatar) |
| `Badge` | Badge: Small status or count label. | `import { Badge } from "@/components/ui/badge";` | [docs](https://ui.shadcn.com/docs/components/badge) |
| `Input` | Input: Single-line text field. | `import { Input } from "@/components/ui/input";` | [docs](https://ui.shadcn.com/docs/components/input) |
| `Label` | Label: Accessible label for a form control. | `import { Label } from "@/components/ui/label";` | [docs](https://ui.shadcn.com/docs/components/label) |
| `Select` | Select: Pick one option from a list (Radix select; the list opens in a portal). | `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";` | [docs](https://ui.shadcn.com/docs/components/select) |
| `Switch` | Switch: On/off toggle for settings that apply immediately. | `import { Switch } from "@/components/ui/switch";` | [docs](https://ui.shadcn.com/docs/components/switch) |
| `Separator` | Separator: Visual divider between groups of content. | `import { Separator } from "@/components/ui/separator";` | [docs](https://ui.shadcn.com/docs/components/separator) |
| `DropdownMenu` | Dropdown menu: Menu of actions opened from a trigger (renders in a portal). | `import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";` | [docs](https://ui.shadcn.com/docs/components/dropdown-menu) |
| `Table` | Table: Data table with header, rows and caption. | `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";` | [docs](https://ui.shadcn.com/docs/components/table) |
| `Card` | Card: A surface grouping related content: header (title, description, action), content and footer. | `import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";` | [docs](https://ui.shadcn.com/docs/components/card) |
| `Tabs` | Tabs: Switches between views of the same context. | `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";` | [docs](https://ui.shadcn.com/docs/components/tabs) |

Examples and props: `component_get`, or the official docs.

## Example

Button:

```tsx
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

<div className="flex flex-wrap gap-2">
  <Button>Save changes</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="link">Learn more</Button>
</div>
```

## Tools

When the design-tool MCP server is connected: `system_get` (overview), `component_search` / `component_get` (components and examples), `token_search` (theme tokens), `prototype_create` / `prototype_writeFile` (build the prototype).
