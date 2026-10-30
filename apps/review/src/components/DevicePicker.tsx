import type { ReviewDevice } from "@beyland/sprue-core/review-manifest";
import { DEVICES, type Device } from "../../../web/src/util.ts";
import { isReviewDevice } from "../manifest.ts";

const PRESETS = DEVICES.filter((d): d is Device & { id: ReviewDevice } => isReviewDevice(d.id));

/** Segmented control for the viewport prototypes render at. */
export function DevicePicker({
  device,
  onChange,
}: {
  device: ReviewDevice;
  onChange: (device: ReviewDevice) => void;
}) {
  return (
    <div class="segmented" role="group" aria-label="Viewport">
      {PRESETS.map((d) => (
        <button
          type="button"
          key={d.id}
          class={device === d.id ? "active" : ""}
          aria-pressed={device === d.id}
          title={`${d.label}, ${d.width}×${d.height}`}
          onClick={() => onChange(d.id)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
