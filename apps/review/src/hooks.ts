import {
  REVIEW_MANIFEST_FILE,
  type ReviewManifest,
} from "@beyland/scratchpad-core/review-manifest";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { ManifestError, parseManifest } from "./manifest.ts";
import { formatRoute, parseRoute, type ReviewRoute } from "./route.ts";

export type ManifestState =
  | { status: "loading" }
  | { status: "ready"; manifest: ReviewManifest }
  | { status: "error"; message: string };

async function loadManifest(): Promise<ReviewManifest> {
  let response: Response;
  try {
    response = await fetch(new URL(REVIEW_MANIFEST_FILE, document.baseURI), { cache: "no-cache" });
  } catch {
    throw new ManifestError(
      location.protocol === "file:"
        ? "This review has to be opened from a web server, not straight from disk."
        : "The review couldn't be downloaded. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    throw new ManifestError(
      response.status === 404
        ? "This review couldn't be found. The link may be out of date."
        : `The review couldn't be downloaded (HTTP ${response.status}).`,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ManifestError("The review's data is damaged (review.json isn't valid JSON).");
  }
  return parseManifest(data);
}

/** review.json next to the page, with a way to try again after an error. */
export function useManifest(): [ManifestState, () => void] {
  const [state, setState] = useState<ManifestState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadManifest().then(
      (manifest) => !cancelled && setState({ status: "ready", manifest }),
      (error: unknown) =>
        !cancelled &&
        setState({
          status: "error",
          message:
            error instanceof ManifestError
              ? error.message
              : "Something went wrong loading the review.",
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return [state, useCallback(() => setAttempt((n) => n + 1), [])];
}

export type Navigate = (route: ReviewRoute, options?: { replace?: boolean }) => void;

/** The route in the location hash. `replace` updates it without a new history entry. */
export function useHashRoute(): [ReviewRoute, Navigate] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = useCallback<Navigate>((route, options) => {
    const next = formatRoute(route);
    if (options?.replace) {
      history.replaceState(history.state, "", next);
      setHash(next);
    } else {
      location.hash = next;
    }
  }, []);
  return [useMemo(() => parseRoute(hash), [hash]), navigate];
}

/** Whether a media query matches, kept up to date. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
