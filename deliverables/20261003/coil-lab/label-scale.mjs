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

/* PASS 6 (6 Oct 2026) · THE FRONT ROW. Alan: "labels sometimes appear and sometimes disappear at some angles … at least the ones in
   the frontal row have to appear." Pass 4/5 gave the room to the strongest reading first, so a near bar lost its ticker to a strong
   one standing behind it. The rule now, in three steps:
     1 FRONT ROW  the bars that stand nearest the camera (by where each bar meets the zero plane — the near edge of the coil): the nearest `share` of the set (never fewer than `min`). They ALWAYS
                  carry their ticker. Two of them that would print on each other do not hide: the farther one slides outward along
                  its own bar, one label height at a time (up to `slots`), and stays in that slot while it is free.
     2 THE REST   as before: shown ones keep their place (pad), hidden ones need more room to come back (padShow), strongest first —
                  but never on top of a front-row label.
     3 NO FLICKER two Schmitt triggers and a dwell: a bar joins the front row at rank ≤ n and leaves only past 1.5 n; and nothing —
                  membership, shown / hidden, the slot — may change twice within `dwell_ms`. So a label cannot blink as the coil turns.
   Pure: the caller keeps `st` (makeFrontState()) between frames and passes the clock. Pattern: the collision pass of Mapbox GL /
   deck.gl (priority order, greedy box test) with their symbol fade hold — a placed symbol stays placed for the fade duration. */
export const FRONT_RULE = { share: 0.2, min: 8, leave_over: 1.5, slots: 6, dwell_ms: 500, pad_px: 4, pad_show_px: 10, slot_gap_px: 2 };
export const makeFrontState = () => ({ first: true, front: new Set(), shown: new Set(), slot: new Map(), at: new Map() });
/* items: [{ id, x, y, w, h, priority, depth, ux, uy }] — x, y the label's centre in screen px with no slide; depth = the distance from the camera, along the view,
   of the bar's foot on the zero plane; (ux, uy) the unit screen direction from the bar's tip to its label (the way a slide goes).
   pinned: an id that must show whatever happens (the hovered bar). Returns { shown:Set, front:Set, slot:Map(id → n), overlaps, held }. */
export function layoutFront(items, st, now, rule = FRONT_RULE, pinned = null) {
  const n = items.length, nIn = Math.min(n, Math.max(rule.min, Math.ceil(n * rule.share))), nOut = Math.ceil(nIn * rule.leave_over);
  const free = (id) => st.first || now - (st.at.get(id) ?? -1e12) >= rule.dwell_ms; // may this label change state now?
  let held = false;
  const byDepth = items.slice().sort((a, b) => a.depth - b.depth || String(a.id).localeCompare(String(b.id)));
  const front = new Set();
  byDepth.forEach((it, rank) => { const was = st.front.has(it.id), want = it.id === pinned || (was ? rank < nOut : rank < nIn);
    if (want !== was && !free(it.id) && it.id !== pinned) { held = true; if (was) front.add(it.id); return; }
    if (want) front.add(it.id); });
  const kept = [], shown = new Set(), slot = new Map(); let overlaps = 0;
  const boxAt = (it, k, p) => { const dx = it.ux * k * (it.h + rule.slot_gap_px), dy = it.uy * k * (it.h + rule.slot_gap_px); return { x0: it.x + dx - it.w / 2 - p, x1: it.x + dx + it.w / 2 + p, y0: it.y + dy - it.h / 2 - p, y1: it.y + dy + it.h / 2 + p }; };
  const hits = (b) => { for (const k of kept) if (b.x0 < k.x1 && b.x1 > k.x0 && b.y0 < k.y1 && b.y1 > k.y0) return true; return false; };
  // 1 · the front row, nearest first (the pinned one before all): its own slot if still free, else the first free one, else slot 0 anyway
  for (const it of byDepth.filter((x) => front.has(x.id)).sort((a, b) => (b.id === pinned) - (a.id === pinned))) {
    const prev = st.slot.get(it.id) ?? 0; let k = -1;
    if (!hits(boxAt(it, prev, 0))) k = prev; else if (!free(it.id)) { k = prev; held = true; overlaps++; }
    else { for (let j = 0; j <= rule.slots; j++) if (!hits(boxAt(it, j, 0))) { k = j; break; } if (k < 0) { k = 0; overlaps++; } }
    slot.set(it.id, k); shown.add(it.id); kept.push(boxAt(it, k, rule.pad_px));
  }
  // 2 · the rest: the ones on screen first, then the strongest
  const was = (it) => (st.shown.has(it.id) ? 1 : 0);
  for (const it of items.filter((x) => !front.has(x.id)).sort((a, b) => was(b) - was(a) || (b.priority ?? 0) - (a.priority ?? 0) || String(a.id).localeCompare(String(b.id)))) {
    const w = st.shown.has(it.id), clear = !hits(boxAt(it, 0, st.first || w ? rule.pad_px : rule.pad_show_px)); let vis = clear;
    if (vis !== w && !free(it.id)) { vis = w; held = true; }
    if (vis) { shown.add(it.id); kept.push(boxAt(it, 0, rule.pad_px)); slot.set(it.id, 0); }
  }
  // the clock of the last change (shown / hidden, the slot, the membership), then the state for the next frame
  for (const it of items) { const id = it.id; if (!st.first && (shown.has(id) !== st.shown.has(id) || front.has(id) !== st.front.has(id) || (shown.has(id) && (slot.get(id) ?? 0) !== (st.slot.get(id) ?? 0)))) st.at.set(id, now); }
  st.front = front; st.shown = shown; st.slot = slot; st.first = false;
  return { shown, front, slot, overlaps, held, n_front: front.size, n_in: nIn, n_out: nOut };
}
