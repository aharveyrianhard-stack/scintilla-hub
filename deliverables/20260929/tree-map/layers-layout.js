/* TREE MAP · LAYERS (30 Sep) — the flat map's arithmetic, one small module the page and the tests both import.

   The broad levels as nested regions: level 1 THE MARKET → level 2 the asset classes and regions (the market's children)
   → level 3 the sectors and sub-regions (deeper headings; the US SECTORS heading is folded away so the eleven sectors sit
   straight inside US STOCKS) → level 4 the cohorts (all four kinds) and the funds. A fund that parents cohorts is a region
   of its own at level 4 with its cohorts inside it (level 4 too: a cohort is never deeper than 4 on this map).

   layoutLayers(nodes, W, H) → { rects: Map(id → {x, y, w, h, level, kind, ckind, parent}), order: [ids painted back to front] }
   Areas: a heading's area is the sum of its children's; a cohort's area grows with its member count; a fund is one unit.
   Squarified treemap (Bruls, Huizing, van Wijk 2000) inside each region, after a title strip and padding.
   levelOf(id) → 1…4; visibleAt(level, rect) → whether a rect is drawn when the page shows depth `level`.
   labelAnchor(rect) → where the label is printed: ON the node — a heading's title strip top-left, a leaf's centre. */

export const PAD = 6, TITLE = 16, MIN_SIDE = 4;

function squarify(items, x, y, w, h, out) {
  // items: [{id, area}] with areas already scaled to w*h; lays them in rows, the worst aspect ratio kept as small as possible
  const list = items.filter((i) => i.area > 0).sort((a, b) => b.area - a.area);
  let rx = x, ry = y, rw = w, rh = h, row = [], i = 0;
  const worst = (r, len) => { const s = r.reduce((a, b) => a + b.area, 0), mx = Math.max(...r.map((i) => i.area)), mn = Math.min(...r.map((i) => i.area)); return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn)); };
  const layRow = (r) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rw >= rh) { const cw = s / rh; let cy = ry; for (const it of r) { const ch = it.area / cw; out.set(it.id, { x: rx, y: cy, w: cw, h: ch }); cy += ch; } rx += cw; rw -= cw; }
    else { const ch = s / rw; let cx = rx; for (const it of r) { const cw = it.area / ch; out.set(it.id, { x: cx, y: ry, w: cw, h: ch }); cx += cw; } ry += ch; rh -= ch; }
  };
  while (i < list.length) {
    const len = Math.min(rw, rh);
    if (len <= 0) { for (; i < list.length; i++) out.set(list[i].id, { x: rx, y: ry, w: 0, h: 0 }); break; }
    const it = list[i];
    if (!row.length || worst(row.concat(it), len) <= worst(row, len)) { row.push(it); i++; }
    else { layRow(row); row = []; }
  }
  if (row.length) layRow(row);
}

export function layoutLayers(nodes, W, H) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kidsOf = new Map();
  for (const n of nodes) { const p = n.parents[0]; if (!p) continue; if (!kidsOf.has(p)) kidsOf.set(p, []); kidsOf.get(p).push(n); }
  // the map's children of a heading: its sub-headings (US SECTORS folded away), its cohorts, its funds
  const mapKids = (id) => {
    const out = [];
    for (const c of kidsOf.get(id) || []) {
      if (c.kind === "name") continue;
      if (c.kind === "index" && c.id === "US_SECTORS") out.push(...mapKids(c.id)); else out.push(c);
    }
    return out;
  };
  const isRegion = (n) => n.kind === "index" || (n.kind === "fund" && (kidsOf.get(n.id) || []).some((c) => c.kind === "cohort"));
  const area = (n) => {
    if (n.kind === "cohort") return 3 + (n.members.length + (n.member_funds || []).length) * 1.6;
    if (n.kind === "fund") return isRegion(n) ? mapKids(n.id).reduce((s, c) => s + area(c), 0) + 4 : 1.2;
    return mapKids(n.id).reduce((s, c) => s + area(c), 0) + 2;
  };
  const rects = new Map(), order = [];
  const place = (n, x, y, w, h, level, parent) => {
    rects.set(n.id, { x, y, w, h, level, kind: n.kind, ckind: n.ckind || null, parent, region: isRegion(n) });
    order.push(n.id);
    if (!isRegion(n)) return;
    const ch = mapKids(n.id); if (!ch.length) return;
    const ix = x + PAD, iy = y + TITLE + PAD, iw = Math.max(0, w - 2 * PAD), ih = Math.max(0, h - TITLE - 2 * PAD);
    if (iw < MIN_SIDE || ih < MIN_SIDE) { for (const c of ch) place(c, ix, iy, 0, 0, Math.min(4, level + 1), n.id); return; }
    const tot = ch.reduce((s, c) => s + area(c), 0), scale = (iw * ih) / tot;
    const laid = new Map();
    squarify(ch.map((c) => ({ id: c.id, area: area(c) * scale })), ix, iy, iw, ih, laid);
    for (const c of ch) { const r = laid.get(c.id) || { x: ix, y: iy, w: 0, h: 0 }; place(c, r.x, r.y, r.w, r.h, c.kind === "index" ? Math.min(4, level + 1) : 4, n.id); }
  };
  const root = nodes.find((n) => n.kind === "index" && !n.parents.length);
  place(root, 0, 0, W, H, 1, null);
  return { rects, order };
}

export const levelOf = (rects, id) => (rects.get(id) || {}).level || 0;
export const visibleAt = (level, rect) => rect.level <= level;
// the label sits ON the node: a region prints its title in its top strip, a leaf prints its name in its middle
export function labelAnchor(rect) {
  return rect.region ? { x: rect.x + PAD, y: rect.y + TITLE / 2, align: "left" } : { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, align: "center" };
}
// the leaf and region sizes a level shows: the deepest rects drawn at this level (regions deeper are painted as their parent)
export function drawnAt(level, rects) { return [...rects].filter(([, r]) => r.level <= level); }
