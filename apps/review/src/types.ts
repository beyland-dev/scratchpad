import type { ReviewManifest } from "@beyland/sprue-core/review-manifest";
import type { Navigate } from "./hooks.ts";
import type { ReviewRoute } from "./route.ts";

/** What every view gets from the app shell. */
export interface ViewProps {
  manifest: ReviewManifest;
  route: ReviewRoute;
  navigate: Navigate;
  questionsOpen: boolean;
  onQuestionsOpen: (open: boolean) => void;
}
