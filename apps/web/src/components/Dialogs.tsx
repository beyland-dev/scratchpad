import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { call } from "../api.ts";
import {
  UNSORTED,
  familyOf,
  familyTitle,
  projectHref,
  projectIdOf,
  refresh,
  systems,
  versionLabelOf,
  workspace,
  type ProjectEntry,
  type SystemSummary,
} from "../store.ts";
import type { ComponentSummary, PrototypeWithUrls } from "../types.ts";
import { prototypePrompt, starterHtml, starterTsx } from "../prompts.ts";
import { slugify } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { ConfirmDialog, Field, FormActions, Modal, useSubmit } from "./Modal.tsx";
import { PATTERN_COUNT, ProjectIcon, patternOf } from "./ProjectIcon.tsx";

const ICON_COLORS: [hex: string, name: string][] = [
  ["#6366f1", "Indigo"],
  ["#0ea5e9", "Sky"],
  ["#10b981", "Emerald"],
  ["#f59e0b", "Amber"],
  ["#ef4444", "Red"],
  ["#ec4899", "Pink"],
  ["#8b5cf6", "Violet"],
  ["#64748b", "Slate"],
];
const ICON_TYPES: Record<string, "svg" | "png" | "webp" | "jpg"> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};
const MAX_ICON_BYTES = 1024 * 1024;

interface IconUpload {
  format: "svg" | "png" | "webp" | "jpg";
  content: string;
  encoding: "utf8" | "base64";
  preview: string;
}

async function readIcon(file: File): Promise<IconUpload> {
  const format = ICON_TYPES[file.type];
  if (!format) throw new Error("Use an SVG, PNG, WebP or JPEG image.");
  if (file.size > MAX_ICON_BYTES) throw new Error("The icon must be smaller than 1 MB.");
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
  if (format === "svg") return { format, content: await file.text(), encoding: "utf8", preview };
  return { format, content: preview.slice(preview.indexOf(",") + 1), encoding: "base64", preview };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

// ---- Projects -------------------------------------------------------------------

/** Create a project, or edit one when `project` is given. */
export function ProjectDialog({
  project,
  onClose,
}: {
  project?: ProjectEntry;
  onClose: () => void;
}) {
  const { route } = useLocation();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? "");
  // New projects start on a random pattern; it never depends on the name.
  const [pattern, setPattern] = useState<number | undefined>(() =>
    project ? project.pattern : Math.floor(Math.random() * PATTERN_COUNT),
  );
  const [icon, setIcon] = useState<IconUpload | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const hasIcon = Boolean(icon || (project?.iconUrl && !removeIcon));
  const { busy, error, submit } = useSubmit(async () => {
    const iconInput = icon
      ? { format: icon.format, content: icon.content, encoding: icon.encoding }
      : undefined;
    if (project) {
      await call("project.update", {
        id: project.id,
        name: name.trim(),
        description: orNull(description),
        color: color || null,
        ...(pattern !== undefined ? { pattern } : {}),
        ...(iconInput ? { icon: iconInput } : removeIcon ? { icon: null } : {}),
      });
      await refresh();
      onClose();
    } else {
      const { project: created } = await call<{ project: { id: string } }>("project.create", {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(color ? { color } : {}),
        ...(pattern !== undefined ? { pattern } : {}),
        ...(iconInput ? { icon: iconInput } : {}),
      });
      await refresh();
      onClose();
      route(projectHref(created.id));
    }
  });
  const preview: ProjectEntry = {
    id: project?.id ?? "new-project",
    name: name || "New project",
    color: color || undefined,
    pattern,
    iconUrl: icon?.preview ?? (removeIcon ? undefined : project?.iconUrl),
    prototypes: 0,
    systems: 0,
  };

  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          <Field
            label="Name"
            value={name}
            onInput={setName}
            required
            autoFocus
            placeholder="e.g. Web app"
          />
          <Field
            label="Description"
            value={description}
            onInput={setDescription}
            multiline
            placeholder="What's this product, and what are you exploring?"
          />
          <div class="field" role="group" aria-label="Icon">
            <span class="field-label">Icon</span>
            <div class="icon-picker">
              <div class="icon-preview">
                <ProjectIcon project={preview} size={48} />
                {!hasIcon && (
                  <button
                    type="button"
                    class="icon-remix"
                    aria-label="Next icon style"
                    title="Next style"
                    onClick={() =>
                      setPattern(((pattern ?? patternOf(preview)) + 1) % PATTERN_COUNT)
                    }
                  >
                    <Icon name="shuffle" size={18} />
                  </button>
                )}
              </div>
              <div class="icon-picker-controls">
                <div class="icon-picker-buttons">
                  <label class="button small">
                    <Icon name="upload" size={14} />
                    {hasIcon ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept={Object.keys(ICON_TYPES).join(",")}
                      class="visually-hidden"
                      onChange={async (e) => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (!file) return;
                        try {
                          setIcon(await readIcon(file));
                          setRemoveIcon(false);
                          setIconError(null);
                        } catch (err) {
                          setIconError((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  {hasIcon && (
                    <button
                      type="button"
                      class="button small ghost"
                      onClick={() => {
                        setIcon(null);
                        setRemoveIcon(true);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {!hasIcon && (
                  <div class="swatches" role="radiogroup" aria-label="Icon color">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!color}
                      class={`swatch-option auto ${!color ? "active" : ""}`}
                      title="Automatic"
                      onClick={() => setColor("")}
                    >
                      Auto
                    </button>
                    {ICON_COLORS.map(([c, colorName]) => (
                      <button
                        type="button"
                        role="radio"
                        key={c}
                        aria-checked={color === c}
                        aria-label={colorName}
                        title={colorName}
                        class={`swatch-option ${color === c ? "active" : ""}`}
                        style={{ "--swatch": c }}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                )}
                <span class="field-hint">
                  {iconError ?? "SVG, PNG, WebP or JPEG, up to 1 MB. Square works best."}
                </span>
              </div>
            </div>
          </div>
        </div>
        <FormActions
          submitLabel={project ? "Save" : "Create project"}
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={!name.trim()}
        />
      </form>
    </Modal>
  );
}

export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: ProjectEntry;
  onClose: () => void;
}) {
  const { route } = useLocation();
  const contents = [
    project.prototypes && `${project.prototypes} prototype${project.prototypes === 1 ? "" : "s"}`,
    project.systems && `${project.systems} design system${project.systems === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <ConfirmDialog
      title={`Delete “${project.name}”?`}
      confirmLabel="Delete project"
      onClose={onClose}
      onConfirm={async () => {
        await call("project.delete", { id: project.id });
        await refresh();
        onClose();
        route("/", true);
      }}
    >
      <p>
        The project moves to <code>.design/.trash/</code>.{" "}
        {contents.length
          ? `Its ${contents.join(" and ")} ${
              project.prototypes + project.systems === 1 ? "isn't" : "aren't"
            } deleted; ${project.prototypes + project.systems === 1 ? "it moves" : "they move"} to Trash.`
          : "It's empty."}
      </p>
    </ConfirmDialog>
  );
}

// ---- Prototypes -------------------------------------------------------------------

/** Create a prototype in `projectId`, or edit `proto`. */
export function PrototypeDialog({
  proto,
  projectId,
  groups,
  onClose,
}: {
  proto?: PrototypeWithUrls;
  projectId?: string;
  groups: string[];
  onClose: () => void;
}) {
  const { route } = useLocation();
  // Versions share their family's name, so editing one renames the family.
  const versions = proto ? familyOf(proto.id).length : 1;
  const [title, setTitle] = useState(proto ? familyTitle(proto) : "");
  const [description, setDescription] = useState(proto?.description ?? "");
  const [group, setGroup] = useState(proto?.group ?? "");
  const [tags, setTags] = useState(proto?.tags.join(", ") ?? "");
  // Package design systems of the project: new prototypes can be React prototypes built with one.
  const packageSystems = systems.value.filter(
    (sys) => sys.kind === "package" && (projectId ?? UNSORTED) === projectIdOf(sys),
  );
  const [builtWith, setBuiltWith] = useState(packageSystems[0]?.id ?? "html");
  const { busy, error, submit } = useSubmit(async () => {
    if (proto) {
      await call("prototype.update", {
        id: proto.id,
        title: title.trim(),
        description: orNull(description),
        group: orNull(group),
        tags: tags
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
      });
      await refresh();
      onClose();
    } else {
      const { prototype } = await call<{ prototype: PrototypeWithUrls }>("prototype.create", {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(group.trim() ? { group: group.trim() } : {}),
        ...(builtWith !== "html" ? { framework: "react", system: builtWith } : {}),
        project: projectId && projectId !== UNSORTED ? projectId : null,
        createdBy: { kind: "human" },
      });
      // The id is only known after creation, and the prompt names it.
      const prompt = prototypePrompt(prototype);
      await call("prototype.writeFile", {
        id: prototype.id,
        ...(prototype.framework
          ? { path: "main.tsx", content: starterTsx(prototype, prompt) }
          : { path: prototype.entry, content: starterHtml(prototype, prompt) }),
      });
      await refresh();
      onClose();
      route(`/p/${encodeURIComponent(prototype.id)}`);
    }
  });
  return (
    <Modal title={proto ? "Edit prototype" : "New prototype"} onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          <Field
            label="Title"
            value={title}
            onInput={setTitle}
            required
            autoFocus
            placeholder="e.g. One-page checkout"
            hint={versions > 1 ? `Shared by all ${versions} versions.` : undefined}
          />
          <Field
            label="Description"
            value={description}
            onInput={setDescription}
            multiline
            placeholder={
              versions > 1
                ? "What this version changes. Agents use this as the brief."
                : "What it explores and why. Agents use this as the brief."
            }
          />
          {!proto && packageSystems.length > 0 && (
            <div class="field" role="group" aria-labelledby="built-with-label">
              <span class="field-label" id="built-with-label">
                Built with
              </span>
              <div
                class="segmented source-modes"
                role="radiogroup"
                aria-labelledby="built-with-label"
              >
                {[
                  ...packageSystems.map((sys) => [sys.id, `React · ${sys.name}`] as const),
                  ["html", "Plain HTML"] as const,
                ].map(([value, label]) => (
                  <button
                    type="button"
                    role="radio"
                    key={value}
                    aria-checked={builtWith === value}
                    class={builtWith === value ? "active" : ""}
                    onClick={() => setBuiltWith(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field
            label="Group"
            value={group}
            onInput={setGroup}
            list="prototype-groups"
            placeholder="e.g. checkout-redesign"
            hint="Clusters explorations of the same problem."
          />
          <datalist id="prototype-groups">
            {groups.map((g) => (
              <option value={g} key={g} />
            ))}
          </datalist>
          {proto && (
            <Field
              label="Tags"
              value={tags}
              onInput={setTags}
              placeholder="checkout, mobile"
              hint="Comma separated."
            />
          )}
        </div>
        <FormActions
          submitLabel={proto ? "Save" : "Create prototype"}
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={!title.trim()}
        />
      </form>
    </Modal>
  );
}

export function DeletePrototypeDialog({
  proto,
  versions = 1,
  onDeleted,
  onClose,
}: {
  proto: PrototypeWithUrls;
  /** Size of its variant family; other versions are kept. */
  versions?: number;
  onDeleted?: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title={
        versions > 1
          ? `Delete ${versionLabelOf(proto) ?? "this version"} of “${familyTitle(proto)}”?`
          : `Delete “${proto.title}”?`
      }
      confirmLabel={versions > 1 ? "Delete this version" : "Delete prototype"}
      onClose={onClose}
      onConfirm={async () => {
        await call("prototype.delete", { id: proto.id });
        await refresh();
        onClose();
        onDeleted?.();
      }}
    >
      <p>
        Its folder moves to <code>.design/.trash/</code>, where it can be restored.
        {versions > 1 ? ` The other ${versions - 1} version${versions === 2 ? "" : "s"} stay.` : ""}
      </p>
    </ConfirmDialog>
  );
}

// ---- Design systems -------------------------------------------------------------------

function prefixFrom(name: string): string {
  const words = name.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? [];
  const prefix = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 6);
  return /^[a-z][a-z0-9]*$/.test(prefix) ? prefix : "ds";
}

type SourceMode = "none" | "local" | "git";

interface SourceChoice {
  mode: SourceMode;
  path: string;
  url: string;
}

const GIT_URL = /^(https:\/\/|git@|ssh:\/\/)\S+$/;

function sourceChoiceOf(sourceId: string | undefined): SourceChoice {
  const source = workspace.value?.sources.find((s) => s.id === sourceId);
  if (!source) return { mode: "none", path: "", url: "" };
  return source.kind === "git"
    ? { mode: "git", path: "", url: source.location }
    : { mode: "local", path: source.resolvedLocation, url: "" };
}

/** Registers the chosen folder or repo as a workspace source (reusing a matching one). */
async function resolveSource(choice: SourceChoice): Promise<string | null> {
  if (choice.mode === "none") return null;
  const sources = workspace.value?.sources ?? [];
  if (choice.mode === "git") {
    const url = choice.url.trim().replace(/\/+$/, "");
    if (!GIT_URL.test(url))
      throw new Error("Enter a repository URL like https://github.com/owner/repo");
    const existing = sources.find(
      (s) => s.kind === "git" && s.location.replace(/\/+$/, "") === url,
    );
    if (existing) return existing.id;
    const { source } = await call<{ source: { id: string } }>("source.add", {
      location: url,
      kind: "git",
    });
    return source.id;
  }
  const path = choice.path.trim().replace(/(.)\/+$/, "$1");
  if (!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path))
    throw new Error("Enter the folder's absolute path, or choose it with Browse…");
  const existing = sources.find((s) => s.kind === "local" && s.resolvedLocation === path);
  if (existing) return existing.id;
  const { source } = await call<{ source: { id: string } }>("source.add", {
    location: path,
    kind: "local",
  });
  return source.id;
}

async function pickFolder(): Promise<{ path: string | null } | { unavailable: string }> {
  const response = await fetch("/api/pick-folder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = (await response.json()) as
    | { ok: true; result: { path: string | null } }
    | { ok: false; error: { message: string } };
  return body.ok ? body.result : { unavailable: body.error.message };
}

function SourcePicker({
  value,
  onChange,
  label = "Source codebase",
  hint,
}: {
  value: SourceChoice;
  onChange: (next: SourceChoice) => void;
  label?: string;
  /** Shown for "None yet" (and always, when given). */
  hint?: string;
}) {
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const modes: [SourceMode, string][] = [
    ["none", "None yet"],
    ["local", "Local folder"],
    ["git", "Git repo"],
  ];
  return (
    <div class="field" role="group" aria-labelledby="source-label">
      <span class="field-label" id="source-label">
        {label}
        <span class="field-optional" aria-hidden="true">
          Optional
        </span>
      </span>
      <div class="segmented source-modes" role="radiogroup" aria-labelledby="source-label">
        {modes.map(([mode, label]) => (
          <button
            type="button"
            role="radio"
            key={mode}
            aria-checked={value.mode === mode}
            class={value.mode === mode ? "active" : ""}
            onClick={() => onChange({ ...value, mode })}
          >
            {label}
          </button>
        ))}
      </div>
      {value.mode === "local" && (
        <div class="source-row">
          <input
            class="input field-input mono"
            aria-label="Folder path"
            placeholder="/Users/me/code/my-app"
            spellcheck={false}
            value={value.path}
            onInput={(e) => onChange({ ...value, path: e.currentTarget.value })}
          />
          <button
            type="button"
            class="button"
            disabled={picking}
            onClick={async () => {
              setPicking(true);
              setNote(null);
              try {
                const result = await pickFolder();
                if ("unavailable" in result)
                  setNote(`${result.unavailable}. Type the path instead.`);
                else if (result.path) onChange({ ...value, path: result.path });
              } catch (e) {
                setNote((e as Error).message);
              } finally {
                setPicking(false);
              }
            }}
          >
            {picking ? "Choosing…" : "Browse…"}
          </button>
        </div>
      )}
      {value.mode === "git" && (
        <input
          class="input field-input mono"
          aria-label="Repository URL"
          placeholder="https://github.com/owner/repo"
          spellcheck={false}
          value={value.url}
          onInput={(e) => onChange({ ...value, url: e.currentTarget.value })}
        />
      )}
      <span class="field-hint">
        {note ??
          (value.mode === "local"
            ? "The agent reads the product's code from this folder (it's never modified)."
            : value.mode === "git"
              ? "The agent clones it into this system's folder (gitignored) and reads it from there."
              : (hint ??
                "You can add one later: dt source add <path-or-url>, or ask the agent to."))}
      </span>
    </div>
  );
}

const LIBRARIES: { id: string; name: string; package: string; docsUrl: string }[] = [
  { id: "shadcn", name: "shadcn/ui", package: "shadcn", docsUrl: "https://ui.shadcn.com/docs" },
  {
    id: "primer",
    name: "Primer React",
    package: "@primer/react",
    docsUrl: "https://primer.style/product/getting-started/react/",
  },
  {
    id: "radix",
    name: "Radix Themes",
    package: "@radix-ui/themes",
    docsUrl: "https://www.radix-ui.com/themes/docs",
  },
];

/** Create a design system in `projectId`, or edit `system`. */
export function SystemDialog({
  system,
  projectId,
  onClose,
}: {
  system?: SystemSummary;
  projectId?: string;
  onClose: () => void;
}) {
  const { route } = useLocation();
  const [name, setName] = useState(system?.name ?? "");
  const [description, setDescription] = useState(system?.description ?? "");
  const [source, setSource] = useState(() => sourceChoiceOf(system?.sourceId));
  const [id, setId] = useState<string | null>(null);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [kind, setKind] = useState<"package" | "captured">(system?.kind ?? "package");
  const [libraryId, setLibraryId] = useState(LIBRARIES[0]!.id);
  const [otherPackage, setOtherPackage] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherDocs, setOtherDocs] = useState("");
  const autoId = slugify(name);
  const autoPrefix = prefixFrom(name);
  const isPackage = kind === "package";
  const library =
    libraryId === "other"
      ? {
          name: otherName.trim() || otherPackage.trim(),
          package: otherPackage.trim(),
          ...(otherDocs.trim() ? { docsUrl: otherDocs.trim() } : {}),
        }
      : (({ id: _id, ...rest }) => rest)(LIBRARIES.find((l) => l.id === libraryId)!);
  const { busy, error, submit } = useSubmit(async () => {
    const sourceId = await resolveSource(source);
    if (system) {
      await call("system.update", {
        id: system.id,
        name: name.trim(),
        description: description.trim(),
        sourceId,
      });
      await refresh();
      onClose();
    } else {
      const systemId = id ?? autoId;
      await call("system.create", {
        id: systemId,
        name: name.trim(),
        kind,
        ...(isPackage ? { library } : { prefix: prefix ?? autoPrefix }),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(sourceId ? { sourceId } : {}),
        project: projectId && projectId !== UNSORTED ? projectId : null,
      });
      await refresh();
      onClose();
      route(`/systems/${encodeURIComponent(systemId)}`);
    }
  });
  return (
    <Modal title={system ? "Edit design system" : "New design system"} onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          {!system && (
            <div class="field" role="group" aria-labelledby="start-from-label">
              <span class="field-label" id="start-from-label">
                Start from
              </span>
              <div class="choice-cards" role="radiogroup" aria-labelledby="start-from-label">
                {(
                  [
                    [
                      "package",
                      "An existing library",
                      "shadcn/ui, Primer, … customized for your product. Prototypes are written in React.",
                    ],
                    [
                      "captured",
                      "Capture my product",
                      "Codify a running product's UI into web components for plain HTML prototypes.",
                    ],
                  ] as const
                ).map(([value, title, text]) => (
                  <button
                    type="button"
                    role="radio"
                    key={value}
                    aria-checked={kind === value}
                    class={`choice-card ${kind === value ? "active" : ""}`}
                    onClick={() => setKind(value)}
                  >
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field
            label="Name"
            value={name}
            onInput={setName}
            required
            autoFocus
            placeholder="e.g. Acme UI"
          />
          <Field
            label="Description"
            value={description}
            onInput={setDescription}
            multiline
            placeholder="Which product and themes it covers."
          />
          {!system && isPackage && (
            <div class="field">
              <label class="field-label" for="system-library">
                Library
              </label>
              <select
                id="system-library"
                class="input field-input"
                value={libraryId}
                onChange={(e) => setLibraryId(e.currentTarget.value)}
              >
                {LIBRARIES.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
                <option value="other">Other…</option>
              </select>
              {libraryId === "other" && (
                <div class="field-row">
                  <input
                    class="input field-input mono"
                    aria-label="npm package"
                    placeholder="npm package, e.g. @mantine/core"
                    required
                    value={otherPackage}
                    onInput={(e) => setOtherPackage(e.currentTarget.value)}
                  />
                  <input
                    class="input field-input"
                    aria-label="Docs URL"
                    type="url"
                    placeholder="Docs URL (optional)"
                    value={otherDocs}
                    onInput={(e) => setOtherDocs(e.currentTarget.value)}
                  />
                </div>
              )}
              {libraryId === "other" && (
                <input
                  class="input field-input"
                  aria-label="Library name"
                  placeholder="Display name (optional)"
                  value={otherName}
                  onInput={(e) => setOtherName(e.currentTarget.value)}
                />
              )}
            </div>
          )}
          {!system && (
            <div class={isPackage ? "" : "field-row"}>
              <Field
                label="Id"
                value={id ?? autoId}
                onInput={setId}
                required
                mono
                pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
                hint={<>Folder name and URL.</>}
              />
              {!isPackage && (
                <Field
                  label="Tag prefix"
                  value={prefix ?? autoPrefix}
                  onInput={(v) => setPrefix(v.toLowerCase())}
                  required
                  mono
                  pattern="[a-z][a-z0-9]*"
                  hint={
                    <>
                      Components become <code>&lt;{prefix ?? autoPrefix}-button&gt;</code>.
                    </>
                  }
                />
              )}
            </div>
          )}
          <SourcePicker
            value={source}
            onChange={setSource}
            label={isPackage ? "Customizations from" : "Source codebase"}
            hint={
              isPackage
                ? "Your product's code, so the agent can copy its theme and customized components."
                : undefined
            }
          />
        </div>
        <FormActions
          submitLabel={system ? "Save" : "Create design system"}
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={!name.trim() || (isPackage && libraryId === "other" && !otherPackage.trim())}
        />
      </form>
    </Modal>
  );
}

export function DeleteSystemDialog({
  system,
  onClose,
}: {
  system: SystemSummary;
  onClose: () => void;
}) {
  const { route } = useLocation();
  return (
    <ConfirmDialog
      title={`Delete “${system.name}”?`}
      confirmLabel="Delete design system"
      onClose={onClose}
      onConfirm={async () => {
        await call("system.delete", { id: system.id });
        await refresh();
        onClose();
        route(projectHref(system.project ?? UNSORTED, "systems"), true);
      }}
    >
      <p>
        Its {system.components} components, {system.tokens.toLocaleString()} tokens and captures
        move to <code>.design/.trash/</code>. Prototypes that include its <code>system.css</code>{" "}
        stop rendering it.
      </p>
    </ConfirmDialog>
  );
}

// ---- Components -------------------------------------------------------------------

export function ComponentDialog({
  systemId,
  component,
  onClose,
}: {
  systemId: string;
  component: Pick<ComponentSummary, "name" | "title"> & { description: string; usage?: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(component.title);
  const [description, setDescription] = useState(component.description);
  const [usage, setUsage] = useState(component.usage ?? "");
  const { busy, error, submit } = useSubmit(async () => {
    await call("component.update", {
      system: systemId,
      name: component.name,
      title: title.trim(),
      description: description.trim(),
      usage: usage.trim(),
    });
    onClose();
  });
  return (
    <Modal title="Edit component" onClose={onClose}>
      <form onSubmit={submit}>
        <div class="dialog-body">
          <Field label="Title" value={title} onInput={setTitle} required autoFocus />
          <Field
            label="Description"
            value={description}
            onInput={setDescription}
            multiline
            required
          />
          <Field
            label="Usage"
            value={usage}
            onInput={setUsage}
            multiline
            hint="When to use it, for agents building prototypes."
          />
        </div>
        <FormActions
          submitLabel="Save"
          busy={busy}
          error={error}
          onCancel={onClose}
          disabled={!title.trim() || !description.trim()}
        />
      </form>
    </Modal>
  );
}

export function DeleteComponentDialog({
  systemId,
  component,
  onClose,
}: {
  systemId: string;
  component: { name: string; tag: string };
  onClose: () => void;
}) {
  const { route } = useLocation();
  return (
    <ConfirmDialog
      title={`Delete <${component.tag}>?`}
      confirmLabel="Delete component"
      onClose={onClose}
      onConfirm={async () => {
        await call("component.remove", { system: systemId, name: component.name });
        onClose();
        route(`/systems/${encodeURIComponent(systemId)}`, true);
      }}
    >
      <p>
        Its definition, examples and code move to <code>.design/.trash/</code>, and the system is
        rebuilt without it. Prototypes using <code>&lt;{component.tag}&gt;</code> will render it as
        an unknown element.
      </p>
    </ConfirmDialog>
  );
}
