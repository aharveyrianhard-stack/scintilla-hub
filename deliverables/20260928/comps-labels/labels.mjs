/* Scintilla · comps labels · where the labels go on a labelled box-and-whisker (football-field) row.
   Pure functions: no DOM, no fetch. The page measures each label in the browser, then asks this file
   where to put it; the tests call the same functions with made-up widths.

   The rule, in words: every mark carries its own label, as close to the mark as it can be, and the
   mark always sits under (or over) its own label, so its pointer is a short STRAIGHT line from the
   label to the mark. A label sits centred on its mark, on the side (above or below the bar) the mark
   prefers, in the lane nearest the bar; it may slide sideways as long as its mark stays under it.
   It takes the next lane out when it would sit on another label, when it would cover a line that
   must stay visible (the company's own dashed line, another label's pointer), or when its own pointer
   would have to pass behind a label nearer the bar. It never leaves the chart's width. A label that
   is off its mark or in an outer lane gets its pointer drawn. */

const PAD = 3;                              // px either side of a pointer or a kept-visible line

/** labels: [{ id, x, w, side: "above"|"below", prio }] — x is the mark's position in px from the
    chart's left edge, w the measured label width. width: the chart's width. lanes: per side.
    blocked: [{ x, side }] — vertical lines that run through EVERY lane of that side and must not be
    covered (the company's own dashed line). Lower prio places first (0 keeps its ideal spot).
    Returns [{ id, x, side, lane, left, right, cx, leader, ok }] in the input order; ok is false only
    when no lane could honour every rule and the label had to slide along the outer lane. */
export function placeLabels(labels, { width, lanes = 4, gap = 8, blocked = [] } = {}) {
  const W = Math.max(1, width || 1);
  const placed = [];
  const order = labels.map((l, i) => ({ ...l, i })).sort((a, b) => (a.prio ?? 5) - (b.prio ?? 5) || a.x - b.x);
  const out = new Array(labels.length);
  const clamp = (left, w) => Math.max(0, Math.min(W - w, left));
  const covers = (left, right, x) => left - PAD < x && x < right + PAD;
  function valid(side, lane, left, w, x) {
    const right = left + w;
    for (const o of placed) {
      if (o.side !== side) continue;
      if (o.lane === lane && left < o.right + gap && o.left - gap < right) return false;       // sits on a label
      if (o.lane > lane && o.leader && covers(left, right, o.x)) return false;                    // covers a pointer that passes this lane
      if (o.lane < lane && covers(o.left, o.right, x)) return false;                              // own pointer would pass behind a nearer label
    }
    for (const b of blocked) if (b.side === side && covers(left, right, b.x)) return false;       // covers a line that must stay visible
    return true;
  }
  for (const l of order) {
    const w = Math.min(l.w, W), x = Math.max(0, Math.min(W, l.x));
    const m = Math.min(2, w / 2);                                                                 // the mark stays at least m px inside
    const ideal = clamp(x - w / 2, w);
    const lo = clamp(x - w + m, w), hi = clamp(x - m, w);                                         // every left edge that keeps the mark under the label
    const sides = l.side === "below" ? ["below", "above"] : ["above", "below"];
    let best = null;
    for (const side of sides) {
      const edges = [];
      for (const o of placed) if (o.side === side) edges.push(o.right + gap, o.left - gap - w, o.x + PAD + 1, o.x - PAD - 1 - w);
      for (const b of blocked) if (b.side === side) edges.push(b.x + PAD + 1, b.x - PAD - 1 - w);
      const cands = [...new Set([ideal, lo, hi, ...edges].map((c) => Math.round(Math.max(lo, Math.min(hi, c)) * 100) / 100))]
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
      for (let lane = 0; lane < lanes && !best; lane++) {
        const c = cands.find((c) => valid(side, lane, c, w, x));
        if (c != null) best = { side, lane, left: c, ok: true };
      }
      if (best) break;
    }
    if (!best) {                            // nothing honours every rule: slide along the outer lane of the preferred side
      const side = sides[0], lane = lanes - 1, list = placed.filter((o) => o.side === side && o.lane === lane);
      const hits = (a, b) => list.some((o) => a < o.right + gap && o.left - gap < b);
      const cands = [ideal, ...list.map((o) => o.right + gap), ...list.map((o) => o.left - gap - w)].map((c) => clamp(c, w));
      const free = cands.filter((c) => !hits(c, c + w)).sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
      best = { side, lane, left: free.length ? free[0] : ideal, ok: false };
    }
    const rec = { id: l.id, x, side: best.side, lane: best.lane, left: best.left, right: best.left + w, cx: best.left + w / 2, ok: best.ok };
    rec.leader = best.lane > 0 || Math.abs(rec.cx - x) > 3 || best.side !== l.side;
    placed.push(rec);
    out[l.i] = rec;
  }
  return out;
}

/** The strip of peer names under the axis: each name at its own price. When names sit too close for
    each to keep its own straight pointer, the two nearest are joined into one label ("AVGO·ADI") with
    one bracket, and so on until every pointer is clear, so no pointer ever runs through a name. names: [{ id, x, w }], charW: px per character
    for a joined label. Returns [{ id, ids, x, xs, row, left, right, cx, leader }]. */
export function placeStrip(names, { width, rows = 3, gap = 6, charW = 7.4 } = {}) {
  let groups = [...names].sort((a, b) => a.x - b.x).map((n) => ({ ids: [n.id], xs: [n.x], w0: n.w }));
  const shape = (g) => {
    const id = g.ids.join("·");
    return { id, ids: g.ids, xs: g.xs, x: (g.xs[0] + g.xs[g.xs.length - 1]) / 2, w: g.ids.length === 1 ? g.w0 : id.length * charW + 8 };
  };
  let res = null;
  for (;;) {                                // join the two nearest neighbours, one pair at a time, until every name keeps every rule
    const shaped = groups.map(shape);
    res = placeLabels(shaped.map((g) => ({ id: g.id, x: g.x, w: g.w, side: "below", prio: 5 })), { width, lanes: rows, gap });
    if (groups.length < 2 || res.every((r) => r.ok && r.side === "below")) { groups = shaped; break; }
    let k = 0, best = Infinity;
    for (let i = 0; i + 1 < groups.length; i++) {
      const d = groups[i + 1].xs[0] - groups[i].xs[groups[i].xs.length - 1];
      if (d < best) { best = d; k = i; }
    }
    groups.splice(k, 2, { ids: [...groups[k].ids, ...groups[k + 1].ids], xs: [...groups[k].xs, ...groups[k + 1].xs], w0: 0 });
  }
  return res.map((r, i) => ({ id: r.id, ids: groups[i].ids, x: r.x, xs: groups[i].xs, row: r.lane, left: r.left, right: r.right, cx: r.cx, leader: r.leader, ok: r.ok }));
}

/** Data sanity for one peer, from the Hub's own rows plus today's market value. Two checks, either
    one sets the peer aside and names why:
      eps  — the fundamentals row carries two trailing EPS figures (reported, adjusted); when one is
             more than 2× the other, the P/E built on the reported one is not trusted.
      mcap — today's market value ÷ the last four quarters' net income is the same P/E seen another
             way; when it and price ÷ EPS differ by more than 1.5×, the share count behind the EPS is wrong.
    p: { ticker, multiple, eps, eps_adj, ni_ttm, mcap }. Returns { ticker, faults: [{check, text, ...}], pe_mcap }. */
export function sanity(p, { epsRatio = 2, mcapRatio = 1.5 } = {}) {
  const faults = [];
  const pe_mcap = p.mcap > 0 && p.ni_ttm > 0 ? p.mcap / p.ni_ttm : null;
  if (p.eps > 0 && p.eps_adj > 0) {
    const r = Math.max(p.eps / p.eps_adj, p.eps_adj / p.eps);
    if (r > epsRatio) faults.push({ check: "eps", ratio: r, text: `its reported EPS (${p.eps}) and adjusted EPS (${p.eps_adj}) on the same row differ ${r.toFixed(1)}×` });
  }
  if (pe_mcap != null && p.multiple > 0) {
    const r = Math.max(pe_mcap / p.multiple, p.multiple / pe_mcap);
    if (r > mcapRatio) faults.push({ check: "mcap", ratio: r, text: `today's market value over its last four quarters' net income gives ${pe_mcap.toFixed(1)}x, not ${p.multiple.toFixed(1)}x (${r.toFixed(1)}× apart)` });
  }
  return { ticker: p.ticker, faults, pe_mcap };
}

/** The words on each label of the row, from the row's numbers. Every label names the mark, the
    multiple, whose it is when one peer sets it, and the price per share it gives the company.
    compact (a phone): shorter heads and the price on its own line, so each label is about a third as wide. */
export function rowLabels(read, { ticker, eps, fmtX, fmtPrice, fmtPct, faulty = [], compact = false } = {}) {
  const E = read.ends;
  const mk = (id, side, prio, head, shortHead, who, e) => {
    const m = `${who ? who + " " : ""}${fmtX(e.multiple)}`;
    return compact ? { id, x: e.price, side, prio, head: shortHead, text: m, text2: `→ ${fmtPrice(e.price)}` }
                   : { id, x: e.price, side, prio, head, text: `${m} → ${fmtPrice(e.price)}` };
  };
  const one = (w) => (w && w[0] ? w[0] : "");
  const L = [
    mk("min", "above", 2, "LOWEST PEER", "LOWEST", one(E.min.who), E.min),
    mk("q1", "below", 3, "25TH PERCENTILE", "25TH PCTL", "", E.q1),
    mk("median", "above", 1, "PEER MEDIAN", "MEDIAN", E.median.who && E.median.who.length ? E.median.who.join(" & ") : "", E.median),
    mk("q3", "below", 3, "75TH PERCENTILE", "75TH PCTL", "", E.q3),
    mk("max", "above", 2, "HIGHEST PEER", "HIGHEST", one(E.max.who), E.max),
  ];
  for (const l of L) {                      // an end set by a peer whose figures fail the data-sanity check says so on its own label
    const who = l.id === "min" ? E.min.who : l.id === "max" ? E.max.who : l.id === "median" ? E.median.who : [];
    const bad = (who || []).filter((t) => faulty.includes(t));
    if (bad.length) { l.tail = compact ? "DATA FAULT *" : `DATA FAULT (${bad.join(", ")}): see the note`; l.good = false; }
  }
  if (read.own && read.own.price != null) {
    const up = read.upside != null ? (compact ? `${fmtPct(read.upside)} to median` : `${fmtPct(read.upside)} to the peer median`) : null;
    L.push(compact
      ? { id: "me", x: read.own.price, side: "above", prio: 0, head: `${ticker} TODAY`, text: fmtPrice(read.own.price), text2: `${fmtX(read.own.multiple)} × ${eps}`, tail: up, good: read.upside != null ? read.upside > 0 : null }
      : { id: "me", x: read.own.price, side: "above", prio: 0, head: `${ticker} TODAY`, text: `${fmtPrice(read.own.price)} = ${fmtX(read.own.multiple)} × EPS ${eps}`, tail: up, good: read.upside != null ? read.upside > 0 : null });
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
