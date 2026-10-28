import { CoreError } from "./errors.ts";
import { ID_PATTERN } from "./schemas.ts";

/**
 * A reference to something inside a project: `project/id`, or just `id` when only one project has
 * it. Ids are unique within a project (they're folder names), not across projects.
 */
export interface Ref {
  project?: string;
  id: string;
}

/** Matches `id` or `project/id`. */
export const REF_PATTERN =
  /^(?:[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}\/)?[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

/** Parse `id` or `project/id`; an explicit `project` must agree with a qualified one. */
export function parseRef(ref: string, project?: string): Ref {
  const slash = ref.indexOf("/");
  const parsed: Ref =
    slash === -1 ? { id: ref } : { project: ref.slice(0, slash), id: ref.slice(slash + 1) };
  if (!ID_PATTERN.test(parsed.id) || (parsed.project && !ID_PATTERN.test(parsed.project)))
    throw new CoreError(
      "INVALID_INPUT",
      `Invalid reference ${JSON.stringify(ref)}: use id or project/id`,
    );
  if (project !== undefined && parsed.project !== undefined && parsed.project !== project)
    throw new CoreError(
      "INVALID_INPUT",
      `Reference ${JSON.stringify(ref)} is in project ${JSON.stringify(parsed.project)}, not ${JSON.stringify(project)}`,
    );
  return {
    id: parsed.id,
    ...((parsed.project ?? project) ? { project: parsed.project ?? project } : {}),
  };
}

/** `project/id`: unique across the workspace. */
export function refKey(project: string, id: string): string {
  return `${project}/${id}`;
}

/** `project/id` from an optional project and an id that may already be qualified. */
export function qualify(id: string, project?: string): string {
  const ref = parseRef(id, project);
  return ref.project ? refKey(ref.project, ref.id) : ref.id;
}
