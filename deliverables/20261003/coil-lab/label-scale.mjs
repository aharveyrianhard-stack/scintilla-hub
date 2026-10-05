/* LABEL SCALE (pass 3, 5 Oct 2026 · PASS 4 sizes and hysteresis, 5 Oct afternoon) · one reusable rule for a label in a 3D (or
   zoomable 2D) view — the coil's today, the tree's next (T13). Alan: "they need to tilt with the view change, and smaller, or
   some dynamic zoom on the font as I zoom (you could use that for the tree too)" and, on pass 3: "fonts a little smaller — even on
   the zoom-out the fonts are still big; balance it out". No three.js here: pure functions over numbers, so the tree page (2D canvas)
   and the coil (WebGL) share it.

   THE RULE in one paragraph: a label's type size follows the camera distance — px = base × (home distance ÷ current distance),
   clamped to a floor and a ceiling. Zooming in to half the distance grows the type to the ceiling; zooming out shrinks it to the
   floor. When labels would overlap at that size, they thin out: the strongest readings are placed first and any label whose box
   would touch one already placed is hidden; zooming in spreads the boxes apart and every label comes back. PASS 4 sizes (the V4
   brief): ticker 11 px at home, the value 9 px (9/11 of the ticker), ceiling 16 px, floor 8 px — on 1920 × 1080; they scale with
   the view's height on other screens. Pass 3 had 13 / 24 / 11 (kept below as LABEL_RULE_P3 for the record).
   PASS 4 hysteresis: a label that is shown keeps its place with a small pad; a hidden one needs a bigger clear pad to come back —
   so a label never flickers in and out at the threshold while the camera eases (the Mapbox / deck.gl collision pattern with the
   two-pad hysteresis of a Schmitt trigger).
   Pattern followed: Mapbox / deck.gl's CollisionFilterExtension (priority first, greedy box test) and the min/max clamp of CSS clamp(). */

export const LABEL_RULE = { base_px: 11, value_share: 9 / 11, floor_px: 8, ceil_px: 16, reference_view_h: 1080, pad_px: 2, pad_show_px: 6, min_floor_px: 8 };
export const LABEL_RULE_P3 = { base_px: 13, value_share: 40 / 64, floor_px: 11, ceil_px: 24, reference_view_h: 1080, pad_px: 2, pad_show_px: 2, min_floor_px: 11 };

/* the type size for a label at `distance` from the camera, when `homeDistance` prints `base_px` (both in the same world unit).
   viewH: the view's height in CSS px — the sizes scale with it (1080 → 11 / 8 / 16). */
export function labelPx(distance, homeDistance, viewH = 1080, rule = LABEL_RULE) {
  const k = Math.max(0.25, Math.min(4, viewH / rule.reference_view_h)); // a phone (844 tall) gets 8.6 / 8 / 12.5; a 4K 2160 gets 22 / 16 / 32
  const floor = Math.max(rule.min_floor_px ?? 0, rule.floor_px * k), ceil = Math.max(floor, rule.ceil_px * k); // the floor never goes under min_floor_px (8 in pass 4)
  const raw = rule.base_px * k * (homeDistance / Math.max(1e-6, distance));
  return { px: Math.max(floor, Math.min(ceil, raw)), raw, floor, ceil, at: raw < floor ? "floor" : raw > ceil ? "ceiling" : "free", value_px: Math.max(floor, Math.min(ceil, raw)) * (rule.value_share ?? 1) };
}

/* which labels to show at this zoom. items: [{ id, x, y, w, h, priority }] in screen px (x, y = the box's centre; priority:
   bigger first — the coil passes |reading|). Returns { shown: Set(id), hidden: Set(id) }. Greedy: sort by priority desc, keep a
   label if its box (grown by pad) touches no kept box. O(n²) over at most a few hundred labels — nothing to optimise.
   PASS 4 · hysteresis: with `prevShown` (a Set of the ids shown last frame), a label that was shown is tested with `pad` and a
   label that was hidden with `padShow` (bigger), so the two states need different room and a label cannot flip every frame. */
export function thinLabels(items, pad = LABEL_RULE.pad_px, prevShown = null, padShow = LABEL_RULE.pad_show_px) {
  const kept = [], shown = new Set(), hidden = new Set();
  // pass 4 · stability first: the labels shown last frame are placed first (in priority order), then the hidden ones try to enter with
  // the bigger pad — so a label that is on screen never loses its place to one that is just arriving, and the set only changes when the
  // boxes really meet (zooming out) or really part (zooming in). With no last frame (the first layout) it is pure priority order.
  const was = (it) => (prevShown && prevShown.has(it.id) ? 1 : 0);
  const order = items.slice().sort((a, b) => was(b) - was(a) || (b.priority ?? 0) - (a.priority ?? 0) || String(a.id).localeCompare(String(b.id)));
  for (const it of order) {
    const p = prevShown && !prevShown.has(it.id) ? Math.max(pad, padShow) : pad;
    const x0 = it.x - it.w / 2 - p, x1 = it.x + it.w / 2 + p, y0 = it.y - it.h / 2 - p, y1 = it.y + it.h / 2 + p;
    let free = true;
    for (const k of kept) { if (x0 < k.x1 && x1 > k.x0 && y0 < k.y1 && y1 > k.y0) { free = false; break; } }
    if (free) { kept.push({ x0: it.x - it.w / 2 - pad, x1: it.x + it.w / 2 + pad, y0: it.y - it.h / 2 - pad, y1: it.y + it.h / 2 + pad }); shown.add(it.id); } else hidden.add(it.id);
  }
  return { shown, hidden };
}

/* the world height a sprite needs so that it prints `px` on a perspective camera: px × (2 d tan(fov/2)) / viewH, d = the depth of
   the label from the camera (the camera-space distance along the view axis is the exact one; the straight-line distance is close). */
export function worldHeightForPx(px, depth, fovDeg, viewH) { return (px * 2 * depth * Math.tan((fovDeg * Math.PI) / 360)) / viewH; }

/* the whole rule for a given zoom, as a table the report prints: distance ratios → px */
export function rulePoints(viewH = 1080, rule = LABEL_RULE) { return [0.5, 0.75, 1, 1.5, 2, 3].map((r) => ({ distance: r + "× home", px: +labelPx(r, 1, viewH, rule).px.toFixed(1), value_px: +labelPx(r, 1, viewH, rule).value_px.toFixed(1), at: labelPx(r, 1, viewH, rule).at })); }
