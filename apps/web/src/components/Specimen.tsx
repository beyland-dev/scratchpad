import { useEffect, useMemo, useState } from "preact/hooks";
import { systemRevisionOf, workspace } from "../store.ts";
import { SANDBOX_FLAGS } from "./Frame.tsx";

interface SpecimenProps {
  system: string;
  component?: string;
  example?: number;
  html?: string;
  theme?: string;
  /** Render without the specimen padding (as captured). */
  bare?: boolean;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  title?: string;
}

let counter = 0;

/** A component example rendered in its required context, on the sandbox origin, sized to its content. */
export function Specimen({
  system,
  component,
  example = 0,
  html,
  theme,
  bare,
  width,
  minHeight = 48,
  maxHeight = 900,
  title,
}: SpecimenProps) {
  const frame = useMemo(() => `s${++counter}`, []);
  const [height, setHeight] = useState(minHeight);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; frame?: string; height?: number } | null;
      if (
        data?.type === "dt-specimen-size" &&
        data.frame === frame &&
        typeof data.height === "number"
      ) {
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
  if (width) params.set("width", String(width));
  const src = `${sandbox}/s/${encodeURIComponent(system)}/specimen.html?${params.toString()}`;
  return (
    <iframe
      key={`${src}#${systemRevisionOf(system)}`}
      class="specimen"
      src={src}
      title={title ?? component ?? "specimen"}
      sandbox={SANDBOX_FLAGS}
      loading="lazy"
      style={{ height: `${height}px`, width: width ? `${width}px` : "100%" }}
    />
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const label =
    status === "verified" ? "✓ verified" : status === "drift" ? "≠ drift" : "unverified";
  return <span class={`badge verify-${status}`}>{label}</span>;
}
