/* MARKET-MAP r3 · the tree layout — one small module the page and the tests both import, so the picture the tests check is
   the picture on the screen. Pure arithmetic from the node list: no simulation, no randomness, the same map every time.

   A top-down tree. x comes from the tree: every heading gets the width its funds, names and sub-headings need (its own
   funds and names on the left, its sub-headings to the right). y is the level: THE MARKET at the top, one LEVEL lower per
   step down the tree. A heading's funds sit in a block one level below it, its names in a block under the funds. A block
   is ONE row when its lines fit, and more rows only when there are many (columns = √count, 3 to 9). In 3D the extra rows
   step toward you (z) — so the upper tree is flat and the tree becomes 3D lower down, only where the count needs it; in
   FLAT 2D (k = 0) the same rows step down instead.

   prepareTree(nodes) — nodes: [{id, kind, parents, role, issuer, market_value_usd, ticker}] (the node list order is kept);
                        adds to every heading: subs, funds, names, cols, leafW, depth, w, x0, cx, bx0. Returns the headings.
   layout(heads, k, into) — calls into(node, x, y, z) once for every node. */
export const LAYOUT = { SP: 22, GAP: 26, LEVEL: 120, DZ3: 28, DY3: 6, ROW2: 36, NAMES_DROP: 70 };
const ISSUER_ORDER = { "State Street SPDR": 0, iShares: 1, Vanguard: 2, "Invesco (equal weight)": 3 };
export const colsFor = (n) => (n <= 3 ? n : Math.min(9, Math.max(3, Math.ceil(Math.sqrt(n)))));

export function prepareTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n])), order = new Map(nodes.map((n, i) => [n.id, i]));
  const primary = new Map();
  for (const n of nodes) if (n.parents.length) { const p = n.parents[0]; if (!primary.has(p)) primary.set(p, []); primary.get(p).push(n); }
  const depthOf = (n) => { let d = 0, c = n; while (c.parents.length) { c = byId.get(c.parents[0]); d++; } return d; };
  const { SP, GAP } = LAYOUT;
  const heads = nodes.filter((n) => n.kind === "index");
  for (const h of heads) {
    const ch = primary.get(h.id) || [];
    h.subs = ch.filter((c) => c.kind === "index");
    h.funds = ch.filter((c) => c.kind === "fund").sort((a, b) => (a.role === "sector" ? 0 : 1) - (b.role === "sector" ? 0 : 1) ||
      (ISSUER_ORDER[a.issuer] ?? 9) - (ISSUER_ORDER[b.issuer] ?? 9) || order.get(a.id) - order.get(b.id));
    h.names = ch.filter((c) => c.kind === "name").sort((a, b) => (b.market_value_usd || 0) - (a.market_value_usd || 0) || (a.ticker < b.ticker ? -1 : 1));
    h.cols = Math.max(colsFor(h.funds.length), colsFor(h.names.length));
    h.leafW = h.cols * SP;
    h.depth = depthOf(h);
    h.w = null;
  }
  const widthOf = (h) => {
    if (h.w != null) return h.w;
    const subsW = h.subs.reduce((s, c) => s + widthOf(c), 0) + GAP * Math.max(0, h.subs.length - 1);
    h.w = Math.max(SP * 2, h.leafW + (h.leafW && h.subs.length ? GAP : 0) + subsW);
    return h.w;
  };
  const placeX = (h, x0) => {
    h.x0 = x0; h.cx = x0 + h.w / 2;
    let x = x0;
    if (h.leafW) { h.bx0 = x0; x += h.leafW + (h.subs.length ? GAP : 0); }
    for (const s of h.subs) { placeX(s, x); x += s.w + GAP; }
  };
  const root = heads.find((h) => !h.parents.length);
  widthOf(root); placeX(root, -root.w / 2);
  return heads;
}

export function layout(heads, k, into) { // k = 1: 3D (extra rows step toward you) · k = 0: flat (extra rows step down)
  const { SP, LEVEL, DZ3, DY3, ROW2, NAMES_DROP } = LAYOUT;
  for (const h of heads) {
    const y = -h.depth * LEVEL;
    into(h, h.cx, y, 0);
    const grid = (list, y0) => list.forEach((n, i) => {
      const col = i % h.cols, row = Math.floor(i / h.cols), inRow = Math.min(h.cols, list.length - row * h.cols);
      const x = h.bx0 + (h.leafW - inRow * SP) / 2 + (col + 0.5) * SP;
      into(n, x, y0 - row * (k ? DY3 : ROW2), row * (k ? DZ3 : 0));
    });
    const fy = y - LEVEL;
    grid(h.funds, fy);
    const fRows = Math.ceil(h.funds.length / h.cols);
    const ny = h.funds.length ? fy - (fRows - 1) * (k ? DY3 : ROW2) - NAMES_DROP : fy;
    grid(h.names, ny);
    h.namesY = ny; h.fundsY = fy; h.nRows = Math.ceil(h.names.length / h.cols);
  }
}
