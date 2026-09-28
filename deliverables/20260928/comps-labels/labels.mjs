/* Scintilla · comps labels · where the labels go on a labelled box-and-whisker (football-field) row.
   Pure functions: no DOM, no fetch. The page measures each label in the browser, then asks this file
   where to put it; the tests call the same functions with made-up widths.

   The rule, in words: every mark carries its own label, as close to the mark as it can be. A label
   sits centred on its mark, on the side (above or below the bar) the mark prefers, in the lane
   nearest the bar. When it would sit on another label it takes the next lane out; when no lane on
   its side is free it goes to the other side; and it never leaves the chart's width. A label that
   ends up off its mark, or in an outer lane, gets a leader line back to the mark, so nothing has to
   be guessed. */

/** labels: [{ id, x, w, side: "above"|"below", prio }] — x is the mark's position in px from the
    chart's left edge, w the measured label width. width: the chart's width. lanes: per side.
    Lower prio places first (0 = the most important label keeps its ideal spot).
    Returns [{ id, x, side, lane, left, right, cx, leader }] in the input order. */
export function placeLabels(labels, { width, lanes = 4, gap = 8 } = {}) {
  const W = Math.max(1, width || 1);
  const placed = { above: Array.from({ length: lanes }, () => []), below: Array.from({ length: lanes }, () => []) };
  const order = labels.map((l, i) => ({ ...l, i })).sort((a, b) => (a.prio ?? 5) - (b.prio ?? 5) || a.x - b.x);
  const out = new Array(labels.length);
  const clamp = (left, w) => Math.max(0, Math.min(W - w, left));
  const hits = (list, left, right) => list.some((o) => left < o.right + gap && o.left - gap < right);
  for (const l of order) {
    const w = Math.min(l.w, W);
    const ideal = clamp(l.x - w / 2, w);
    const sides = l.side === "below" ? ["below", "above"] : ["above", "below"];
    let best = null;
    for (const side of sides) {
      for (let lane = 0; lane < lanes; lane++) {
        if (!hits(placed[side][lane], ideal, ideal + w)) { best = { side, lane, left: ideal }; break; }
      }
      if (best) break;
    }
    if (!best) {                            // every lane is taken at the ideal spot: slide along the outer lane of the preferred side
      const side = sides[0], lane = lanes - 1, list = placed[side][lane];
      const cands = [ideal, ...list.map((o) => o.right + gap), ...list.map((o) => o.left - gap - w)].map((c) => clamp(c, w));
      const free = cands.filter((c) => !hits(list, c, c + w)).sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
      best = { side, lane, left: free.length ? free[0] : ideal };
    }
    const rec = { id: l.id, x: l.x, side: best.side, lane: best.lane, left: best.left, right: best.left + w, cx: best.left + w / 2 };
    rec.leader = best.lane > 0 || Math.abs(rec.cx - l.x) > 3 || best.side !== l.side;
    placed[best.side][best.lane].push(rec);
    out[l.i] = rec;
  }
  return out;
}

/** The strip of peer names under the axis: each name at its own price, alternating into rows so
    names that sit close never overlap. names: [{ id, x, w }]. Returns [{ id, x, row, left, cx }]. */
export function placeStrip(names, { width, rows = 3, gap = 6 } = {}) {
  const res = placeLabels(names.map((n) => ({ ...n, side: "below", prio: 5 })), { width, lanes: rows, gap });
  return res.map((r) => ({ id: r.id, x: r.x, row: r.lane, left: r.left, cx: r.cx, leader: r.leader }));
}

/** The words on each label of the row, from the row's numbers. Every label names the mark, the
    multiple, whose it is when one peer sets it, and the price per share it gives the company. */
export function rowLabels(read, { ticker, eps, fmtX, fmtPrice, fmtPct } = {}) {
  const who = (list) => list && list.length ? " " + list.join(" & ") : "";
  const E = read.ends;
  const L = [
    { id: "min",    x: E.min.price,    side: "above", prio: 2, head: "LOWEST PEER",     text: `${E.min.who && E.min.who[0] ? E.min.who[0] + " " : ""}${fmtX(E.min.multiple)} → ${fmtPrice(E.min.price)}` },
    { id: "q1",     x: E.q1.price,     side: "below", prio: 3, head: "25TH PERCENTILE", text: `${fmtX(E.q1.multiple)} → ${fmtPrice(E.q1.price)}` },
    { id: "median", x: E.median.price, side: "above", prio: 1, head: "PEER MEDIAN",     text: `${E.median.who && E.median.who.length ? E.median.who.join(" & ") + " " : ""}${fmtX(E.median.multiple)} → ${fmtPrice(E.median.price)}` },
    { id: "q3",     x: E.q3.price,     side: "below", prio: 3, head: "75TH PERCENTILE", text: `${fmtX(E.q3.multiple)} → ${fmtPrice(E.q3.price)}` },
    { id: "max",    x: E.max.price,    side: "above", prio: 2, head: "HIGHEST PEER",    text: `${E.max.who && E.max.who[0] ? E.max.who[0] + " " : ""}${fmtX(E.max.multiple)} → ${fmtPrice(E.max.price)}` },
  ];
  if (read.own && read.own.price != null) {
    L.push({ id: "me", x: read.own.price, side: "above", prio: 0, head: `${ticker} TODAY`, text: `${fmtPrice(read.own.price)} = ${fmtX(read.own.multiple)} × EPS ${eps}`,
      tail: read.upside != null ? `${fmtPct(read.upside)} to the peer median` : null, good: read.upside != null ? read.upside > 0 : null });
  }
  return L.filter((l) => l.x != null);
}

/** Recompute a row's ends without some peers (by ticker), on the same arithmetic as the live page.
    peers: [{ticker, multiple}], eps: the company's own EPS. band(values) → {min,q1,median,q3,max,n}. */
export function withoutPeers(peers, drop, eps, band) {
  const keep = peers.filter((p) => !drop.includes(p.ticker)).sort((a, b) => a.multiple - b.multiple);
  const b = band(keep.map((p) => p.multiple));
  const n = keep.length, mid = (n - 1) / 2;
  const med = n ? (n % 2 ? [keep[mid].ticker] : [keep[Math.floor(mid)].ticker, keep[Math.ceil(mid)].ticker]) : [];
  const at = (m, who) => ({ multiple: m, who, price: m != null && eps > 0 ? m * eps : null });
  return { n, peers: keep, band: b, ends: { min: at(b.min, n ? [keep[0].ticker] : []), q1: at(b.q1, []), median: at(b.median, med), q3: at(b.q3, []), max: at(b.max, n ? [keep[n - 1].ticker] : []) } };
}
