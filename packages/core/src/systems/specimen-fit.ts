/**
 * Browser code shared by both specimen pages (captured systems' specimen.html and package systems'
 * specimen app), as source text to inline. It runs only when the specimen is embedded in the app:
 * as a fixed-size card preview (`?fill`) or an auto-height example on a detail page (`?frame`).
 * Bare and standalone specimens (verification, screenshots, agent URLs) keep their exact layout.
 *
 * `dtFit({ root, mode, frame, maxHeight })` makes any example look right in its frame:
 * - Measures the example's visible extent: every painted descendant, including absolutely or
 *   fixed positioned parts and portals, clipped only by the example's own containers.
 * - Scaffolding doesn't count: wrappers the specimen page inserted (marked `data-dt-context`) and
 *   the elements they render around the example (ancestors of its top-level elements, marked
 *   `data-dt-example`). Inserted wrappers, and scaffolding with no size of its own, don't clip.
 * - Scales the extent down (never up) to fit, and centers it: both ways in cards (very tall
 *   examples are shown from the top instead of shrinking past half size), horizontally on detail
 *   pages, whose frame height follows the content.
 * - On detail pages, the layout freezes once someone interacts (or after 3s), so content never
 *   jumps under the pointer; the frame only grows, e.g. while a menu is open.
 */
export const SPECIMEN_FIT_SCRIPT = String.raw`
function dtFit({ root, mode, frame, maxHeight }) {
  const PAD = 16;
  const INF = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
  const html = document.documentElement;
  html.style.overflow = "hidden";
  root.style.transformOrigin = "0 0";
  let locked = false;
  let base = 0;
  let reported = -1;
  // Elements whose style fit() changes; their style mutations don't trigger a refit.
  const touched = new WeakSet([root]);
  const report = (height) => {
    if (mode !== "frame" || !frame || parent === window || height === reported) return;
    reported = height;
    parent.postMessage({ type: "dt-specimen-size", frame, height }, "*");
  };

  const intersect = (a, b) => {
    const r = { l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) };
    return r.r > r.l && r.b > r.t ? r : null;
  };
  const union = (a, b) =>
    a ? { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) } : b;
  const INK = new Set(["img", "svg", "canvas", "video", "iframe", "input", "textarea", "select", "button", "hr"]);
  const clear = (color) => color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color);
  // Whether an element's own box shows: layout-only wrappers (a full-width flex row) don't.
  const paints = (el, cs) =>
    INK.has(el.localName) ||
    !clear(cs.backgroundColor) ||
    cs.backgroundImage !== "none" ||
    cs.boxShadow !== "none" ||
    (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
    ["Top", "Right", "Bottom", "Left"].some(
      (side) => cs["border" + side + "Style"] !== "none" && parseFloat(cs["border" + side + "Width"]) > 0,
    );
  const range = document.createRange();
  const scaffolding = () => {
    const set = new Set(document.querySelectorAll("[data-dt-context]"));
    for (const example of document.querySelectorAll("[data-dt-example]"))
      for (let el = example.parentElement; el && el !== document.body; el = el.parentElement) set.add(el);
    return set;
  };
  // Union of what's painted under the body, in viewport coordinates: boxes that show, and text by
  // its own bounds. "ink" is the part with content (text, images, icons, controls), used to aim the
  // crop of examples too tall for a card.
  const extent = () => {
    let box = null;
    let ink = null;
    const chrome = scaffolding();
    const add = (rect, clip, inked) => {
      const r = intersect({ l: rect.left, t: rect.top, r: rect.right, b: rect.bottom }, clip);
      if (!r) return;
      box = union(box, r);
      if (inked) ink = union(ink, r);
    };
    const walk = (el, clip) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === "none" || cs.opacity === "0") continue;
        const context = chrome.has(child);
        const rect = child.getBoundingClientRect();
        // Visually hidden helpers (screen-reader text, live regions parked off-screen) aren't seen.
        if (rect.right < -1000 || rect.bottom < -1000 || (cs.position !== "static" && rect.width <= 1 && rect.height <= 1) || cs.clip.startsWith("rect(")) continue;
        let next = cs.position === "fixed" ? INF : clip;
        const shown = !context && cs.visibility !== "hidden";
        // Icon fonts and decorations draw through ::before/::after content.
        const generated = ["::before", "::after"].some((p) => {
          const content = getComputedStyle(child, p).content;
          return content !== "none" && content !== "normal" && content !== '""';
        });
        if (shown && rect.width > 0 && rect.height > 0 && (generated || paints(child, cs)))
          add(rect, next, generated || INK.has(child.localName) || cs.backgroundImage !== "none");
        if (child instanceof SVGElement) continue;
        if (!child.hasAttribute("data-dt-context")) {
          if (cs.overflowX !== "visible") next = { ...next, l: Math.max(next.l, rect.left), r: Math.min(next.r, rect.right) };
          if (cs.overflowY !== "visible") next = { ...next, t: Math.max(next.t, rect.top), b: Math.min(next.b, rect.bottom) };
        }
        if (shown)
          for (const node of child.childNodes) {
            if (node.nodeType !== 3 || !node.textContent.trim()) continue;
            range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            if (text.width > 0 && text.height > 0) add(text, next, true);
          }
        walk(child, next);
      }
    };
    walk(document.body, INF);
    return box && { ...box, ink };
  };

  const fit = () => {
    // An identity transform keeps the root the containing block for fixed parts while measuring.
    root.style.transform = "translate(0px, 0px)";
    // Inserted contexts never clip (their background is painted on the page), and nor does other
    // scaffolding with no size of its own along an axis (a context nothing gave a size), which would
    // hide the example entirely. Real containers keep their clipping (lists, split views). Both
    // axes: one visible axis next to a clipping one computes to auto, which still clips.
    for (const el of scaffolding()) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const rect = el.getBoundingClientRect();
      if (el.hasAttribute("data-dt-context") || rect.width < 1 || rect.height < 1) {
        touched.add(el);
        el.style.overflow = "visible";
      }
    }
    const origin = root.getBoundingClientRect();
    // Nothing measurable (an empty example): center the root's own box.
    const e = extent() ?? { l: origin.left, t: origin.top, r: origin.right, b: origin.bottom, ink: null };
    if (e.r - e.l < 1 || e.b - e.t < 1) {
      base = Math.ceil(origin.height);
      report(base);
      return;
    }
    const x = e.l - origin.left;
    const y = e.t - origin.top;
    const w = e.r - e.l;
    const h = e.b - e.t;
    const W = innerWidth;
    const H = innerHeight;
    const fitW = Math.min(1, (W - 2 * PAD) / w);
    let s;
    let ty;
    if (mode === "fill") {
      const availH = H - 2 * PAD;
      s = Math.min(fitW, Math.max(availH / h, fitW * 0.5));
      if (s > 0.97) s = 1;
      if (s * h <= availH) ty = (H - s * h) / 2 - s * y;
      else {
        // Too tall even at half size: show the part with content, centered if it fits, else its
        // top, without revealing space beyond the example's edges.
        const ink = e.ink ?? e;
        const iy = ink.t - origin.top;
        const ih = ink.b - ink.t;
        ty = s * ih <= availH ? (H - s * ih) / 2 - s * iy : PAD - s * iy;
        ty = Math.min(PAD - s * y, Math.max(H - PAD - s * (y + h), ty));
      }
    } else {
      s = Math.min(fitW, (maxHeight - 2 * PAD) / h);
      if (s > 0.97) s = 1;
      ty = PAD - s * y;
    }
    const tx = (W - s * w) / 2 - s * x;
    root.style.transform = "translate(" + Math.round(tx) + "px, " + Math.round(ty) + "px) scale(" + s + ")";
    base = Math.ceil(s * h + 2 * PAD);
    report(base);
  };

  // After the layout freezes, only grow the frame to keep new content (open menus) in view.
  const grow = () => {
    const e = extent();
    report(e ? Math.max(base, Math.ceil(e.b + PAD)) : base);
  };

  let queued = false;
  const update = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (locked) grow();
      else fit();
    });
  };
  const lock = () => {
    if (mode === "frame") locked = true;
  };
  fit();
  requestAnimationFrame(update);
  document.fonts?.ready.then(update);
  addEventListener("load", update);
  // Detail frames change height when they report it, so only a new width means a new layout.
  let width = innerWidth;
  addEventListener("resize", () => {
    if (mode === "frame" && innerWidth === width) return;
    width = innerWidth;
    locked = false;
    update();
  });
  for (const type of ["pointerdown", "keydown", "focusin"]) addEventListener(type, lock, true);
  for (const type of ["transitionend", "animationend"]) addEventListener(type, update, true);
  const mutations = new MutationObserver((records) => {
    // Ignore style changes made by fit itself.
    if (records.some((r) => !(r.attributeName === "style" && touched.has(r.target)))) update();
  });
  mutations.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  new ResizeObserver(update).observe(root);
  // Cards are static once settled; detail examples keep growing for interactions.
  setTimeout(() => {
    if (mode === "fill") mutations.disconnect();
    else lock();
  }, 3000);
}
`;
