import { useEffect, useMemo, useRef } from "preact/hooks";
import { parseThemeReady, postTheme, withTheme, type ThemeReady } from "../prototype-theme.ts";
import { Frame } from "./Frame.tsx";

/**
 * A prototype frame that can be themed: it loads with `?theme=` and switches live (keeping the
 * prototype's state) when `theme` changes. `onThemeReady` reports the prototype's themes once its
 * design system runtime loads; prototypes without one never call it.
 */
export function PrototypeFrame({
  src,
  theme,
  revision = 0,
  onThemeReady,
  ...frame
}: {
  src: string;
  /** Theme id, or undefined for the prototype's own default. */
  theme?: string;
  revision?: number;
  onThemeReady?: (ready: ThemeReady) => void;
  title: string;
  width: number;
  height: number;
  scale?: number;
  class?: string;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ theme, onThemeReady });
  latest.current = { theme, onThemeReady };
  // The URL only picks up the theme when the frame (re)loads anyway; changing it otherwise
  // would reload the prototype and lose its state.
  const themedSrc = useMemo(() => withTheme(src, latest.current.theme), [src, revision]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!iframe.current || event.source !== iframe.current.contentWindow) return;
      const ready = parseThemeReady(event.data);
      if (!ready) return;
      // Chosen while the frame was still loading: the URL had the previous theme.
      const wanted = latest.current.theme;
      if (wanted && ready.theme !== wanted && ready.themes.some((t) => t.id === wanted)) {
        postTheme(iframe.current, wanted);
        ready.theme = wanted;
      }
      latest.current.onThemeReady?.(ready);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (theme) postTheme(iframe.current, theme);
  }, [theme]);

  return <Frame {...frame} src={themedSrc} revision={revision} frameRef={iframe} />;
}
