import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { AgentConnectionGuide } from "./ConnectAgent.tsx";
import { Code } from "./Code.tsx";
import { Icon } from "./Icon.tsx";
import { call } from "../api.ts";
import { createRequest, projectEntries } from "../store.ts";

const DISMISSED_KEY = "sprue.onboarding.dismissed";
const dismissed = signal(localStorage.getItem(DISMISSED_KEY) === "true");

function dismiss(): void {
  localStorage.setItem(DISMISSED_KEY, "true");
  dismissed.value = true;
}

function firstDesignPrompt(projectName: string): string {
  return `Use the Sprue MCP server. Read the sprue://guide resource, then in the "${projectName}" project create a design for: <describe the screen or flow>. Share the viewer URL when you're done.`;
}

/**
 * First-run checklist: connect an agent, create a project, make a first design. Each step checks
 * itself off. On the empty workspace it's the whole page; in a project it sits above the designs
 * until everything is done or it's hidden.
 */
export function GettingStarted({ projectId }: { projectId?: string }) {
  const [agentConnected, setAgentConnected] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    call<{ agents: { configured: boolean }[] }>("agent.statusAll")
      .then(({ agents }) => setAgentConnected(agents.some((a) => a.configured)))
      .catch(() => setAgentConnected(false));
  }, []);

  const project = projectId
    ? projectEntries.value.find((p) => p.id === projectId)
    : projectEntries.value[0];
  const done = [agentConnected === true, Boolean(project), Boolean(project?.prototypes)];
  const count = done.filter(Boolean).length;
  const inProject = Boolean(projectId);
  if (inProject && (dismissed.value || count === done.length)) return null;
  if (agentConnected === null && inProject) return null;

  // The first unfinished step is open unless another is chosen (none while still checking).
  const current = expanded ?? (agentConnected === null ? -1 : done.findIndex((d) => !d));
  const steps: { title: string; detail: string; doneText?: string; body: ComponentChildren }[] = [
    {
      title: "Connect your agent",
      detail: "Add Sprue to the agent you use, so it can create and edit designs.",
      doneText: "Connected. Your agent can use Sprue.",
      body: <AgentConnectionGuide agentsOnly onConnected={() => setAgentConnected(true)} />,
    },
    {
      title: "Create your first project",
      detail: "A project holds the designs and design system for one product.",
      doneText: project ? `Created ${project.name}.` : undefined,
      body: (
        <div class="onboarding-actions">
          <button
            type="button"
            class="button primary small"
            onClick={() => (createRequest.value = { kind: "project" })}
          >
            <Icon name="plus" size={14} />
            New project
          </button>
          <span>Start a new project, or clone one a teammate shared.</span>
        </div>
      ),
    },
    {
      title: "Make your first design",
      detail: "Ask your agent with this prompt, or start from a blank design.",
      doneText: "Your first design is ready.",
      body: project ? (
        <div class="onboarding-design">
          <Code code={firstDesignPrompt(project.name)} lang="text" />
          <div class="onboarding-actions">
            <button
              type="button"
              class="button small"
              onClick={() => (createRequest.value = { kind: "design", project: project.id })}
            >
              Start a blank design
            </button>
          </div>
        </div>
      ) : (
        <p class="onboarding-note">Create a project first.</p>
      ),
    },
  ];

  return (
    <section
      class={`onboarding ${inProject ? "in-project" : ""}`}
      aria-labelledby="onboarding-heading"
    >
      <header class="onboarding-head">
        <div>
          <h1 id="onboarding-heading">Get started with Sprue</h1>
          <p>
            {count} of {steps.length} done
          </p>
        </div>
        {inProject && (
          <button type="button" class="button small ghost" onClick={dismiss}>
            Hide
          </button>
        )}
      </header>
      <ol class="onboarding-steps">
        {steps.map((step, index) => {
          const isDone = done[index];
          const isOpen = current === index;
          return (
            <li
              key={step.title}
              class={`onboarding-step ${isDone ? "done" : ""} ${isOpen ? "open" : ""}`}
            >
              <button
                type="button"
                class="onboarding-step-head"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? -1 : index)}
              >
                <span class="onboarding-marker" aria-hidden="true">
                  {isDone ? <Icon name="check" size={14} /> : index + 1}
                </span>
                <span class="onboarding-step-text">
                  <strong>{step.title}</strong>
                  <span>{isDone && !isOpen ? step.doneText : step.detail}</span>
                </span>
                {isDone && <span class="visually-hidden">Done</span>}
                <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={16} />
              </button>
              {isOpen && <div class="onboarding-step-body">{step.body}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
