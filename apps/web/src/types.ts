import type {
  Project,
  ProjectUrls,
  Prototype,
  PrototypeFileEntry,
  PrototypeUrls,
  Source,
  WorkspaceUrls,
} from "@beyland/scratchpad-core";

export type {
  Prototype,
  PrototypeFileEntry,
  PrototypeStatus,
  PrototypeUrls,
  Source,
} from "@beyland/scratchpad-core";

/**
 * A prototype as the app holds it. `id` is its workspace-unique `project/id` reference (what the
 * app keys by and passes to commands), and `localId` its folder name; `variantOf`, `system` and
 * `resolvedSystem` are qualified the same way.
 */
export type PrototypeWithUrls = Prototype & {
  localId: string;
  urls: PrototypeUrls;
  /** The design system it uses: its `system`, or the one inferred from its HTML or project. */
  resolvedSystem?: string;
};

export type ProjectSummary = Project & {
  dir: string;
  prototypes: number;
  systems: number;
  urls: ProjectUrls;
};

export interface WorkspaceInfo {
  root: string;
  projects: { id: string; name: string; description?: string; dir: string }[];
  sources: (Source & { resolvedLocation: string })[];
  prototypeCount: number;
  groups: string[];
  tags: string[];
  urls: WorkspaceUrls;
}

export interface PrototypeDetails {
  prototype: PrototypeWithUrls;
  files: PrototypeFileEntry[];
  family: { id: string; title: string; variantOf?: string; status: string }[];
}

export type { DesignComponent, DesignSystem, Token } from "@beyland/scratchpad-core";

export interface ComponentSummary {
  name: string;
  tag: string;
  kind: "component" | "pattern" | "context";
  title: string;
  category: string;
  status: string;
  verification: "verified" | "drift" | "unverified";
  summary: string;
  requires: string[];
  uses: string[];
  /** Package systems: the module with its examples. */
  story?: string;
  /** How many examples it has (contexts without any show a placeholder). */
  examples?: number;
  issues?: string[];
}

export interface CaptureSummary {
  label: string;
  selector: string;
  theme?: string;
  state?: string;
  capturedAt?: string;
  width?: number;
  height?: number;
  parentWidth?: number;
  scale: number;
  rules: number;
  elements: number;
  context: string;
  usedBy: { name: string; tag: string; as: string[] }[];
}

export interface ActivityEntry {
  at: string;
  kind: "system" | "tokens" | "capture" | "component" | "verify" | "build";
  title: string;
  detail?: string;
  ref?: string;
  status?: "ok" | "warn" | "error";
}
