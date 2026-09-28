/* Scintilla · comps labels, round 2 · one clean football-field row, numbers only on the chart.
   Pure functions: no DOM, no fetch. The page measures each number in the browser, then asks this
   file where to put it; the tests call the same functions with made-up widths.

   The row, in words (Alan, 28 Sep): the row header sits on the left; the chart carries ONLY numbers,
   one at each horizontal limit of each shape — the two ends of the line, the two edges of the box,
   the median tick and the company's own line; the dollar values sit in their own column on the right,
   stacked top to bottom. No tickers on the chart, no dots, no repeated text. */

/** Where every number goes. Two lanes only: ABOVE the line (low end, the company's own multiple,
    the median, high end) and BELOW the line (the 25th and the 75th percentile, at the box edges).
    Returns [{ id, lane, x, text, weight }] — x is the mark's position in multiples. */
export function rowMarks(row) {
  const b = row.band, own = row.own && row.own.multiple;
  const M = [
    { id: "min", lane: "above", x: b.min, anchor: "start" },
    { id: "max", lane: "above", x: b.max, anchor: "end" },
    { id: "median", lane: "above", x: b.median, anchor: "middle" },
    { id: "q1", lane: "below", x: b.q1, anchor: "middle" },
    { id: "q3", lane: "below", x: b.q3, anchor: "middle" },
  ];
  if (own != null && own > 0) M.push({ id: "own", lane: "above", x: own, anchor: "middle", weight: "bold" });
  return M.filter((m) => m.x != null);
}

/** The axis: from the lowest thing drawn to the highest, so nothing ever runs off the chart
    (Alan's screenshot had the low end "off the chart"). Returns { lo, hi, x(m) } with x in px. */
export function rowScale(row, { width, pad = 10 } = {}) {
  const b = row.band, own = row.own && row.own.multiple;
  const vals = [b.min, b.max, own].filter((v) => v != null && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!(hi > lo)) { lo = lo * 0.9; hi = hi * 1.1 || 1; }
  const inner = Math.max(1, width - 2 * pad);
  return { lo, hi, x: (m) => pad + ((m - lo) / (hi - lo)) * inner };
}

/** One lane of labels along a line: each label wants to sit at its mark; when two would touch they
    are pushed apart, in order, and the lane never leaves the chart. items: [{ id, x, w, anchor }]
    (x: the mark in px; w: the measured width; anchor: where the mark sits under the label —
    "start" = the label begins at the mark, "end" = ends at it, "middle" = centred on it).
    Returns [{ id, left, right, x, shift, ok }] in the input order; shift = how far the label moved
    from where it wanted to be, ok = false only when the lane is wider than the chart. */
export function spread(items, { width, gap = 6 } = {}) {
  const W = Math.max(1, width || 1);
  const want = items.map((it, i) => {
    const w = Math.min(it.w, W);
    const left = it.anchor === "start" ? it.x : it.anchor === "end" ? it.x - w : it.x - w / 2;
    return { i, id: it.id, x: it.x, w, want: Math.max(0, Math.min(W - w, left)) };
  }).sort((a, b) => a.want - b.want || a.x - b.x);
  const left = want.map((p) => p.want);
  for (let k = 1; k < want.length; k++) left[k] = Math.max(left[k], left[k - 1] + want[k - 1].w + gap);      // push right
  const n = want.length;
  if (n && left[n - 1] + want[n - 1].w > W) {
    left[n - 1] = W - want[n - 1].w;
    for (let k = n - 2; k >= 0; k--) left[k] = Math.min(left[k], left[k + 1] - want[k].w - gap);            // push back left
  }
  const ok = !n || left[0] >= 0;
  const out = new Array(items.length);
  want.forEach((p, k) => { const l = Math.max(0, left[k]); out[p.i] = { id: p.id, left: l, right: l + p.w, x: p.x, shift: Math.abs(l - p.want), ok: ok && l === left[k] }; });
  return out;
}

/** The right-hand column: the price each mark implies for the company, top to bottom, then today's price.
    Returns [{ id, word, price }]. */
export function rowValues(row, ticker) {
  const E = row.ends || {};
  const at = (id, word) => ({ id, word, price: E[id] ? E[id].price : null });
  const L = [at("min", "Low"), at("q1", "25th"), at("median", "Median"), at("q3", "75th"), at("max", "High")];
  if (row.own && row.own.price != null) L.push({ id: "own", word: `${ticker} today`, price: row.own.price });
  return L;
}

/** The one short line under the row's name: what the multiple is applied to, with the figure. */
export function basisLine(row, fmtMoney, fmtUsd) {
  const f = row.figure || {};
  const v = f.value;
  if (row.key === "pe_ttm") return v != null ? `price = multiple × EPS ${fmtUsd(v)}` : "price = multiple × EPS, trailing";
  if (row.key === "pe_fwd") return v != null ? `price = multiple × EPS est. ${fmtUsd(v)}` : "price = multiple × EPS estimate";
  if (row.key === "ev_ebitda") return v != null ? `on EBITDA ${fmtMoney(v)}, TTM, per share` : "on EBITDA, TTM, per share";
  if (row.key === "ps") return v != null ? `on revenue ${fmtMoney(v)}, TTM, per share` : "on revenue, TTM, per share";
  return row.basis || "";
}
