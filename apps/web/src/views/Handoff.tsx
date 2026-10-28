import { PlannedSection } from "../components/PlannedSection.tsx";

/** Handing approved designs to a coding agent or turning them into GitHub issues. Scaffold only. */
export function Handoff() {
  return (
    <PlannedSection
      title="Handoff"
      lede="Turn approved prototypes into work: hand them to a coding agent or open GitHub issues."
      icon="send"
    >
      Pick prototypes to ship, then send them to a coding agent with their specs and design system,
      or file them as GitHub issues, and follow them through to merged code.
    </PlannedSection>
  );
}
