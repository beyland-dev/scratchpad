/** Prompts people hand to an agent after creating something in the UI. */

const START = "Use the scratchpad MCP server. Read the scratchpad://guide resource first.";

export function prototypePrompt(proto: {
  id: string;
  title: string;
  description?: string;
  project?: string;
  framework?: "react";
  system?: string;
}): string {
  const scope = proto.project ? ` in project "${proto.project}"` : "";
  if (proto.framework) {
    return `${START}
Build out the React prototype "${proto.title}" (id "${proto.id}")${scope}: ${proto.description?.trim() || "<describe what it should show and the states that matter>"}
- It's built with the design system "${proto.system}" (system_get, component_search). index.html is a shell; main.tsx is a setup note (this prompt). Replace main.tsx with prototype_writeFile and add more modules as needed.
- In main.tsx import the theme (import "@/index.css") and components from "@/components/ui/…"; style anything custom with the theme's Tailwind classes, and don't add dependencies.
- Use prototype_createVariant for alternatives, then share the viewer URL.`;
  }
  return `${START}
Build out the prototype "${proto.title}" (id "${proto.id}")${scope}: ${proto.description?.trim() || "<describe what it should show and the states that matter>"}
- Its index.html is a setup note (this prompt). Replace it with prototype_writeFile.${
    proto.project
      ? `\n- Match the project's design system if it has one (system_list with project "${proto.project}").`
      : ""
  }
- Use prototype_createVariant for alternatives, then share the viewer URL.`;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Hand-off for a variant forked in the app: its files are a copy of `source`, so the agent edits rather than starts over. */
export function variantPrompt(
  variant: {
    id: string;
    title: string;
    description?: string;
    framework?: "react";
    system?: string;
  },
  source: { id: string; title: string },
): string {
  return `${START}
Revise the prototype variant "${variant.title}" (id "${variant.id}"): ${variant.description?.trim() || "<describe what this variant should change>"}
- It's a fork of "${source.title}" (id "${source.id}"): its files start as a copy. Read them with prototype_get and prototype_readFile, then change only what this variant explores with prototype_writeFile. Never edit "${source.id}".${
    variant.framework
      ? `\n- It's a React prototype built with the design system "${variant.system}": edit main.tsx and its modules, using the system's components (component_search).`
      : ""
  }
- When it's done, update its description with prototype_update if the change grew, and share the viewer URL.`;
}

/**
 * The starting index.html of a prototype made in the app: its brief plus the agent prompt, so the
 * hand-off can't be dismissed by accident. An agent replaces it when it builds the prototype.
 */
export function starterHtml(
  proto: { title: string; description?: string },
  prompt: string,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(proto.title)}</title>
    <style>
      :root { color-scheme: light dark; --bg: #f7f7f8; --card: #fff; --fg: #18181d; --muted: #6b6b78; --line: #e4e4e9; --code: #f3f3f6; --accent: #5b5bd6; }
      @media (prefers-color-scheme: dark) { :root { --bg: #121216; --card: #1a1a20; --fg: #ececf1; --muted: #9b9ba9; --line: #2a2a33; --code: #222229; --accent: #8b8bf0; } }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); }
      main { width: min(680px, 100%); }
      .eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--accent); }
      h1 { margin: 0; font-size: 28px; line-height: 1.2; letter-spacing: -.01em; }
      .brief { margin: 10px 0 0; color: var(--muted); }
      .card { margin-top: 28px; padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--card); }
      h2 { margin: 0; font-size: 15px; }
      .card > p { margin: 4px 0 14px; font-size: 14px; color: var(--muted); }
      .prompt { border-radius: 10px; background: var(--code); }
      .prompt-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 0 16px; font-size: 12px; font-weight: 600; color: var(--muted); }
      pre { margin: 0; padding: 8px 16px 14px; font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
      button { padding: 4px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--fg); font: 500 12px system-ui, sans-serif; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">New prototype</p>
      <h1>${escapeHtml(proto.title)}</h1>
      ${proto.description?.trim() ? `<p class="brief">${escapeHtml(proto.description.trim())}</p>` : ""}
      <section class="card">
        <h2>Next: hand it to an agent</h2>
        <p>Give this prompt to an agent connected to scratchpad over MCP. It replaces this page, and the viewer updates live as it writes files.</p>
        <div class="prompt">
          <div class="prompt-head">Prompt <button type="button" id="copy">Copy</button></div>
          <pre id="prompt">${escapeHtml(prompt)}</pre>
        </div>
      </section>
    </main>
    <script>
      // Prototypes run sandboxed, where the async clipboard API may be blocked; fall back to execCommand.
      const button = document.getElementById("copy");
      button.addEventListener("click", async () => {
        const text = document.getElementById("prompt").textContent;
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch {}
        if (!ok) {
          const area = Object.assign(document.createElement("textarea"), { value: text });
          document.body.append(area);
          area.select();
          ok = document.execCommand("copy");
          area.remove();
        }
        if (!ok) getSelection().selectAllChildren(document.getElementById("prompt"));
        button.textContent = ok ? "Copied" : "Press ⌘C";
        setTimeout(() => (button.textContent = "Copy"), 1500);
      });
    </script>
  </body>
</html>
`;
}

export function systemAuditPrompt(
  system: { id: string; name: string; prefix: string; project: string },
  source: { kind: "local" | "git"; location: string; resolvedLocation: string } | undefined,
  projectDir: string,
): string {
  const target = `the design system "${system.name}" (id "${system.id}", tag prefix "${system.prefix}", project "${system.project}")`;
  const checkout = `${projectDir}/systems/${system.id}/source`;
  const where =
    source?.kind === "local"
      ? `The product's code is in ${source.resolvedLocation}. Read it there and never modify it.`
      : source?.kind === "git"
        ? `The product's code is in ${source.location}. Clone it into ${checkout} (already gitignored, e.g. \`git clone --depth 1 ${source.location} ${checkout}\`) and read it there.`
        : `It has no source codebase yet: ask me where the product lives (a local folder, a git repo, or a running app). Register it with source_add (CLI: sp source add <path-or-url>) and link it with system_update { id: "${system.project}/${system.id}", sourceId }. A git repo goes in ${checkout} (gitignored).`;
  return `${START}
Then read the scratchpad://skills/design-system-audit resource (or use the audit_design_system prompt) and follow it to audit the product into ${target}. It already exists and is empty.
${where}
- import the product's tokens for every theme,
- capture reference elements from the running product,
- codify components as <${system.prefix}-…> elements and verify them against the captures,
- build the system and report what's left unverified.`;
}

const LIBRARY_SETUP: Record<string, (dir: string) => string> = {
  shadcn: () =>
    "Add shadcn/ui: `npx shadcn@latest init -t vite -b radix -y --no-monorepo <components…>`, listing the components the product uses (e.g. button card input dialog). Add more later with `npx shadcn@latest add <name>`.",
};

/** Hand-off for a new package system: install, add the library, apply the product's customizations, write stories. */
export function packageSetupPrompt(
  system: {
    id: string;
    name: string;
    project: string;
    library?: { name: string; package?: string; docsUrl?: string };
  },
  source: { kind: "local" | "git"; location: string; resolvedLocation: string } | undefined,
  projectDir: string,
): string {
  const dir = `${projectDir}/systems/${system.id}`;
  const library = system.library?.name ?? "the component library";
  const setup =
    LIBRARY_SETUP[system.library?.package ?? ""]?.(dir) ??
    `Install ${system.library?.package ? `\`${system.library.package}\`` : library} with npm and wire up its styles and any provider (theme CSS in src/index.css; if components need a provider, wrap them in a component under src/ and use it in stories).`;
  const customize =
    source?.kind === "local"
      ? `Match the product: read its code in ${source.resolvedLocation} (never modify it) and bring over its customizations: theme variables (src/index.css, light under :root and dark under .dark), fonts, and any customized or wrapped components (into src/components).`
      : source?.kind === "git"
        ? `Match the product: clone ${source.location} into ${dir}/source (gitignored) and bring over its customizations: theme variables (src/index.css, light under :root and dark under .dark), fonts, and any customized or wrapped components (into src/components).`
        : `It has no source codebase yet: ask me whether the product customizes ${library} (a repo, a folder, or a theme). If so, register it with source_add (CLI: sp source add <path-or-url>), link it with system_update { id: "${system.project}/${system.id}", sourceId }, and bring over its theme variables, fonts and customized components. Otherwise keep the library's defaults.`;
  return `${START}
Set up the design system "${system.name}" (id "${system.id}", project "${system.project}"): ${library}${system.library?.docsUrl ? ` (docs: ${system.library.docsUrl})` : ""}, used from React prototypes. Its folder ${dir} is a Vite + React + Tailwind project scratchpad scaffolded; its node_modules are shared by every prototype that uses it.
1. Install: run \`npm install\` in ${dir}.
2. ${setup}
3. ${customize}
4. Describe each component: write stories/<name>.stories.tsx exporting one React component per example, then component_create { system: "${system.project}/${system.id}", name, tag: "Button", title, description, import, story, docsUrl, examples: [{ title, html: "<the example's JSX>", story: "<export name>" }] }. The first story is the component's card preview, so it should show the component itself.
5. Run system_build and fix any errors. Tokens come from src/index.css automatically.
Then prototypes use it with prototype_create { project: "${system.project}", framework: "react", system: "${system.id}" }.`;
}

/** Starting main.tsx of a React prototype made in the app: its brief and the agent prompt, in the design system's own theme. */
export function starterTsx(proto: { title: string; description?: string }, prompt: string): string {
  return `import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";

// A setup note from scratchpad. An agent replaces this file when it builds the prototype.
const title = ${JSON.stringify(proto.title)};
const brief = ${JSON.stringify(proto.description?.trim() ?? "")};
const prompt = ${JSON.stringify(prompt)};

function Starter() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const area = Object.assign(document.createElement("textarea"), { value: prompt });
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <main className="grid min-h-screen place-items-center bg-background p-8 text-foreground">
      <div className="w-full max-w-2xl">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">New prototype</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        {brief && <p className="mt-2 text-muted-foreground">{brief}</p>}
        <section className="mt-7 rounded-xl border bg-card p-5 text-card-foreground">
          <h2 className="font-medium">Next: hand it to an agent</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Give this prompt to an agent connected to scratchpad over MCP. It replaces this page, and the viewer updates live as it writes files.
          </p>
          <div className="rounded-lg bg-muted">
            <div className="flex items-center justify-between px-4 pt-2 text-xs font-medium text-muted-foreground">
              Prompt
              <button type="button" onClick={copy} className="rounded-md border bg-background px-2.5 py-1 text-xs text-foreground">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="px-4 pt-2 pb-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{prompt}</pre>
          </div>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Starter />);
`;
}
