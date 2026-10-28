import { PlannedSection } from "../components/PlannedSection.tsx";

/** Gathering and tracking design feedback on a project's prototypes. Scaffold only. */
export function Feedback() {
  return (
    <PlannedSection
      title="Feedback"
      lede="Gather feedback on this project's prototypes and track it to resolution."
      icon="message"
    >
      Comments pinned to prototypes, review requests, and a running list of what's open and what's
      resolved will live here.
    </PlannedSection>
  );
}
