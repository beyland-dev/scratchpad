import type { ComponentChildren } from "preact";
import { Code } from "./Code.tsx";

/** "Next, give this to an agent": a heading, a short explanation and a copyable prompt. */
export function AgentHandoff({
  title,
  children,
  prompt,
  actions,
}: {
  title: string;
  children: ComponentChildren;
  prompt: string;
  actions?: ComponentChildren;
}) {
  return (
    <section class="handoff">
      <h2>{title}</h2>
      <p class="handoff-text">{children}</p>
      <Code code={prompt} lang="text" />
      {actions && <div class="handoff-actions">{actions}</div>}
    </section>
  );
}
