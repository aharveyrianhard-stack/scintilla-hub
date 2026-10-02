/* MARKET-MAP r3 · the tree layout — one small module the page and the tests both import, so the picture the tests check is
   the picture on the screen. Pure arithmetic from the node list: no simulation, no randomness, the same map every time.

   A top-down tree. x comes from the tree: every heading gets the width its funds, names and sub-headings need (its own
   funds and names on the left, its sub-headings to the right). y is the level: THE MARKET at the top, one LEVEL lower per
   step down the tree. A heading's funds sit in a block one level below it, its names in a block under the funds. A block
   is ONE row when its lines fit, and more rows only when there are many (columns = √count, 3 to 9). In 3D the extra rows
   step toward you (z) — so the upper tree is flat and the tree becomes 3D lower down, only where the count needs it; in
   FLAT 2D (k = 0) the same rows step down instead.

   Wrapping (28 Sep review: the one-row tree was a thin wide band using ~30% of the canvas height): a heading with many
   sub-headings (8 or more: only US SECTORS, 11) can lay them in `rows` rows instead of one, each row centred, each lower row below the
   deepest block of the row above. The page picks the row count whose whole-tree shape best matches the canvas
   (bestRows) — 2 rows on a 1680 screen, more on a phone. The later rows hang from rails: one horizontal rail above each later row, reached by a line
   down a gap in the row above (the gap nearest the heading's centre), and a short drop from the rail to each sub-heading.

   Order (2 Oct, T5): inside every parent the children run green → red by their reading (the highest first, ties by name,
   no reading last) — sub-headings, funds and names alike. {order: "size"} keeps the old order: sub-headings as listed,
   funds by role and issuer, names by market value. A node's reading is its `v` (own Geiger, else its aggregate; null = none).

   Spacing (2 Oct, T6): {sp} sets how far apart the lines of a leaf block sit (default LAYOUT.SP = 22). CLEAN passes a
   wider value so every box has room for a Geiger bar that reads at the zoom-out; DETAILED keeps the default.

   prepareTree(nodes, {rows, order, sp}) — nodes: [{id, kind, parents, role, issuer, market_value_usd, ticker, v, name}];
                        adds to every heading: subs, rows, funds, names, cols, leafW, sp, depth, w, x0, cx, bx0. Returns the headings.
   layout(heads, k, into) — calls into(node, x, y, z) once for every node; sets rowOf on wrapped sub-headings.
   bestRows(nodes, aspect) — the row count (1…4) whose 3D whole-tree box is closest in shape to the canvas (width/height). */
export { byReading };
export const LAYOUT = { SP: 22, GAP: 26, LEVEL: 120, DZ3: 28, DY3: 6, ROW2: 36, NAMES_DROP: 70, ROWGAP: 110, WRAP_MIN: 8, ZPROJ: 0.9 };
const ISSUER_ORDER = { "State Street SPDR": 0, iShares: 1, Vanguard: 2, "Invesco (equal weight)": 3 };
export const colsFor = (n) => (n <= 3 ? n : Math.min(9, Math.max(3, Math.ceil(Math.sqrt(n)))));

// split a row of widths into `rows` contiguous rows, the widest row as narrow as it can be (order kept)
function splitRows(list, widths, rows, gap) {
  rows = Math.max(1, Math.min(rows, list.length));
  const fits = (cap) => { let n = 1, cur = 0; for (const w of widths) { const add = cur ? gap + w : w; if (cur && cur + add > cap) { n++; cur = w; } else cur += add; } return n <= rows; };
  let lo = Math.max(...widths), hi = widths.reduce((a, b) => a + b, 0) + gap * widths.length;
  while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  const out = [[]]; let cur = 0;
  list.forEach((c, i) => { const add = cur ? gap + widths[i] : widths[i]; if (cur && cur + add > hi) { out.push([c]); cur = widths[i]; } else { out[out.length - 1].push(c); cur += add; } });
  return out;
}
const rowW = (row, gap) => row.reduce((s, c) => s + c.w, 0) + gap * Math.max(0, row.length - 1);

const byReading = (a, b) => { const av = Number.isFinite(a.v) ? a.v : null, bv = Number.isFinite(b.v) ? b.v : null;
  if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1; if (bv !== av) return bv - av;
  const an = a.ticker || a.name || a.id, bn = b.ticker || b.name || b.id; return an < bn ? -1 : an > bn ? 1 : 0; };
export function prepareTree(nodes, opts = {}) {
  const wrap = Math.max(1, Math.min(4, opts.rows || 1));
  const bySize = opts.order === "size";
  const byId = new Map(nodes.map((n) => [n.id, n])), order = new Map(nodes.map((n, i) => [n.id, i]));
  const primary = new Map();
  for (const n of nodes) if (n.parents.length) { const p = n.parents[0]; if (!primary.has(p)) primary.set(p, []); primary.get(p).push(n); }
  const depthOf = (n) => { let d = 0, c = n; while (c.parents.length) { c = byId.get(c.parents[0]); d++; } return d; };
  const { GAP } = LAYOUT, SP = opts.sp > 0 ? opts.sp : LAYOUT.SP, MINW = opts.minW > 0 ? opts.minW : SP * 2, ROW = opts.row > 0 ? opts.row : 0;
  const WRAP_MIN = opts.wrapMin > 0 ? opts.wrapMin : LAYOUT.WRAP_MIN; // T6: CLEAN lets any heading with 2+ sub-headings wrap (the top level was one 7,000-unit row)
  const heads = nodes.filter((n) => n.kind === "index");
  for (const h of heads) {
    const ch = primary.get(h.id) || [];
    h.subs = ch.filter((c) => c.kind === "index");
    h.funds = ch.filter((c) => c.kind === "fund").sort((a, b) => (a.role === "sector" ? 0 : 1) - (b.role === "sector" ? 0 : 1) ||
      (ISSUER_ORDER[a.issuer] ?? 9) - (ISSUER_ORDER[b.issuer] ?? 9) || order.get(a.id) - order.get(b.id));
    h.names = ch.filter((c) => c.kind === "name").sort((a, b) => (b.market_value_usd || 0) - (a.market_value_usd || 0) || (a.ticker < b.ticker ? -1 : 1));
    if (!bySize) { h.subs = h.subs.slice().sort(byReading); h.funds = h.funds.slice().sort(byReading); h.names = h.names.slice().sort(byReading); }
    h.cols = Math.max(colsFor(h.funds.length), colsFor(h.names.length));
    h.leafW = h.cols * SP; h.sp = SP; h.rowStep = ROW;
    h.depth = depthOf(h);
    h.w = null; h.rows = null; h.rowOf = 0;
  }
  const widthOf = (h) => {
    if (h.w != null) return h.w;
    h.subs.forEach(widthOf);
    h.rows = h.subs.length >= WRAP_MIN && wrap > 1 ? splitRows(h.subs, h.subs.map((c) => c.w), wrap, GAP) : [h.subs];
    const subsW = Math.max(0, ...h.rows.map((r) => rowW(r, GAP)));
    h.w = Math.max(MINW, h.leafW + (h.leafW && h.subs.length ? GAP : 0) + subsW);
    return h.w;
  };
  const placeX = (h, x0) => {
    h.x0 = x0; h.cx = x0 + h.w / 2;
    let x = x0;
    if (h.leafW) { h.bx0 = x0; x += h.leafW + (h.subs.length ? GAP : 0); }
    const subsW = Math.max(0, ...h.rows.map((r) => rowW(r, GAP)));
    for (const row of h.rows) { let xr = x + (subsW - rowW(row, GAP)) / 2; for (const s of row) { placeX(s, xr); xr += s.w + GAP; } }
    // later rows hang from rails; the line down to each rail runs through a gap in the row above, the gap nearest the
    // heading's centre (least slant in 3D). trunkX[r] = that gap in row r (every row but the last).
    h.trunkX = h.rows.length > 1 ? h.rows.slice(0, -1).map((row) => {
      const gaps = row.slice(1).map((s) => s.x0 - GAP / 2);
      return gaps.length ? gaps.reduce((b, g) => (Math.abs(g - h.cx) < Math.abs(b - h.cx) ? g : b)) : row[0].x0 - GAP / 2;
    }) : null;
  };
  const root = heads.find((h) => !h.parents.length);
  widthOf(root); placeX(root, -root.w / 2);
  return heads;
}

export function layout(heads, k, into) { // k = 1: 3D (extra rows step toward you) · k = 0: flat (extra rows step down)
  const { SP, LEVEL, DZ3, DY3, ROW2, NAMES_DROP, ROWGAP, ZPROJ } = LAYOUT;
  const dyOf = (h) => (k ? DY3 : h.rowStep || ROW2); // the step between the rows of a leaf block (T6: CLEAN passes a taller one for its boxes)
  // how far below a heading its subtree reaches (in 3D the rows that step toward you also look lower: ZPROJ of their depth)
  const below = new Map();
  const leafH = (h) => {
    const fRows = h.cols ? Math.ceil(h.funds.length / h.cols) : 0, nRows = h.cols ? Math.ceil(h.names.length / h.cols) : 0, dy = dyOf(h);
    let d = 0;
    if (h.funds.length) d = LEVEL + (fRows - 1) * dy + (h.names.length ? NAMES_DROP + (nRows - 1) * dy : 0);
    else if (h.names.length) d = LEVEL + (nRows - 1) * dy;
    return d + (k ? DZ3 * Math.max(0, fRows - 1, nRows - 1) * ZPROJ : 0);
  };
  const rowOffsets = (h) => { const offs = [0]; for (let r = 1; r < h.rows.length; r++) offs.push(offs[r - 1] + Math.max(...h.rows[r - 1].map(heightBelow)) + ROWGAP); return offs; };
  function heightBelow(h) {
    if (below.has(h)) return below.get(h);
    const offs = rowOffsets(h);
    let d = leafH(h);
    h.rows.forEach((row, r) => row.forEach((s) => { d = Math.max(d, LEVEL + offs[r] + heightBelow(s)); }));
    below.set(h, d); return d;
  }
  const place = (h, y) => {
    into(h, h.cx, y, 0);
    const sp = h.sp || SP, dy = dyOf(h);
    const grid = (list, y0) => list.forEach((n, i) => {
      const col = i % h.cols, row = Math.floor(i / h.cols), inRow = Math.min(h.cols, list.length - row * h.cols);
      const x = h.bx0 + (h.leafW - inRow * sp) / 2 + (col + 0.5) * sp;
      into(n, x, y0 - row * dy, row * (k ? DZ3 : 0));
    });
    const fy = y - LEVEL;
    grid(h.funds, fy);
    const fRows = Math.ceil(h.funds.length / h.cols);
    const ny = h.funds.length ? fy - (fRows - 1) * dy - NAMES_DROP : fy;
    grid(h.names, ny);
    h.namesY = ny; h.fundsY = fy; h.nRows = Math.ceil(h.names.length / h.cols);
    const offs = rowOffsets(h);
    h.rows.forEach((row, r) => row.forEach((s) => { s.rowOf = r; place(s, y - LEVEL - offs[r]); }));
  };
  place(heads.find((h) => !h.parents.length), 0);
}

export function bestRows(nodes, aspect, opts = {}) {
  let best = 1, bestErr = Infinity;
  for (let r = 1; r <= 4; r++) {
    const heads = prepareTree(nodes, { ...opts, rows: r });
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const k = opts.k == null ? 1 : opts.k; // T6: the flat canvas judges its shape flat (k = 0), where block rows step down instead of toward you
    layout(heads, k, (n, x, y, z) => { const sy = y - z * LAYOUT.ZPROJ; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); });
    const err = Math.abs(Math.log((x1 - x0) / Math.max(1, y1 - y0) / aspect));
    if (err < bestErr - 1e-9) { bestErr = err; best = r; }
  }
  return best;
}
