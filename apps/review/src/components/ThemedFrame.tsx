import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { Frame } from "../../../web/src/components/Frame.tsx";
import {
  parseThemeReady,
  postTheme,
  withTheme,
  type ThemeReady,
} from "../../../web/src/prototype-theme.ts";

/**
 * apps/web's PrototypeFrame, but listening for "dt-theme-ready" from the same commit that inserts
 * the iframe: static prototypes can load and announce their themes before a regular effect runs.
 */
export function ThemedFrame({
  src,
  theme,
  onThemeReady,
  ...frame
}: {
  /** Absolute URL of the page. */
  src: string;
  /** Theme id, or undefined for the prototype's own default. */
  theme?: string;
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
  // Only a (re)load picks up the URL's theme; changing it otherwise would reload the prototype.
  const themedSrc = useMemo(() => withTheme(src, latest.current.theme), [src]);

  useLayoutEffect(() => {
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

  return <Frame {...frame} src={themedSrc} frameRef={iframe} />;
}
