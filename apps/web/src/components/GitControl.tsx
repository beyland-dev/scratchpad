import { useEffect, useRef, useState } from "preact/hooks";
import { call } from "../api.ts";
import { projectEvents, projects, refresh } from "../store.ts";
import type { GitStatus } from "../types.ts";
import { relativeTime } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { MenuPopup, type MenuPosition } from "./Menu.tsx";
import { Field, FormActions, Modal, useSubmit } from "./Modal.tsx";

const FETCH_EVERY_MS = 60_000;

/** A project's git status, refreshed as its files change and fetched when the window regains focus. */
function useGitStatus(project: string): [GitStatus | null, (fetch?: boolean) => Promise<void>] {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const lastFetch = useRef(0);
  const load = async (fetch = false) => {
    if (fetch) lastFetch.current = Date.now();
    try {
      setStatus(await call<GitStatus>("project.git.status", { project, fetch }));
    } catch {
      setStatus(null);
    }
  };
  const changes = projectEvents.value[project] ?? 0;
  useEffect(() => {
    setStatus(null);
    void load(true);
    const onFocus = () => {
      if (Date.now() - lastFetch.current > FETCH_EVERY_MS) void load(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [project]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 600);
    return () => clearTimeout(timer);
  }, [changes]);
  return [status, load];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Share a project as a git repo, and keep it in sync with collaborators. */
export function ProjectGitControl({ project }: { project: string }) {
  const [status, reload] = useGitStatus(project);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"link" | "commit" | null>(null);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  if (!status) return null;

  const run = async (label: string, command: string) => {
    setBusy(label);
    setError(null);
    try {
      await call(command, { project });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      await reload();
    }
  };

  if (!status.remote)
    return (
      <>
        <button
          type="button"
          class="button"
          title="Put this project in a git repo, to share it and sync with collaborators"
          onClick={() => setDialog("link")}
        >
          <Icon name="share" size={14} /> Share project
        </button>
        {dialog === "link" && (
          <LinkRepoDialog
            project={project}
            onClose={() => setDialog(null)}
            onLinked={() => void reload()}
          />
        )}
      </>
    );

  const pending = status.changes.length + status.ahead + status.behind;
  const summary = [
    status.changes.length ? plural(status.changes.length, "change") : "",
    status.ahead ? `${status.ahead}↑` : "",
    status.behind ? `${status.behind}↓` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const title = [
    `${status.branch ?? "detached"} → ${status.remote}`,
    status.lastCommit
      ? `Last commit: “${status.lastCommit.subject}” by ${status.lastCommit.author}, ${relativeTime(status.lastCommit.date)}`
      : "",
    pending ? "Sync commits your changes, pulls collaborators' commits, and pushes." : "Up to date",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div class="git-control">
      {error && (
        <span class="git-error" role="alert" title={error}>
          <Icon name="alert" size={13} />
          <span>{error}</span>
          <button
            type="button"
            class="icon-button"
            aria-label="Dismiss"
            onClick={() => setError(null)}
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      )}
      <div class="git-buttons">
        <button
          type="button"
          class={`button git-sync ${pending ? "pending" : ""}`}
          title={title}
          disabled={busy !== null}
          onClick={() => void run("Syncing…", "project.git.sync")}
        >
          <Icon name="sync" size={14} />
          {busy ?? (pending ? "Sync" : "Up to date")}
          {!busy && summary && <span class="git-badge">{summary}</span>}
        </button>
        <button
          ref={menuButton}
          type="button"
          class="button icon-only git-more"
          aria-label="Git options"
          aria-haspopup="menu"
          aria-expanded={Boolean(menu)}
          disabled={busy !== null}
          onClick={(e) => {
            if (menu) return setMenu(null);
            const rect = e.currentTarget.getBoundingClientRect();
            setMenu({ x: rect.right, y: rect.bottom + 4, alignRight: true });
          }}
        >
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
      {menu && (
        <MenuPopup
          label="Git options"
          position={menu}
          anchor={menuButton}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Commit…",
              detail: status.changes.length
                ? plural(status.changes.length, "uncommitted change")
                : "No changes",
              onSelect: () => setDialog("commit"),
            },
            {
              label: "Pull",
              detail: status.behind ? `${plural(status.behind, "commit")} to pull` : undefined,
              onSelect: () => void run("Pulling…", "project.git.pull"),
            },
            {
              label: "Push",
              detail: status.ahead ? `${plural(status.ahead, "commit")} to push` : undefined,
              onSelect: () => void run("Pushing…", "project.git.push"),
            },
            ...(status.webUrl
              ? [
                  {
                    label: "Open repo on GitHub",
                    divider: true,
                    onSelect: () => window.open(status.webUrl, "_blank", "noopener"),
                  },
                ]
              : []),
          ]}
        />
      )}
      {dialog === "commit" && (
        <CommitDialog
          status={status}
          onClose={() => setDialog(null)}
          onCommitted={() => void reload()}
        />
      )}
    </div>
  );
}

function LinkRepoDialog({
  project,
  onClose,
  onLinked,
}: {
  project: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [mode, setMode] = useState<"github" | "remote">("github");
  const [name, setName] = useState(project);
  const [owner, setOwner] = useState("");
  const [isPrivate, setPrivate] = useState(true);
  const [remote, setRemote] = useState("");
  const dir = projects.value.find((p) => p.id === project)?.dir;
  const { busy, error, submit } = useSubmit(async () => {
    await call("project.git.link", {
      project,
      ...(mode === "github"
        ? {
            github: {
              name: name.trim() || project,
              private: isPrivate,
              ...(owner.trim() ? { owner: owner.trim() } : {}),
            },
          }
        : { remote: remote.trim() }),
    });
    onLinked();
    onClose();
  });
  return (
    <Modal title="Share project" onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          <p class="muted">
            The project folder{dir ? <code> {dir}</code> : null} becomes a git repo. Collaborators
            clone it from the sidebar (New project → Clone from a repo) and sync changes from the
            header.
          </p>
          <div class="segmented source-modes" role="radiogroup" aria-label="Repository">
            {(
              [
                ["github", "New GitHub repo"],
                ["remote", "Existing empty repo"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                key={value}
                aria-checked={mode === value}
                class={mode === value ? "active" : ""}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "github" ? (
            <>
              <Field
                label="Owner"
                value={owner}
                onInput={setOwner}
                placeholder="Your account"
                hint="A user or organization, e.g. beyland-dev. Leave empty for your account."
              />
              <Field label="Repository name" value={name} onInput={setName} required />
              <label class="checkbox-field">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setPrivate(e.currentTarget.checked)}
                />
                Private repository
              </label>
              <span class="field-hint">Uses the GitHub CLI (gh), signed in as you.</span>
            </>
          ) : (
            <Field
              label="Repository URL"
              value={remote}
              onInput={setRemote}
              required
              placeholder="git@github.com:owner/repo.git"
              hint="It must be empty. To work on a repo that already has a project, clone it instead."
            />
          )}
        </div>
        <FormActions
          submitLabel={busy ? "Sharing…" : "Share"}
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={mode === "github" ? !name.trim() : !remote.trim()}
        />
      </form>
    </Modal>
  );
}

function CommitDialog({
  status,
  onClose,
  onCommitted,
}: {
  status: GitStatus;
  onClose: () => void;
  onCommitted: () => void;
}) {
  const [message, setMessage] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    await call("project.git.commit", {
      project: status.project,
      ...(message.trim() ? { message: message.trim() } : {}),
    });
    onCommitted();
    onClose();
  });
  return (
    <Modal title="Commit changes" onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          <Field
            label="Message"
            value={message}
            onInput={setMessage}
            autoFocus
            placeholder="Leave empty to describe what changed automatically"
          />
          {status.changes.length > 0 ? (
            <ul class="git-changes">
              {status.changes.map((c) => (
                <li key={c.path}>
                  <code class="git-change-status">{c.status.trim() || "M"}</code>
                  <span>{c.path}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">There's nothing to commit.</p>
          )}
        </div>
        <FormActions
          submitLabel="Commit"
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={!status.changes.length}
        />
      </form>
    </Modal>
  );
}
