/** Largest scale (at most 1) at which a `content`-sized viewport fits in `available`. */
export function fitScale(
  available: { width: number; height: number },
  content: { width: number; height: number },
): number {
  if (content.width <= 0 || content.height <= 0) return 0;
  return Math.max(
    0,
    Math.min(1, available.width / content.width, available.height / content.height),
  );
}

/** Index of the option `delta` steps from `index`, or -1 past either end (no wrapping). */
export function stepIndex(index: number, delta: number, count: number): number {
  const next = index + delta;
  return next >= 0 && next < count ? next : -1;
}

/** Which option a key press asks for: ←/→ step, 1–9 jump. -1 for other keys or out of range. */
export function optionForKey(key: string, index: number, count: number): number {
  if (key === "ArrowRight") return stepIndex(index, 1, count);
  if (key === "ArrowLeft") return stepIndex(index, -1, count);
  if (/^[1-9]$/.test(key)) {
    const target = Number(key) - 1;
    return target < count ? target : -1;
  }
  return -1;
}
