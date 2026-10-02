/* Scintilla · A1 analytics knockouts (2 Oct) · the small statistics, stated once. Pure: no fetch, no DOM, no clock.
   The page and the tests import this same file.

   stretchPercentile(history, today)  how stretched a reading is AGAINST ITS OWN HISTORY: the share of the history's
                                      readings below today's (ties count half), 0..100. No fixed 70/30 line anywhere:
                                      a group is "extended" only against itself, and the line that calls it so is a toggle.
   agreement(ups, price?)             how far the three ways (A, B, C weighted) disagree on one company: the spread of
                                      their centres (highest − lowest) as a share of today's price, in percent; with no
                                      price given, the spread of the three upside percentages in points.
   aggregate(values)                  the equal-weight mean over the readings present (the tree's cohort rule: "its bar is
                                      the mean of its members' Geigers"); nothing is filled in for a missing reading.
   logReturn(series, h)               the h-session log return of a closing series' last bar; null when too short.
   rank(items, key, dir)              1 = the highest (dir −1) or the lowest (dir 1); nulls last, unranked. */

export const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);

export function stretchPercentile(history, today) {
  const h = (history || []).map(num).filter((x) => x != null), t = num(today);
  if (t == null || !h.length) return null;
  let below = 0, equal = 0;
  for (const x of h) { if (x < t) below++; else if (x === t) equal++; }
  return (100 * (below + equal / 2)) / h.length;
}

export function agreement(ups, price = null) {
  const v = Object.values(ups || {}).map(num).filter((x) => x != null);
  if (v.length < 2) return { ok: false, spread: null, words: "fewer than two ways" };
  const lo = Math.min(...v), hi = Math.max(...v);
  const spread = price > 0 ? ((hi - lo) / price) * 100 : hi - lo;
  return { ok: true, spread, lo, hi, n: v.length };
}

export function aggregate(values) {
  const v = (values || []).map(num).filter((x) => x != null);
  if (!v.length) return { value: null, n: 0 };
  return { value: v.reduce((s, x) => s + x, 0) / v.length, n: v.length };
}

export function logReturn(closes, h) {
  const c = (closes || []).map(num);
  if (c.length <= h) return null;
  const a = c[c.length - 1 - h], b = c[c.length - 1];
  if (!(a > 0 && b > 0)) return null;
  return Math.log(b / a);
}

export function rank(items, key, dir = -1) {
  const have = items.filter((it) => num(it[key]) != null).slice().sort((a, b) => dir * (a[key] - b[key]) || String(a.id || a.label).localeCompare(String(b.id || b.label)));
  const out = new Map();
  have.forEach((it, i) => out.set(it, i + 1));
  return items.map((it) => out.get(it) ?? null);
}

/** Tukey's fence on one row: a value beyond 1.5 × the middle half from the quartiles is an outlier, named, never trimmed. */
export function outliers(rows, key, k = 1.5) {
  const v = rows.map((r) => num(r[key])).filter((x) => x != null).sort((a, b) => a - b);
  if (v.length < 4) return [];
  const q = (p) => { const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  return rows.filter((r) => { const x = num(r[key]); return x != null && (x < q1 - k * iqr || x > q3 + k * iqr); }).map((r) => ({ ticker: r.ticker, key, value: num(r[key]), side: num(r[key]) > q3 ? "high" : "low" }));
}
