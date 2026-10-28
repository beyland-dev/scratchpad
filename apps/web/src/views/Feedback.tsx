import { useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { call } from "../api.ts";
import { Icon } from "../components/Icon.tsx";
import { MenuButton } from "../components/Menu.tsx";
import { ConfirmDialog } from "../components/Modal.tsx";
import { PrototypeThumb } from "../components/PrototypeCard.tsx";
import {
  changedSinceLastRound,
  loaded,
  projectEntries,
  refresh,
  reviewHref,
  reviewItemPrototype,
  reviews,
} from "../store.ts";
import type { Review } from "../types.ts";
import { copyText, relativeTime } from "../util.ts";

/** Create an empty review in `project` and open it. */
export async function createReview(
  project: string,
  title: string,
  prototypes: string[] = [],
): Promise<Review> {
  const { review } = await call<{ review: Review }>("review.create", {
    project,
    title,
    items: prototypes.map((prototype) => ({ prototype })),
  });
  await refresh();
  return review;
}

/** A project's reviews: prototypes packaged for people to give feedback on. */
export function Feedback() {
  const { params } = useRoute();
  const { route } = useLocation();
  const projectId = params.project ?? "";
  const [creating, setCreating] = useState(false);
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  const project = projectEntries.value.find((p) => p.id === projectId);
  if (!project)
    return (
      <p class="page-message">
        No project <code>{projectId}</code>. <a href="/">Go to your projects</a>
      </p>
    );
  const list = reviews.value.filter((r) => r.project === projectId);
  const newReview = async () => {
    setCreating(true);
    try {
      route(reviewHref(await createReview(projectId, "Untitled review")));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div class="page">
      <div class="page-head">
        <div class="page-title-row">
          <h1>Feedback</h1>
          <span class="toolbar-spacer" />
          <button type="button" class="button primary" disabled={creating} onClick={newReview}>
            <Icon name="plus" size={14} /> New review
          </button>
        </div>
        <p class="muted">
          Package prototypes as a review, share it as a link people can open anywhere, and publish
          new rounds as the designs change.
        </p>
      </div>
      {list.length ? (
        <div class="grid review-grid">
          {list.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div class="empty-state">
          <ol class="review-steps">
            <li>
              <strong>Pick prototypes.</strong> Select versions in the gallery and choose{" "}
              <em>Request feedback</em>, or start a new review here.
            </li>
            <li>
              <strong>Frame it.</strong> Label the options, add context and the questions you want
              answered. Internal names and notes stay private.
            </li>
            <li>
              <strong>Publish.</strong> Each round is a frozen copy on GitHub Pages (from the
              project's repo), with a link that always shows the latest round.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [deleting, setDeleting] = useState(false);
  const last = review.rounds.at(-1);
  const changed = changedSinceLastRound(review).size;
  const thumbs = review.items
    .slice(0, 3)
    .map((item) => reviewItemPrototype(review, item))
    .filter((p) => p !== undefined);
  return (
    <div class="system-card-wrap review-card-wrap">
      <a class="system-card review-card" href={reviewHref(review)}>
        <div class="review-thumbs">
          {thumbs.length ? (
            thumbs.map((proto) => (
              <PrototypeThumb key={proto.id} proto={proto} class="review-thumb" />
            ))
          ) : (
            <span class="review-thumb empty">No prototypes yet</span>
          )}
        </div>
        <div class="card-title">{review.title}</div>
        <div class="card-meta">
          <span class="m">
            {review.items.length} option{review.items.length === 1 ? "" : "s"}
          </span>
          {last ? (
            <span class="m">
              Round {last.round} · {relativeTime(last.publishedAt)}
            </span>
          ) : (
            <span class="m">Draft</span>
          )}
          {last && changed > 0 && (
            <span class="chip review-changed" title="Prototypes changed since the last round">
              {changed} changed
            </span>
          )}
        </div>
      </a>
      <MenuButton
        class="card-menu"
        label={`${review.title} options`}
        items={[
          ...(review.urls.latest
            ? [
                {
                  label: "Copy link",
                  detail: "Always shows the latest round",
                  onSelect: () => void copyText(review.urls.latest!),
                },
              ]
            : []),
          { label: "Delete…", danger: true, onSelect: () => setDeleting(true) },
        ]}
      />
      {deleting && (
        <ConfirmDialog
          title={`Delete “${review.title}”?`}
          confirmLabel="Delete review"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await call("review.delete", { id: `${review.project}/${review.id}` });
            await refresh();
            setDeleting(false);
          }}
        >
          <p>
            It moves to the project's <code>.trash/</code>.
            {review.rounds.length
              ? " Published rounds stay online until removed from the repo's gh-pages branch."
              : ""}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
