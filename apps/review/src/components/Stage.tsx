import { ThemedFrame } from "./ThemedFrame.tsx";
import type { ThemeReady } from "../../../web/src/prototype-theme.ts";
import { useElementSize, type Device } from "../../../web/src/util.ts";
import { fitScale } from "../layout.ts";

/** A prototype at a device's viewport, scaled down to fit the space it's given. */
export function Stage({
  src,
  title,
  device,
  theme,
  onThemeReady,
}: {
  /** Absolute URL of the page to show. */
  src: string;
  title: string;
  device: Device;
  theme?: string;
  onThemeReady?: (ready: ThemeReady) => void;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const padding = size.width < 600 ? 12 : 24;
  const scale = fitScale(
    { width: size.width - padding * 2, height: size.height - padding * 2 },
    device,
  );
  return (
    <div class="stage" ref={ref}>
      {scale > 0 && (
        <ThemedFrame
          src={src}
          theme={theme}
          onThemeReady={onThemeReady}
          title={title}
          width={device.width}
          height={device.height}
          scale={scale}
          class="framed"
        />
      )}
      {scale > 0 && scale < 1 && (
        <span class="scale-note" title="Scaled to fit">
          {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
