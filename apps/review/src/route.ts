import type { ReviewDevice, ReviewManifest } from "@beyland/scratchpad-core/review-manifest";
import { isReviewDevice } from "./manifest.ts";

export type ReviewView = "overview" | "option" | "compare";

/** Where the reviewer is, kept in the URL hash so any static host can serve the app. */
export interface ReviewRoute {
  view: ReviewView;
  /** The option shown (option view). */
  key?: string;
  /** Page of the option, relative to the export root (option view). */
  page?: string;
  /** Options side by side (compare). */
  keys?: string[];
  device?: ReviewDevice;
  theme?: string;
}

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/** The route in a location hash: `#/`, `#/o/<key>` or `#/compare`, plus `?device=…&theme=…`. */
export function parseRoute(hash: string): ReviewRoute {
  const raw = hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const path = (q === -1 ? raw : raw.slice(0, q)).split("/").filter(Boolean);
  const params = new URLSearchParams(q === -1 ? "" : raw.slice(q + 1));

  const route: ReviewRoute = { view: "overview" };
  const key = path[0] === "o" && path.length === 2 ? decode(path[1] ?? "") : undefined;
  if (key) {
    route.view = "option";
    route.key = key;
    const page = params.get("page");
    if (page) route.page = page;
  } else if (path[0] === "compare" && path.length === 1) {
    route.view = "compare";
    const keys = (params.get("keys") ?? "").split(",").filter(Boolean);
    if (keys.length) route.keys = keys;
  }
  const device = params.get("device");
  if (isReviewDevice(device)) route.device = device;
  const theme = params.get("theme");
  if (theme) route.theme = theme;
  return route;
}

/** The location hash for a route (inverse of `parseRoute`). */
export function formatRoute(route: ReviewRoute): string {
  let path = "/";
  const params = new URLSearchParams();
  if (route.view === "option" && route.key) {
    path = `/o/${encodeURIComponent(route.key)}`;
    if (route.page) params.set("page", route.page);
  } else if (route.view === "compare") {
    path = "/compare";
    if (route.keys?.length) params.set("keys", route.keys.join(","));
  }
  if (route.device) params.set("device", route.device);
  if (route.theme) params.set("theme", route.theme);
  const query = params.toString().replaceAll("%2C", ",").replaceAll("%2F", "/");
  return `#${path}${query ? `?${query}` : ""}`;
}

/** The view settings (device, theme) that follow the reviewer between views. */
export function viewSettings(route: ReviewRoute): Pick<ReviewRoute, "device" | "theme"> {
  return {
    ...(route.device ? { device: route.device } : {}),
    ...(route.theme ? { theme: route.theme } : {}),
  };
}

/** The browser tab's title for a route. */
export function documentTitle(manifest: ReviewManifest, route: ReviewRoute): string {
  if (route.view === "option") {
    const item = manifest.items.find((i) => i.key === route.key);
    if (item) return `${item.label} · ${manifest.title}`;
  }
  if (route.view === "compare") return `Compare · ${manifest.title}`;
  return manifest.title;
}
