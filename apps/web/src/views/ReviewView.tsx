import { groupFamilies, versionLabel } from "@beyland/sprue-core/family";
import { useEffect, useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { call } from "../api.ts";
import { Icon } from "../components/Icon.tsx";
import { MenuButton } from "../components/Menu.tsx";
import { ConfirmDialog, Modal } from "../components/Modal.tsx";
import { PrototypeThumb } from "../components/PrototypeCard.tsx";
import { prototypeHref } from "../prototype-theme.ts";
import {
  changedSinceLastRound,
  familyTitle,
  loaded,
  NEW_REVIEW_ID,
  newReviewDraft,
  projectHref,
  prototypes,
  refresh,
  reviewHref,
  reviewItemPrototype,
  reviews,
  versionLabelOf,
} from "../store.ts";
import type { GitStatus, Review, ReviewItem } from "../types.ts";
import { DEVICES, copyText, editedAgo, relativeTime } from "../util.ts";

type Draft = Pick<Review, "title" | "intro" | "questions" | "presentation" | "device" | "items">;

const draftOf = (review: Review): Draft => ({
  title: review.title,
  intro: review.intro ?? "",
  questions: review.questions,
  presentation: review.presentation,
  device: review.device,
  items: review.items,
});

const PRESENTATIONS: [Review["presentation"], string][] = [
  ["both", "Both"],
  ["sequence", "One at a time"],
  ["compare", "Side by side"],
];

const optionLabel = (index: number) =>
  `Option ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;

interface PublishOutcome {
  round: { round: number; url?: string; path: string };
  latestUrl?: string;
  warnings: string[];
}

export function ReviewView() {
  const { params } = useRoute();
  const { route } = useLocation();
  const project = params.project ?? "";
  const id = params.id ?? "";
  const isNew = id === NEW_REVIEW_ID;
  const seed = newReviewDraft.value;
  const savedReview = reviews.value.find((r) => r.project === project && r.id === id);
  const review: Review | undefined =
    savedReview ??
    (isNew
      ? {
          id,
          project,
          title: seed?.project === project ? seed.title : "Untitled review",
          questions: [],
          presentation: "both",
          device: "desktop",
          items:
            seed?.project === project
              ? seed.prototypes.map((prototype, index) => ({
                  prototype,
                  label: optionLabel(index),
                }))
              : [],
          rounds: [],
          createdAt: "",
          updatedAt: "",
          urls: { app: "" },
        }
      : undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "delete" | "publish" | "share" | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [published, setPublished] = useState<PublishOutcome | null>(null);

  // Start editing from the saved review; keep local edits when it changes on disk.
  useEffect(() => {
    if (review && !draft) setDraft(draftOf(review));
  }, [review?.updatedAt]);

  if (!loaded.value) return <p class="page-message">Loading…</p>;
  if (!review)
    return (
      <p class="page-message">
        No review <code>{id}</code>. <a href={projectHref(project, "feedback")}>Back to feedback</a>
      </p>
    );
  const current = draft ?? draftOf(review);
  const dirty = isNew || JSON.stringify(current) !== JSON.stringify(draftOf(review));
  const ref = `${review.project}/${review.id}`;
  const update = (patch: Partial<Draft>) => setDraft({ ...current, ...patch });
  const setItem = (index: number, patch: Partial<ReviewItem>) =>
    update({ items: current.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  const move = (index: number, delta: number) => {
    const items = [...current.items];
    const [item] = items.splice(index, 1);
    items.splice(index + delta, 0, item!);
    update({ items });
  };
  const changed = changedSinceLastRound(review);
  const last = review.rounds.at(-1);
  const nextRound = (last?.round ?? 0) + 1;

  const save = async (): Promise<string> => {
    if (!dirty) return ref;
    const intro = current.intro?.trim() || undefined;
    const input = {
      title: current.title.trim() || "Untitled review",
      questions: current.questions.map((q) => q.trim()).filter(Boolean),
      presentation: current.presentation,
      device: current.device,
      items: current.items.map((it, i) => ({
        prototype: it.prototype,
        label: it.label.trim() || optionLabel(i),
        ...(it.note?.trim() ? { note: it.note.trim() } : {}),
      })),
    };
    if (isNew) {
      const { review: created } = await call<{ review: Review }>("review.create", {
        project,
        ...input,
        ...(intro ? { intro } : {}),
      });
      newReviewDraft.value = null;
      await refresh();
      setDraft(null);
      route(reviewHref(created), true);
      return `${created.project}/${created.id}`;
    }
    await call("review.update", { id: ref, ...input, intro: intro ?? null });
    await refresh();
    setDraft(null);
    return ref;
  };

  const act = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const preview = () => {
    // Opened right away so popup blockers allow it; pointed at the preview once it's exported.
    const tab = window.open("", "_blank");
    void act("Preparing preview…", async () => {
      try {
        const target = await save();
        const { url } = await call<{ url: string }>("review.preview", { id: target });
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else window.open(url, "_blank", "noopener");
      } catch (e) {
        tab?.close();
        throw e;
      }
    });
  };

  const startPublish = () =>
    void act("Checking…", async () => {
      await save();
      if (isNew) return;
      const status = await call<GitStatus>("project.git.status", { project });
      setGit(status);
      setDialog(status.remote ? "publish" : "share");
    });

  return (
    <div class="page review-page">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href={projectHref(project, "feedback")}>Feedback</a>
        </nav>
        <div class="page-title-row">
          <input
            class="review-title-input"
            aria-label="Review title"
            value={current.title}
            placeholder="Untitled review"
            onInput={(e) => update({ title: e.currentTarget.value })}
          />
          <span class="toolbar-spacer" />
          <button
            type="button"
            class="button"
            disabled={busy !== null || !current.items.length}
            onClick={preview}
            title="See exactly what reviewers will, in a new tab"
          >
            <Icon name="external" size={14} /> Preview
          </button>
          <button
            type="button"
            class="button primary"
            disabled={busy !== null || !current.items.length}
            onClick={startPublish}
          >
            <Icon name="send" size={14} /> {busy ?? `Publish round ${nextRound}`}
          </button>
          {!isNew && (
            <MenuButton
              label="Review options"
              items={[
                {
                  label: "Delete review…",
                  danger: true,
                  onSelect: () => setDialog("delete"),
                },
              ]}
            />
          )}
        </div>
        <p class="review-status muted">
          {last ? (
            <>
              Round {last.round} published {relativeTime(last.publishedAt)}
              {review.urls.latest && (
                <>
                  {" · "}
                  <a href={review.urls.latest} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                  {" · "}
                  <button
                    type="button"
                    class="link-button"
                    onClick={() => void copyText(review.urls.latest!)}
                  >
                    Copy link
                  </button>
                </>
              )}
              {changed.size > 0 &&
                ` · ${changed.size} option${changed.size === 1 ? "" : "s"} changed since`}
            </>
          ) : isNew ? (
            "Draft: not saved yet"
          ) : (
            "Draft: not published yet"
          )}
        </p>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div class="review-layout">
        <section class="review-options" aria-labelledby="options-heading">
          <div class="review-section-head">
            <h2 id="options-heading">Options</h2>
            <span class="toolbar-spacer" />
            <button type="button" class="button small" onClick={() => setDialog("add")}>
              <Icon name="plus" size={12} /> Add prototypes
            </button>
          </div>
          {current.items.length === 0 && (
            <p class="muted review-empty">
              Add the prototypes (specific versions) you want feedback on. Reviewers see them as
              labeled options, not by their internal names.
            </p>
          )}
          <ol class="review-items">
            {current.items.map((item, index) => {
              const proto = reviewItemPrototype(review, item);
              return (
                <li class="review-item" key={item.prototype}>
                  {proto ? (
                    <PrototypeThumb
                      proto={proto}
                      class="review-item-thumb"
                      href={prototypeHref(proto.id)}
                      title="Open in the viewer"
                    />
                  ) : (
                    <span class="review-item-thumb missing">Missing</span>
                  )}
                  <div class="review-item-fields">
                    <input
                      class="input review-item-label"
                      aria-label="Label shown to reviewers"
                      value={item.label}
                      placeholder={optionLabel(index)}
                      onInput={(e) => setItem(index, { label: e.currentTarget.value })}
                    />
                    <textarea
                      class="input review-item-note"
                      aria-label="Note shown to reviewers"
                      rows={2}
                      value={item.note ?? ""}
                      placeholder="Note for reviewers (optional)"
                      onInput={(e) => setItem(index, { note: e.currentTarget.value })}
                    />
                    <span class="review-item-meta">
                      {proto ? (
                        <>
                          {familyTitle(proto)}
                          {versionLabelOf(proto) ? ` · ${versionLabelOf(proto)}` : ""} ·{" "}
                          {editedAgo(proto.updatedAt)}
                        </>
                      ) : (
                        <>Prototype {item.prototype} no longer exists</>
                      )}
                      {last && changed.has(item.prototype) && (
                        <span class="chip review-changed">
                          {last.prototypes.some((p) => p.id === item.prototype)
                            ? `Changed since round ${last.round}`
                            : "New since last round"}
                        </span>
                      )}
                    </span>
                  </div>
                  <div class="review-item-actions">
                    <button
                      type="button"
                      class="icon-button"
                      aria-label="Move up"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <Icon name="chevron-left" size={14} />
                    </button>
                    <button
                      type="button"
                      class="icon-button"
                      aria-label="Move down"
                      title="Move down"
                      disabled={index === current.items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <Icon name="chevron-right" size={14} />
                    </button>
                    <button
                      type="button"
                      class="icon-button"
                      aria-label={`Remove ${item.label}`}
                      title="Remove"
                      onClick={() => update({ items: current.items.filter((_, i) => i !== index) })}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside class="review-settings" aria-label="What reviewers see">
          <h2>For reviewers</h2>
          <label class="field">
            <span class="field-label">Intro</span>
            <textarea
              class="input field-input"
              rows={4}
              value={current.intro ?? ""}
              placeholder="What this is, who it's for, and the context reviewers need."
              onInput={(e) => update({ intro: e.currentTarget.value })}
            />
          </label>
          <div class="field">
            <span class="field-label">Questions</span>
            {current.questions.map((q, i) => (
              <div class="review-question" key={i}>
                <input
                  class="input field-input"
                  aria-label={`Question ${i + 1}`}
                  value={q}
                  onInput={(e) =>
                    update({
                      questions: current.questions.map((x, j) =>
                        j === i ? e.currentTarget.value : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  class="icon-button"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => update({ questions: current.questions.filter((_, j) => j !== i) })}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              class="button small ghost review-add-question"
              onClick={() => update({ questions: [...current.questions, ""] })}
            >
              <Icon name="plus" size={12} /> Add a question
            </button>
          </div>
          <div class="field" role="group" aria-labelledby="presentation-label">
            <span class="field-label" id="presentation-label">
              Presentation
            </span>
            <div class="segmented" role="radiogroup" aria-labelledby="presentation-label">
              {PRESENTATIONS.map(([value, label]) => (
                <button
                  type="button"
                  role="radio"
                  key={value}
                  aria-checked={current.presentation === value}
                  class={current.presentation === value ? "active" : ""}
                  onClick={() => update({ presentation: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div class="field" role="group" aria-labelledby="device-label">
            <span class="field-label" id="device-label">
              Opens at
            </span>
            <div class="segmented" role="radiogroup" aria-labelledby="device-label">
              {DEVICES.map((d) => (
                <button
                  type="button"
                  role="radio"
                  key={d.id}
                  aria-checked={current.device === d.id}
                  class={current.device === d.id ? "active" : ""}
                  onClick={() => update({ device: d.id as Review["device"] })}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <span class="field-hint">Reviewers can switch viewports.</span>
          </div>
        </aside>
      </div>

      {dirty && (
        <div class="selection-bar review-save-bar" role="region" aria-label="Unsaved changes">
          <span>Unsaved changes</span>
          <button type="button" class="button" onClick={() => setDraft(null)}>
            Discard
          </button>
          <button
            type="button"
            class="button primary"
            disabled={busy !== null}
            onClick={() =>
              void act("Saving…", async () => {
                await save();
              })
            }
          >
            Save
          </button>
        </div>
      )}

      {dialog === "add" && (
        <AddPrototypesDialog
          project={project}
          existing={current.items.map((it) => it.prototype)}
          onClose={() => setDialog(null)}
          onAdd={(ids) => {
            update({
              items: [
                ...current.items,
                ...ids.map((prototype, i) => ({
                  prototype,
                  label: optionLabel(current.items.length + i),
                })),
              ],
            });
            setDialog(null);
          }}
        />
      )}
      {dialog === "share" && (
        <ConfirmDialog
          title="Share the project first"
          confirmLabel="Got it"
          danger={false}
          onClose={() => setDialog(null)}
          onConfirm={async () => setDialog(null)}
        >
          <p>
            Reviews are published to GitHub Pages from the project's git repo. Use{" "}
            <strong>Share project</strong> in the header to put the project in a repo, then publish
            again.
          </p>
        </ConfirmDialog>
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={`Delete “${review.title}”?`}
          confirmLabel="Delete review"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await call("review.delete", { id: ref });
            await refresh();
            setDialog(null);
            route(projectHref(project, "feedback"));
          }}
        >
          <p>
            The local review moves to the project's <code>.trash/</code>.
            {review.rounds.length ? (
              <>
                {" "}
                All published rounds and their stable link are also removed from the repo's{" "}
                <code>gh-pages</code> branch. GitHub Pages might take about a minute to update.
              </>
            ) : null}
          </p>
        </ConfirmDialog>
      )}
      {dialog === "publish" && git && (
        <ConfirmDialog
          title={`Publish round ${nextRound}?`}
          confirmLabel={`Publish round ${nextRound}`}
          danger={false}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const outcome = await call<PublishOutcome>("review.publish", { id: ref });
            await refresh();
            setDialog(null);
            setPublished(outcome);
          }}
        >
          <p>
            A frozen copy of the {current.items.length} option
            {current.items.length === 1 ? "" : "s"} goes to the <code>gh-pages</code> branch of{" "}
            <code>{git.remote}</code> and is served by GitHub Pages.
          </p>
          <p>
            <strong>Anyone with the link can open it.</strong> The link is hard to guess and hidden
            from search engines, but it isn't private.
          </p>
        </ConfirmDialog>
      )}
      {published && (
        <Modal
          title={`Round ${published.round.round} published`}
          onClose={() => setPublished(null)}
        >
          <div class="dialog-body">
            {published.latestUrl ? (
              <>
                <p>Share this link. It always opens the latest round:</p>
                <LinkRow url={published.latestUrl} />
                {published.round.url && (
                  <>
                    <p class="muted">This round on its own (it won't change):</p>
                    <LinkRow url={published.round.url} />
                  </>
                )}
                <p class="field-hint">GitHub Pages usually takes about a minute to update.</p>
              </>
            ) : (
              <p>
                Published to <code>{published.round.path}</code> on the <code>gh-pages</code>{" "}
                branch. The project's remote isn't on GitHub, so serve that branch with your host.
              </p>
            )}
            {published.warnings.map((w) => (
              <p class="warn" key={w}>
                {w}
              </p>
            ))}
          </div>
          <footer class="dialog-actions">
            <span class="toolbar-spacer" />
            <button
              type="button"
              class="button primary"
              onClick={() => setPublished(null)}
              autoFocus
            >
              Done
            </button>
          </footer>
        </Modal>
      )}
      {busy === null && review.issues?.length ? (
        <p class="warn">{review.issues.join(" ")}</p>
      ) : null}
      {dirty && <UnloadGuard />}
    </div>
  );
}

function LinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div class="review-link-row">
      <a href={url} target="_blank" rel="noopener noreferrer" class="mono">
        {url}
      </a>
      <button
        type="button"
        class="button small"
        onClick={async () => {
          if (await copyText(url)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function UnloadGuard() {
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  return null;
}

/** Pick prototype versions of the project to add as options. */
function AddPrototypesDialog({
  project,
  existing,
  onClose,
  onAdd,
}: {
  project: string;
  existing: string[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const families = groupFamilies(prototypes.value.filter((p) => p.project === project)).sort(
    (a, b) => b.at(-1)!.updatedAt.localeCompare(a.at(-1)!.updatedAt),
  );
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (localId: string) =>
    setPicked((p) => (p.includes(localId) ? p.filter((x) => x !== localId) : [...p, localId]));
  return (
    <Modal title="Add prototypes" onClose={onClose} wide>
      <div class="dialog-body">
        {families.length === 0 && <p class="muted">This project has no prototypes yet.</p>}
        <ul class="review-picker">
          {families.map((family) => {
            const latest = family.at(-1)!;
            return (
              <li key={family[0]!.id} class="review-picker-family">
                <PrototypeThumb proto={latest} class="review-picker-thumb" />
                <div>
                  <strong>{familyTitle(latest)}</strong>
                  <div class="review-picker-versions" role="group" aria-label="Versions">
                    {family.map((proto, i) => {
                      const added = existing.includes(proto.localId);
                      const on = picked.includes(proto.localId);
                      return (
                        <button
                          type="button"
                          key={proto.id}
                          class={`chip-toggle ${on ? "active" : ""}`}
                          aria-pressed={on}
                          disabled={added}
                          title={added ? "Already in the review" : (proto.description ?? "")}
                          onClick={() => toggle(proto.localId)}
                        >
                          {family.length > 1 ? versionLabel(i, family.length) : "Add"}
                          {added ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <footer class="dialog-actions">
        <span class="muted">{picked.length ? `${picked.length} selected` : ""}</span>
        <span class="toolbar-spacer" />
        <button type="button" class="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          class="button primary"
          disabled={!picked.length}
          onClick={() => onAdd(picked)}
        >
          Add {picked.length || ""}
        </button>
      </footer>
    </Modal>
  );
}
