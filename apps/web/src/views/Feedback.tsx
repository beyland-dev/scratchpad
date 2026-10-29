import { useState } from "preact/hooks";
import { useLocation, useRoute } from "preact-iso";
import { call } from "../api.ts";
import { Icon } from "../components/Icon.tsx";
import { MenuButton } from "../components/Menu.tsx";
import { ConfirmDialog } from "../components/Modal.tsx";
import { PrototypeThumb } from "../components/PrototypeCard.tsx";
import {
  beginReviewDraft,
  loaded,
  projectEntries,
  refresh,
  reviewHref,
  reviewItemPrototype,
  reviews,
} from "../store.ts";
import type { Review } from "../types.ts";
import { copyText, editedAgo } from "../util.ts";

/** A project's reviews: prototypes packaged for people to give feedback on. */
export function Feedback() {
  const { params } = useRoute();
  const { route } = useLocation();
  const projectId = params.project ?? "";
  if (!loaded.value) return <p class="page-message">Loading…</p>;
  const project = projectEntries.value.find((p) => p.id === projectId);
  if (!project)
    return (
      <p class="page-message">
        No project <code>{projectId}</code>. <a href="/">Go to your projects</a>
      </p>
    );
  const list = reviews.value.filter((r) => r.project === projectId);
  return (
    <div class="page">
      <div class="page-head">
        <div class="page-title-row">
          <h1>Feedback</h1>
          <span class="toolbar-spacer" />
          <button
            type="button"
            class="button primary"
            onClick={() => route(beginReviewDraft(projectId, "Untitled review"))}
          >
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
  return (
    <article class="card review-card">
      <a class="review-card-link" href={reviewHref(review)}>
        <ReviewFolder review={review} />
        <div class="card-body">
          <span class="card-title" title={review.title}>
            {review.title}
          </span>
          <time
            class="card-time"
            dateTime={review.updatedAt}
            title={new Date(review.updatedAt).toLocaleString()}
          >
            {editedAgo(review.updatedAt)}
          </time>
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
    </article>
  );
}

const REVIEW_FOLDER_SLOTS = 4;

function ReviewFolder({ review }: { review: Review }) {
  const prototypes = review.items
    .map((item) => reviewItemPrototype(review, item))
    .filter((prototype) => prototype !== undefined);
  const hidden = Math.max(0, prototypes.length - REVIEW_FOLDER_SLOTS);
  return (
    <div class="card-folder">
      {Array.from({ length: REVIEW_FOLDER_SLOTS }, (_, index) => {
        const prototype = prototypes[index];
        if (!prototype) return <span class="folder-cell empty" key={index} />;
        const isLast = index === REVIEW_FOLDER_SLOTS - 1 && hidden > 0;
        return (
          <div class="folder-cell" key={prototype.id}>
            <PrototypeThumb proto={prototype} class="folder-thumb" title={prototype.title} />
            {isLast && <span class="folder-more">+{hidden + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}
