// L4 prediction markets — the page's maths, kept apart so tests/prediction-markets.test.mjs can run it.
// History rows are change-only, so the value at any moment is the last row at or before it (a step).

/** hist: [{ts, p}] sorted by time; returns p held at time t, or null before the first row */
export function valueAt(hist, t) {
  let v = null;
  for (const h of hist) { if (Date.parse(h.ts) <= t) v = h.p; else break; }
  return v;
}

/** change in percentage points over 1 day and 1 week (null when we have no reading that far back) */
export function changes(hist, now) {
  if (!hist.length) return { now: null, d1: null, w1: null };
  const cur = hist[hist.length - 1].p;
  const pts = (then) => (then === null ? null : Math.round((cur - then) * 1000) / 10);
  return { now: cur, d1: pts(valueAt(hist, now - 86400e3)), w1: pts(valueAt(hist, now - 7 * 86400e3)) };
}

/** Alan's scintillation: odds moved at least N points in a day, either way */
export const isFlash = (d1, n) => d1 !== null && d1 !== undefined && Math.abs(d1) >= n;

export const fmtPts = (x) => (x === null || x === undefined ? "—" : (Math.abs(x) < 0.05 ? "0.0" : (x > 0 ? "+" : "") + x.toFixed(1)));
export const fmtPct = (p) => (p === null || p === undefined ? "—" : (p * 100 < 1 && p > 0 ? "<1" : (p * 100).toFixed(p * 100 < 10 ? 1 : 0)) + "%");

/** sparkline path for [{ts,p}] over the window [t0, t1] as a step line, y from 0..1 mapped to the box */
export function sparkPath(hist, t0, t1, w, h) {
  if (!hist.length) return "";
  const x = (t) => ((Math.max(t0, Math.min(t1, t)) - t0) / (t1 - t0)) * w;
  const y = (p) => h - 1 - p * (h - 2);
  let d = "", lastY = null;
  const start = valueAt(hist, t0);
  if (start !== null) { lastY = y(start); d = `M0 ${lastY.toFixed(1)}`; }
  for (const r of hist) {
    const t = Date.parse(r.ts);
    if (t < t0) continue;
    const X = x(t).toFixed(1), Y = y(r.p).toFixed(1);
    d += d ? ` H${X} V${Y}` : `M${X} ${Y}`;
    lastY = Y;
  }
  return d + ` H${w}`;
}
