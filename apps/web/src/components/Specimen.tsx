import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { systemRevisionOf, workspace } from "../store.ts";
import { Icon } from "./Icon.tsx";
import { SANDBOX_FLAGS } from "./Frame.tsx";

interface SpecimenProps {
  system: string;
  component?: string;
  example?: number;
  html?: string;
  theme?: string;
  /** Render without the specimen padding (as captured). */
  bare?: boolean;
  /** Fill the parent's height (painted with the specimen's background) instead of sizing to content. */
  fill?: boolean;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  title?: string;
  /** Set to false for decorative previews: removes the frame from the tab order and accessibility tree. */
  interactive?: boolean;
}

let counter = 0;

/** The element that scrolls `el` (its nearest scrollable ancestor, else the page). */
function scrollerOf(el: HTMLElement | null): Element | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight)
      return node;
  }
  return document.scrollingElement;
}

/** A component example rendered in its required context, on the sandbox origin, sized to its content. */
export function Specimen({
  system,
  component,
  example = 0,
  html,
  theme,
  bare,
  fill,
  width,
  minHeight = 48,
  maxHeight = 900,
  title,
  interactive = true,
}: SpecimenProps) {
  const frame = useMemo(() => `s${++counter}`, []);
  const [height, setHeight] = useState(minHeight);
  const iframe = useRef<HTMLIFrameElement>(null);
  // Content that opened above the frame's top (an upward menu) was shifted down inside it by this
  // much as the frame grew. Scrolling the page by the same amount keeps the example where it was.
  const shift = useRef(0);
  useLayoutEffect(() => {
    if (!shift.current) return;
    scrollerOf(iframe.current)?.scrollBy(0, shift.current);
    shift.current = 0;
  });
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        frame?: string;
        height?: number;
        shift?: number;
      } | null;
      if (
        data?.type === "dt-specimen-size" &&
        data.frame === frame &&
        typeof data.height === "number"
      ) {
        if (typeof data.shift === "number" && data.shift > 0) shift.current += data.shift;
        setHeight(Math.max(minHeight, Math.min(maxHeight, data.height)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, minHeight, maxHeight]);

  const sandbox = workspace.value?.urls.sandbox;
  if (!sandbox) return null;
  const params = new URLSearchParams({ frame });
  if (component) params.set("component", component);
  if (html !== undefined) params.set("html", html);
  params.set("example", String(example));
  if (theme) params.set("theme", theme);
  if (bare) params.set("bare", "");
  else if (fill) params.set("fill", "");
  else params.set("maxh", String(maxHeight));
  if (width) params.set("width", String(width));
  const src = `${sandbox}/s/${encodeURIComponent(system)}/specimen.html?${params.toString()}`;
  return (
    <iframe
      key={`${src}#${systemRevisionOf(system)}`}
      ref={iframe}
      class="specimen"
      src={src}
      title={title ?? component ?? "specimen"}
      sandbox={SANDBOX_FLAGS}
      loading="lazy"
      tabIndex={interactive ? undefined : -1}
      aria-hidden={interactive ? undefined : true}
      style={{
        height: fill ? "100%" : `${height}px`,
        // `width` lays the example out at that width; only bare renders (as captured) shrink the frame.
        width: width && bare ? `${width}px` : "100%",
        pointerEvents: interactive ? undefined : "none",
      }}
    />
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const label = status === "verified" ? "Verified" : status === "drift" ? "Drift" : "Unverified";
  return (
    <span
      class={`badge verify-${status}`}
      title={
        status === "verified"
          ? "Matches the captured product"
          : status === "drift"
            ? "Differs from the captured product"
            : "Not compared with a capture yet"
      }
    >
      {status === "verified" && <Icon name="check" size={12} />}
      {status === "drift" && <Icon name="alert" size={12} />}
      {label}
    </span>
  );
}
