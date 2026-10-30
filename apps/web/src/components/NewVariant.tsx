import { signal } from "@preact/signals";
import { versionLabel } from "@beyland/sprue-core/family";
import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { call } from "../api.ts";
import { prototypeHref } from "../prototype-theme.ts";
import { variantPrompt } from "../prompts.ts";
import { byId, familyOf, normalizePrototype, refresh } from "../store.ts";
import type { PrototypeWithUrls } from "../types.ts";
import { editedAgo } from "../util.ts";
import { Code } from "./Code.tsx";
import { Icon } from "./Icon.tsx";
import { Field, FormActions, Modal, useSubmit } from "./Modal.tsx";
import { PrototypeThumb } from "./PrototypeCard.tsx";

/** The prototype a "New variant" dialog opened from; it's preselected as the fork source. */
const request = signal<string | null>(null);

/** Open the New variant dialog for the family of `sourceId`, with that version preselected. */
export function openNewVariant(sourceId: string): void {
  request.value = sourceId;
}

/**
 * Hosts the dialog at the app root, so it stays open while the app navigates to the new variant
 * (from a gallery card or the viewer alike).
 */
export function NewVariantHost() {
  const sourceId = request.value;
  if (!sourceId || !byId.value.has(sourceId)) return null;
  return (
    <NewVariantDialog key={sourceId} sourceId={sourceId} onClose={() => (request.value = null)} />
  );
}

function NewVariantDialog({ sourceId, onClose }: { sourceId: string; onClose: () => void }) {
  const { route, query, path } = useLocation();
  const family = familyOf(sourceId);
  const [source, setSource] = useState(sourceId);
  const [change, setChange] = useState("");
  const [created, setCreated] = useState<{ variant: PrototypeWithUrls; prompt: string } | null>(
    null,
  );
  const root = family[0]!;
  const from = family.find((p) => p.id === source) ?? family[family.length - 1]!;
  const fromLabel = family.length > 1 ? versionLabel(family.indexOf(from), family.length) : null;
  const { busy, error, submit } = useSubmit(async () => {
    const created = await call<{ prototype: PrototypeWithUrls }>("prototype.createVariant", {
      id: from.id,
      ...(change.trim() ? { description: change.trim() } : {}),
      createdBy: { kind: "human" },
    });
    const prototype = normalizePrototype(created.prototype);
    await refresh();
    // Keep the viewport and theme when forking from the viewer.
    const inViewer = /^\/projects\/[^/]+\/p\//.test(path);
    route(
      prototypeHref(prototype.id, inViewer ? { device: query.device, theme: query.theme } : {}),
    );
    setCreated({ variant: prototype, prompt: variantPrompt(prototype, from) });
  });

  if (created)
    return (
      <Modal title="Variant created" onClose={onClose} wide>
        <div class="dialog-body">
          <p class="variant-created">
            The new version of <strong>{root.title}</strong> starts as a copy of{" "}
            <strong>{fromLabel ?? "the original"}</strong>. Give this prompt to an agent connected
            to Sprue to make the change. The viewer updates live as it writes files.
          </p>
          <Code code={created.prompt} lang="text" class="variant-prompt" />
        </div>
        <footer class="dialog-actions">
          <span class="toolbar-spacer" />
          <button type="button" class="button primary" onClick={onClose} autoFocus>
            Done
          </button>
        </footer>
      </Modal>
    );

  const picking = family.length > 1;
  return (
    <Modal title="New variant" onClose={onClose} wide={picking}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          {picking ? (
            <div class="field" role="group" aria-labelledby="fork-from-label">
              <span class="field-label" id="fork-from-label">
                Fork from
              </span>
              <div class="fork-options" role="radiogroup" aria-labelledby="fork-from-label">
                {family.map((p, i) => (
                  <ForkOption
                    key={p.id}
                    proto={p}
                    label={versionLabel(i, family.length)}
                    checked={p.id === from.id}
                    onSelect={() => setSource(p.id)}
                  />
                ))}
              </div>
              <span class="field-hint">
                The new variant starts as a copy of this version's files.
              </span>
            </div>
          ) : (
            <div class="fork-single">
              <PrototypeThumb proto={from} class="fork-thumb" />
              <div class="fork-text">
                <span class="fork-eyebrow">Forking from</span>
                <strong>{root.title}</strong>
                <span>{editedAgo(from.updatedAt)}</span>
              </div>
            </div>
          )}
          <Field
            label="What should change?"
            value={change}
            onInput={setChange}
            multiline
            autoFocus
            placeholder="e.g. Collapse shipping and payment into one step, with Apple Pay first."
            hint={`Versions share the name “${root.title}” and are told apart as V1, V2, … Latest, so this is what sets it apart. Agents use it as the brief.`}
          />
        </div>
        <FormActions
          submitLabel={fromLabel ? `Fork ${fromLabel}` : "Create variant"}
          busy={busy}
          error={error}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}

function ForkOption({
  proto,
  label,
  checked,
  onSelect,
}: {
  proto: PrototypeWithUrls;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      class={`fork-option ${checked ? "active" : ""}`}
      title={proto.description ?? proto.title}
      onClick={onSelect}
    >
      <span class="fork-thumb-wrap">
        <PrototypeThumb proto={proto} class="fork-thumb" />
        {checked && (
          <span class="fork-check" aria-hidden="true">
            <Icon name="check" size={12} />
          </span>
        )}
      </span>
      <span class="fork-text">
        <strong>
          {label}
          <span class="fork-time">{editedAgo(proto.updatedAt).replace(/^Edited /, "")}</span>
        </strong>
        <span>{proto.description ?? "No description"}</span>
      </span>
    </button>
  );
}
