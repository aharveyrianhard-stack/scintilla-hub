/* Scintilla · comps labels, round 3 · every mark self-explaining, the upside drawn, and the COMBINED
   football field across metrics. Pure functions: no DOM, no fetch. The page measures the labels in the
   browser and asks this file where to put them; the tests call the same functions with made-up widths.

   The row, in words (Alan, 28 Sep ~18:45): a small type label above each mark (LOWEST PEER · 25TH ·
   MEDIAN · 75TH · HIGHEST PEER · MU TODAY); the multiples on the TOP row, the prices they imply on the
   BOTTOM row (one choice, kept everywhere); the company's own mark unmistakably different from the median
   (a diamond on a dashed line, in the direction colour, with words); an arrow from today to the median
   with the upside in dollars and percent; a legend naming every symbol. */

import { spread } from "../comps-labels-r2/labels-r2.mjs";
export { spread };

/* ---- the marks of one row ---------------------------------------------------------------------- */

/** The name each mark type carries on the chart (small caps, above the number). */
export const MARK_WORDS = { min: "LOWEST PEER", q1: "25TH", median: "MEDIAN", q3: "75TH", max: "HIGHEST PEER" };

/** Every mark of a row, with its type word, its multiple and the price it implies.
    Returns [{ id, word, multiple, price, anchor, own }] in axis order; the company's own mark carries own: true
    and the word "<TICKER> TODAY". A row whose own multiple is missing carries no own mark. */
export function rowMarks(row, ticker) {
  const b = row.band, E = row.ends || {};
  const M = ["min", "q1", "median", "q3", "max"].map((id) => ({
    id, word: MARK_WORDS[id], multiple: b[id], price: E[id] ? E[id].price : null,
    anchor: id === "min" ? "start" : id === "max" ? "end" : "middle", own: false,
  }));
  const own = row.own && row.own.multiple;
  if (own != null && own > 0) M.push({ id: "own", word: `${ticker} TODAY`, multiple: own, price: row.own.price, anchor: "middle", own: true });
  return M.filter((m) => m.multiple != null).sort((a, b2) => a.multiple - b2.multiple);
}

/** The axis: from the lowest thing drawn to the highest, so nothing ever runs off the chart. x in px. */
export function rowScale(row, { width, pad = 10 } = {}) {
  const b = row.band, own = row.own && row.own.multiple;
  const vals = [b.min, b.max, own].filter((v) => v != null && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!(hi > lo)) { lo = lo * 0.9; hi = hi * 1.1 || 1; }
  const inner = Math.max(1, width - 2 * pad);
  return { lo, hi, x: (m) => pad + ((m - lo) / (hi - lo)) * inner };
}

/* ---- the upside ----------------------------------------------------------------------------------- */

/** From today's price to the price a mark implies: dollars and percent. null when either side is missing. */
export function upsideTo(price, target) {
  if (!(price > 0) || target == null) return null;
  return { dollars: target - price, pct: (target / price - 1) * 100 };
}

/** The three upsides a row states: to the 25th, to the median, to the 75th. */
export function rowUpside(row) {
  const E = row.ends || {}, p = row.own && row.own.price;
  return { q1: upsideTo(p, E.q1 && E.q1.price), median: upsideTo(p, E.median && E.median.price), q3: upsideTo(p, E.q3 && E.q3.price) };
}

/* ---- the combined football field --------------------------------------------------------------- */

const median = (a) => { const s = a.filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
export { median };

/** The rows that can be aggregated: priced (ok) and carrying a median price. */
export function usableRows(rows) { return rows.filter((r) => r.ok && r.ends && r.ends.median && r.ends.median.price != null); }

/** Way A — the RANGE OF THE MEDIANS: the lowest median price across the metrics to the highest, with the
    median of the medians as the centre. Every metric's median is one point on the line. */
export function rangeOfMedians(rows) {
  const R = usableRows(rows).map((r) => ({ key: r.key, label: r.label, price: r.ends.median.price }));
  if (!R.length) return { ok: false, reason: "no row can be priced" };
  const prices = R.map((r) => r.price);
  return { ok: true, way: "A", name: "Range of the medians", lo: Math.min(...prices), hi: Math.max(...prices), mid: median(prices), points: R.sort((a, b) => a.price - b.price),
    rule: "the line runs from the lowest of the metrics' median prices to the highest; the centre is the median of those medians" };
}

/** Way B — the MIDDLE-HALF BAND across the metrics: the median of the metrics' 25th-percentile prices to
    the median of their 75th-percentile prices, centred on the median of the medians. The envelope (the
    lowest 25th to the highest 75th) and the strict overlap (the highest 25th to the lowest 75th, where every
    metric agrees; empty when they do not) are returned too, so the page can say how wide the disagreement is. */
export function middleHalfBand(rows) {
  const R = usableRows(rows).filter((r) => r.ends.q1 && r.ends.q3 && r.ends.q1.price != null && r.ends.q3.price != null);
  if (!R.length) return { ok: false, reason: "no row can be priced" };
  const q1s = R.map((r) => r.ends.q1.price), q3s = R.map((r) => r.ends.q3.price), meds = R.map((r) => r.ends.median.price);
  const overlapLo = Math.max(...q1s), overlapHi = Math.min(...q3s);
  return { ok: true, way: "B", name: "Middle-half band across the metrics", lo: median(q1s), hi: median(q3s), mid: median(meds),
    envelope: { lo: Math.min(...q1s), hi: Math.max(...q3s) },
    overlap: overlapLo <= overlapHi ? { lo: overlapLo, hi: overlapHi, keys: R.map((r) => r.key) } : null,
    points: R.map((r) => ({ key: r.key, label: r.label, lo: r.ends.q1.price, hi: r.ends.q3.price, mid: r.ends.median.price })),
    rule: "left edge = the median of the metrics' 25th-percentile prices; right edge = the median of their 75th-percentile prices; centre = the median of the medians" };
}

/** Way C — a WEIGHTED BLEND with stated weights: the weighted average of the metrics' 25th, median and 75th
    prices. Weights are per row key; a row that cannot be priced is left out and the rest are re-weighted
    to add to one. Returns the weights actually used. */
export const DEFAULT_WEIGHTS = { pe_ttm: 0.30, ev_ebitda: 0.30, ev_sales: 0.15, ps: 0.10, pe_fwd: 0.10, peg: 0.05 };
export function weightedBlend(rows, weights = DEFAULT_WEIGHTS) {
  const R = usableRows(rows).filter((r) => (weights[r.key] || 0) > 0 && r.ends.q1 && r.ends.q3 && r.ends.q1.price != null && r.ends.q3.price != null);
  if (!R.length) return { ok: false, reason: "no weighted row can be priced" };
  const sum = R.reduce((s, r) => s + weights[r.key], 0);
  const used = R.map((r) => ({ key: r.key, label: r.label, weight: weights[r.key] / sum, asked: weights[r.key], lo: r.ends.q1.price, hi: r.ends.q3.price, mid: r.ends.median.price }));
  const w = (f) => used.reduce((s, u) => s + u.weight * f(u), 0);
  return { ok: true, way: "C", name: "Weighted blend", lo: w((u) => u.lo), hi: w((u) => u.hi), mid: w((u) => u.mid), points: used,
    left_out: rows.filter((r) => !R.includes(r)).map((r) => ({ key: r.key, label: r.label, why: !r.ok ? (r.reason || "cannot be priced") : "weight 0" })),
    rule: "each price = Σ weight × the metric's price at that mark; the weights are stated and add to one" };
}

/** All three ways on one company, each with the upside from today's price to its centre and its two edges. */
export function combined(rows, price, weights = DEFAULT_WEIGHTS) {
  const ways = [rangeOfMedians(rows), middleHalfBand(rows), weightedBlend(rows, weights)];
  for (const w of ways) if (w.ok) w.upside = { lo: upsideTo(price, w.lo), mid: upsideTo(price, w.mid), hi: upsideTo(price, w.hi) };
  return ways;
}

/** The $ axis of the combined section: from the lowest thing drawn on any way (or today's price) to the highest. */
export function combinedScale(ways, price, { width, pad = 10 } = {}) {
  const vals = [price];
  for (const w of ways) if (w.ok) { vals.push(w.lo, w.hi); if (w.envelope) vals.push(w.envelope.lo, w.envelope.hi); for (const p of w.points || []) vals.push(p.price ?? p.lo, p.hi ?? p.price); }
  const v = vals.filter((x) => x != null && Number.isFinite(x) && x > 0);
  let lo = Math.min(...v), hi = Math.max(...v);
  if (!(hi > lo)) { lo *= 0.9; hi = hi * 1.1 || 1; }
  const inner = Math.max(1, width - 2 * pad);
  return { lo, hi, x: (p) => pad + ((p - lo) / (hi - lo)) * inner };
}

/* ---- words ---------------------------------------------------------------------------------------- */

/** The one short line under the row's name: what the multiple is applied to, with the figure. */
export function basisLine(row, fmtMoney, fmtUsd) {
  const f = row.figure || {}, v = f.value;
  if (row.key === "pe_ttm") return v != null ? `price = multiple × EPS ${fmtUsd(v)} (TTM)` : "price = multiple × EPS, trailing";
  if (row.key === "pe_fwd") return v != null ? `price = multiple × EPS est. ${fmtUsd(v)}` : "price = multiple × EPS estimate";
  if (row.key === "ev_ebitda") return v != null ? `on EBITDA ${fmtMoney(v)}, TTM, per share` : "on EBITDA, TTM, per share";
  if (row.key === "ev_sales") return v != null ? `on revenue ${fmtMoney(v)}, TTM, less net debt, per share` : "on revenue, TTM, less net debt, per share";
  if (row.key === "ps") return v != null ? `on revenue ${fmtMoney(v)}, TTM, per share` : "on revenue, TTM, per share";
  if (row.key === "peg") return v != null ? `on EPS growth × EPS est. ${fmtUsd(v)}` : "on EPS growth × EPS estimate";
  return row.basis || "";
}

/** "+87% to the median · +$918" — the words on the arrow. */
export function upsideWords(u, fmtPrice, which = "median") {
  if (!u) return null;
  const sign = u.pct >= 0 ? "+" : "−";
  const pct = `${sign}${Math.abs(u.pct).toFixed(Math.abs(u.pct) >= 10 ? 0 : 1)}%`;
  const dollars = `${sign}${fmtPrice(Math.abs(u.dollars))}`;
  return { pct, dollars, line: `${pct} to the ${which} · ${dollars}`, up: u.pct >= 0 };
}

/* ---- lanes that get crowded ------------------------------------------------------------------------ */

/** One lane of labels that may not fit on one line (a phone-width row carries six). First every label is
    spread on one tier; when the lane is wider than the chart, or a label had to move more than `maxShift`,
    the labels are dealt onto two tiers by turns (in axis order) and each tier is spread on its own.
    items: [{ id, x, w, anchor }]. Returns [{ id, left, right, x, shift, tier }] in the input order; tier 0 is
    the line nearest the marks, tier 1 the line behind it. */
export function stagger(items, { width, gap = 6, maxShift = 24 } = {}) {
  const one = spread(items, { width, gap });
  if (one.every((r) => r.ok && r.shift <= maxShift)) return one.map((r) => ({ ...r, tier: 0 }));
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.x - b.it.x);
  const tiers = [[], []];
  order.forEach((o, k) => tiers[k % 2].push(o));
  const out = new Array(items.length);
  tiers.forEach((t, tier) => {
    const res = spread(t.map((o) => o.it), { width, gap });
    res.forEach((r, k) => { out[t[k].i] = { ...r, tier }; });
  });
  return out;
}
