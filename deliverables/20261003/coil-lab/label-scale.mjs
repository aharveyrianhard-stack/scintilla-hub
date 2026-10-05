/* LABEL SCALE (pass 3, 5 Oct 2026) · one reusable rule for a label in a 3D (or zoomable 2D) view — the coil's today, the tree's
   next. Alan: "they need to tilt with the view change, and smaller, or some dynamic zoom on the font as I zoom (you could use that
   for the tree too)". No three.js here: pure functions over numbers, so the tree page (2D canvas) and the coil (WebGL) share it.

   THE RULE in one paragraph: a label's type size follows the camera distance — px = base × (home distance ÷ current distance),
   clamped to a floor and a ceiling. Zooming in to half the distance doubles the type (until the ceiling); zooming out halves it
   (until the floor). When labels would overlap at that size, they thin out: the strongest readings are placed first and any label
   whose box would touch one already placed is hidden; zooming in spreads the boxes apart and every label comes back. The sizes:
   base 13 px, floor 11 px (the Hub's smallest body text), ceiling 24 px — on 1920 × 1080; they scale with the view's height on
   other screens (13 px is 1.2 % of 1080). Pattern followed: the collision rule of Mapbox / deck.gl's CollisionFilterExtension
   (priority first, greedy box test) and the min/max font clamp of CSS clamp(). */

export const LABEL_RULE = { base_px: 13, floor_px: 11, ceil_px: 24, reference_view_h: 1080, pad_px: 2 };

/* the type size for a label at `distance` from the camera, when `homeDistance` prints `base_px` (both in the same world unit).
   viewH: the view's height in CSS px — the sizes scale with it (1080 → 13 / 11 / 24). */
export function labelPx(distance, homeDistance, viewH = 1080, rule = LABEL_RULE) {
  const k = Math.max(0.25, Math.min(4, viewH / rule.reference_view_h)); // a phone (844 tall) gets 10.2 / 8.6 / 18.8; a 4K 2160 gets 26 / 22 / 48
  const floor = Math.max(11, rule.floor_px * k), ceil = Math.max(floor, rule.ceil_px * k); // the floor never goes under 11 px — the Hub's smallest body text (BRIEF-20260923-COMMON)
  const raw = rule.base_px * k * (homeDistance / Math.max(1e-6, distance));
  return { px: Math.max(floor, Math.min(ceil, raw)), raw, floor, ceil, at: raw < floor ? "floor" : raw > ceil ? "ceiling" : "free" };
}

/* which labels to show at this zoom. items: [{ id, x, y, w, h, priority }] in screen px (x, y = the box's centre; priority:
   bigger first — the coil passes |reading|). Returns { shown: Set(id), hidden: Set(id) }. Greedy: sort by priority desc, keep a
   label if its box (grown by pad) touches no kept box. O(n²) over at most a few hundred labels — nothing to optimise. */
export function thinLabels(items, pad = LABEL_RULE.pad_px) {
  const kept = [], shown = new Set(), hidden = new Set();
  const order = items.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || String(a.id).localeCompare(String(b.id)));
  for (const it of order) {
    const x0 = it.x - it.w / 2 - pad, x1 = it.x + it.w / 2 + pad, y0 = it.y - it.h / 2 - pad, y1 = it.y + it.h / 2 + pad;
    let free = true;
    for (const k of kept) { if (x0 < k.x1 && x1 > k.x0 && y0 < k.y1 && y1 > k.y0) { free = false; break; } }
    if (free) { kept.push({ x0, x1, y0, y1 }); shown.add(it.id); } else hidden.add(it.id);
  }
  return { shown, hidden };
}

/* the world height a sprite needs so that it prints `px` on a perspective camera: px × (2 d tan(fov/2)) / viewH, d = the depth of
   the label from the camera (the camera-space distance along the view axis is the exact one; the straight-line distance is close). */
export function worldHeightForPx(px, depth, fovDeg, viewH) { return (px * 2 * depth * Math.tan((fovDeg * Math.PI) / 360)) / viewH; }

/* the whole rule for a given zoom, as a table the report prints: distance ratios → px */
export function rulePoints(viewH = 1080, rule = LABEL_RULE) { return [0.5, 0.75, 1, 1.5, 2, 3].map((r) => ({ distance: r + "× home", px: +labelPx(r, 1, viewH, rule).px.toFixed(1), at: labelPx(r, 1, viewH, rule).at })); }
