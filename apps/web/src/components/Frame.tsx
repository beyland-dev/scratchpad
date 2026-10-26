/** Untrusted prototype code: scripts allowed, but never same-origin with the app. */
export const SANDBOX_FLAGS = "allow-scripts allow-forms allow-popups allow-modals";

interface FrameProps {
  src: string;
  title: string;
  /** Logical viewport size the prototype renders at. */
  width: number;
  height: number;
  /** Visual scale applied to fit the available space. */
  scale?: number;
  /** Changing this remounts the iframe (live reload). */
  revision?: number;
  interactive?: boolean;
  lazy?: boolean;
  class?: string;
}

export function Frame({
  src,
  title,
  width,
  height,
  scale = 1,
  revision = 0,
  interactive = true,
  lazy,
  class: className,
}: FrameProps) {
  const outer = {
    width: `${Math.round(width * scale)}px`,
    height: `${Math.round(height * scale)}px`,
  };
  const inner = {
    width: `${width}px`,
    height: `${height}px`,
    transform: scale === 1 ? undefined : `scale(${scale})`,
    pointerEvents: interactive ? "auto" : "none",
  };
  return (
    <div class={`frame ${className ?? ""}`} style={outer}>
      <iframe
        key={`${src}#${revision}`}
        src={src}
        title={title}
        sandbox={SANDBOX_FLAGS}
        referrerpolicy="no-referrer"
        loading={lazy ? "lazy" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-hidden={interactive ? undefined : true}
        style={inner}
      />
    </div>
  );
}
