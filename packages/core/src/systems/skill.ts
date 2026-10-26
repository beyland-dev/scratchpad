import { cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { atomicWrite } from "../fs-utils.ts";
import type { DesignComponent, DesignSystem, Token } from "./schemas.ts";
import type { SystemStore } from "./store.ts";

export function skillName(systemId: string): string {
  return `${systemId.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-design-system`;
}

const cell = (text: string | undefined) =>
  (text ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();

function attrSummary(c: DesignComponent): string {
  return c.attributes
    .slice(0, 6)
    .map((a) =>
      a.type === "enum" && a.values?.length
        ? `${a.name}=${a.values.join("\\|")}`
        : a.type === "boolean"
          ? a.name
          : `${a.name}=…`,
    )
    .join(", ");
}

function componentTable(components: DesignComponent[]): string {
  const rows = components.map(
    (c) =>
      `| \`<${c.tag}>\` | ${cell(c.title)}: ${cell(firstSentence(c.description))} | ${cell(attrSummary(c))} | ${c.requires.map((r) => `\`${r}\``).join(" › ")} |`,
  );
  return ["| Tag | What | Key attributes | Must be inside |", "|---|---|---|---|", ...rows].join(
    "\n",
  );
}

function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/s.exec(text.trim());
  return (match ? match[1]! : text).trim();
}

function renderSkill(system: DesignSystem, components: DesignComponent[], tokens: Token[]): string {
  const name = skillName(system.id);
  const contexts = components.filter((c) => c.kind === "context");
  const parts = components.filter((c) => c.kind === "component");
  const patterns = components.filter((c) => c.kind === "pattern");
  const root = system.rootContext;
  const themes = system.themes.map((t) => `\`${t.id}\` (${t.label})`).join(", ");
  const groups = new Map<string, number>();
  for (const t of tokens) groups.set(t.group ?? "other", (groups.get(t.group ?? "other") ?? 0) + 1);
  const topGroups = [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  const example =
    patterns.find((p) => p.examples.length)?.examples[0] ??
    parts.find((p) => p.examples.length)?.examples[0];

  return `---
name: ${name}
description: Build design-tool prototypes that look exactly like ${system.name}, using its codified design system — ${components.length} web components (${components
    .slice(0, 6)
    .map((c) => `<${c.tag}>`)
    .join(
      ", ",
    )}${components.length > 6 ? ", …" : ""}) and ${tokens.length} theme tokens. Use when creating or editing a prototype that should match ${system.name}, or when looking up its components, states, tokens, or icons.
---

# ${system.name} design system

${system.description ?? ""}

This library was codified from the real product${system.capturedFrom?.product ? ` (${system.capturedFrom.product}${system.capturedFrom.version ? ` ${system.capturedFrom.version}` : ""}${system.capturedFrom.commit ? `, commit ${system.capturedFrom.commit.slice(0, 12)}` : ""})` : ""}. Components render the product's real DOM and are styled by its real CSS, so composing them gives pixel-accurate results. **Compose; don't recreate.**

## Setup

In a prototype's \`index.html\` (design-tool serves these paths on the prototype sandbox):

\`\`\`html
<link rel="stylesheet" href="/s/${system.id}/system.css" />
<script type="module" src="/s/${system.id}/system.js"></script>
\`\`\`
${
  root
    ? `
Everything goes inside the root context, which applies the theme:

\`\`\`html
<${root} theme="${system.defaultTheme}">
  …
</${root}>
\`\`\`
`
    : ""
}
Themes: ${themes}. Default: \`${system.defaultTheme}\`.

## Rules

1. **Compose from the components below.** Don't hand-copy markup or CSS from the source code. If something you need is missing, use the closest component, keep custom parts minimal, and say what's missing.
2. **Respect required context.** A component only looks right inside the context elements listed in "Must be inside" (outermost first).
3. **Use tokens for anything custom.** Style custom parts with \`var(--…)\` tokens (see references/tokens.md or the \`token_search\` tool), never literal colors or sizes, so both themes work.
4. **Load \`system.js\` as a module** (as above), and put components in the HTML or create them with \`document.createElement\`. Attributes are reactive; children are read when an element first connects.
5. **Use real states.** Set state attributes (\`disabled\`, \`checked\`, \`focused\`, …) instead of restyling.
6. **Check your work.** View the prototype in design-tool (and take a screenshot if your tools allow) in each theme.
${system.notes ? `\n## Notes\n\n${system.notes.trim()}\n` : ""}
## Components
${contexts.length ? `\n### Contexts\n\n${componentTable(contexts)}\n` : ""}${parts.length ? `\n### Components\n\n${componentTable(parts)}\n` : ""}${patterns.length ? `\n### Patterns\n\n${componentTable(patterns)}\n` : ""}
Full API (attributes, slots, states, examples): [references/components.md](references/components.md), or the \`component_get\` tool.

## Tokens

${tokens.length} tokens, available as CSS custom properties and themed per theme. Largest groups: ${topGroups.map(([g, n]) => `${g} (${n})`).join(", ")}.

Find tokens with the \`token_search\` tool (e.g. query "button background") or in [references/tokens.md](references/tokens.md).
${
  example
    ? `
## Example

${example.title}:

\`\`\`html
${root && !example.html.includes(`<${root}`) ? `<${root} theme="${system.defaultTheme}">\n  ${example.html.trim().replace(/\n/g, "\n  ")}\n</${root}>` : example.html.trim()}
\`\`\`
`
    : ""
}
## Tools

When the design-tool MCP server is connected: \`system_get\` (overview), \`component_search\` / \`component_get\` (find and read components), \`token_search\` (find tokens), \`prototype_create\` / \`prototype_writeFile\` (build the prototype).
`;
}

function renderComponents(system: DesignSystem, components: DesignComponent[]): string {
  const sections = components.map((c) => {
    const lines = [
      `## \`<${c.tag}>\` — ${c.title}`,
      "",
      `Kind: ${c.kind} · Category: ${c.category} · Status: ${c.status}${c.verification ? ` · Verification: ${c.verification.status}` : ""}`,
      "",
    ];
    if (c.description) lines.push(c.description, "");
    if (c.usage) lines.push(`**Usage:** ${c.usage}`, "");
    if (c.requires.length)
      lines.push(`**Must be inside:** ${c.requires.map((r) => `\`<${r}>\``).join(" › ")}`, "");
    if (c.uses.length)
      lines.push(`**Composed of:** ${c.uses.map((r) => `\`<${r}>\``).join(", ")}`, "");
    if (c.attributes.length) {
      lines.push("| Attribute | Type | Default | Description |", "|---|---|---|---|");
      for (const a of c.attributes) {
        lines.push(
          `| \`${a.name}\` | ${a.type === "enum" && a.values ? a.values.map((v) => `\`${v}\``).join(" \\| ") : a.type} | ${a.default !== undefined ? `\`${a.default}\`` : ""} | ${cell(a.description)} |`,
        );
      }
      lines.push("");
    }
    if (c.slots.length) {
      lines.push(
        "**Slots:**",
        ...c.slots.map(
          (s) =>
            `- ${s.name ? `\`slot="${s.name}"\`` : "default (children)"}: ${s.description ?? ""}`,
        ),
        "",
      );
    }
    if (c.states.length)
      lines.push(
        "**States:**",
        ...c.states.map(
          (s) => `- \`${s.name}\`${s.trigger ? ` (${s.trigger})` : ""}: ${s.description ?? ""}`,
        ),
        "",
      );
    for (const example of c.examples) {
      lines.push(
        `**Example — ${example.title}**${example.description ? `: ${example.description}` : ""}`,
        "",
        "```html",
        example.html.trim(),
        "```",
        "",
      );
    }
    if (c.sources.length)
      lines.push(
        `Source: ${c.sources.map((s) => `\`${s.path}${s.line ? `:${s.line}` : ""}\``).join(", ")}`,
        "",
      );
    return lines.join("\n");
  });
  return `# ${system.name} components\n\n${components.length} components. Root context: ${system.rootContext ? `\`<${system.rootContext}>\`` : "none"}.\n\n${sections.join("\n")}`;
}

function renderTokens(system: DesignSystem, tokens: Token[]): string {
  const themes = system.themes;
  const byGroup = new Map<string, Token[]>();
  for (const t of tokens) {
    const g = t.group ?? "other";
    byGroup.set(g, [...(byGroup.get(g) ?? []), t]);
  }
  const sections = [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, list]) => {
      const head = `| Variable | Type | ${themes.map((t) => t.label).join(" | ")} | Description |`;
      const sep = `|---|---|${themes.map(() => "---|").join("")}---|`;
      const rows = list.map(
        (t) =>
          `| \`${t.cssVar}\` | ${t.type} | ${themes.map((th) => `\`${t.values[th.id] ?? t.value ?? ""}\``).join(" | ")} | ${cell(t.description).slice(0, 160)}${t.deprecated ? " (deprecated)" : ""} |`,
      );
      return `## ${group}\n\n${head}\n${sep}\n${rows.join("\n")}\n`;
    });
  return `# ${system.name} tokens\n\n${tokens.length} tokens. Use them as \`var(--name)\`; values switch with the theme.\n\n${sections.join("\n")}`;
}

/** Generate the agent skill for a design system into `dir` (replacing its contents). */
export async function writeSkill(store: SystemStore, id: string, dir: string): Promise<string[]> {
  const system = store.get(id);
  const components = store.components(id);
  const tokens = await store.tokens(id);
  // Stage and swap: several processes may regenerate the skill concurrently.
  const stamp = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const next = `${dir}.next-${stamp}`;
  const old = `${dir}.old-${stamp}`;
  await mkdir(path.join(next, "references"), { recursive: true });
  await atomicWrite(path.join(next, "SKILL.md"), renderSkill(system, components, tokens));
  await atomicWrite(
    path.join(next, "references", "components.md"),
    renderComponents(system, components),
  );
  await atomicWrite(path.join(next, "references", "tokens.md"), renderTokens(system, tokens));
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(dir, old).catch(() => undefined);
      await rename(next, dir);
      break;
    } catch (error) {
      if (attempt >= 5) {
        await rm(next, { recursive: true, force: true });
        break;
      }
      void error;
    }
  }
  await rm(old, { recursive: true, force: true });
  return ["SKILL.md", "references/components.md", "references/tokens.md"];
}

/** Copy a built skill to `<target>/<skill-name>/` (e.g. `.github/skills`). */
export async function exportSkill(
  store: SystemStore,
  id: string,
  targetDir: string,
): Promise<{ path: string; name: string }> {
  const name = skillName(id);
  const source = path.join(store.dirOf(id), "skill");
  const dest = path.join(targetDir, name);
  await rm(dest, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(source, dest, { recursive: true });
  return { path: dest, name };
}
