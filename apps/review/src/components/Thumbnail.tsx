import { Frame } from "../../../web/src/components/Frame.tsx";
import { useElementSize, type Device } from "../../../web/src/util.ts";
import { fitScale } from "../layout.ts";

/** A live, non-interactive, scaled-down preview of a page that loads when scrolled into view. */
export function Thumbnail({ src, title, device }: { src: string; title: string; device: Device }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const scale = fitScale(size, device);
  return (
    <div class="thumb" ref={ref}>
      {scale > 0 && (
        <Frame
          src={src}
          title={title}
          width={device.width}
          height={device.height}
          scale={scale}
          interactive={false}
          lazy
        />
      )}
    </div>
  );
}
