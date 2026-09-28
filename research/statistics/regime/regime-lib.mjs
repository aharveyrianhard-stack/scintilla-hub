/* REGIME · pure arithmetic for the market-regime research (28 Sep 2026). No fetch, no clock, no file access.
   Used by regime.mjs (runner), regime-page.mjs and tests/statistics-regime.test.mjs.

   Conventions (the page repeats them in plain words)
   · A series is an array of { d: "YYYY-MM-DD", c: close } in date order (h/l optional). Returns are close to close, price only.
   · fwd(closes, i, h) = closes[i+h] / closes[i] − 1, in %; null when the future bar does not exist yet.
   · "Cluster bootstrap": days are grouped into calendar blocks at least as long as the forward window (month for ≤21
     sessions, quarter for 63, half-year for 126, year for 252) and whole blocks are resampled, because overlapping forward
     windows from neighbouring days are not independent. It widens the interval honestly; it does not remove bias.
   · Every random draw uses a fixed seed (mulberry32), so the page is reproducible bit for bit. */

export const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
export const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
export const r3 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000;
export const mean = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
export function quantile(sortedAsc, q) { if (!sortedAsc.length) return null; const p = (sortedAsc.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (p - lo); }
export const median = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); return a.length ? quantile(a, 0.5) : null; };
export const shareUp = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? 100 * a.filter((x) => x > 0).length / a.length : null; };
export function sd(xs) { const a = xs.filter((x) => x != null && Number.isFinite(x)); if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }

export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Percent of `prior` strictly below x plus half the ties (the Hub's percentile rule). */
export function percentileOf(prior, x) { const a = prior.filter((v) => v != null && Number.isFinite(v)); if (!a.length || x == null) return null; let lo = 0, eq = 0; for (const v of a) { if (v < x) lo++; else if (v === x) eq++; } return 100 * (lo + eq / 2) / a.length; }

export function sma(xs, len) { const out = new Array(xs.length).fill(null); let s = 0; for (let i = 0; i < xs.length; i++) { s += xs[i]; if (i >= len) s -= xs[i - len]; if (i >= len - 1) out[i] = s / len; } return out; }
export function rsiWilder(closes, period = 14) {
  const out = new Array(closes.length).fill(null); if (closes.length <= period) return out;
  let up = 0, dn = 0; for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) up += d; else dn -= d; }
  up /= period; dn /= period; const f = (u, d) => d === 0 ? 100 : 100 - 100 / (1 + u / d); out[period] = f(up, dn);
  for (let i = period + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; up = (up * (period - 1) + Math.max(d, 0)) / period; dn = (dn * (period - 1) + Math.max(-d, 0)) / period; out[i] = f(up, dn); }
  return out;
}
export const fwd = (closes, i, h) => (i + h < closes.length && closes[i] > 0) ? 100 * (closes[i + h] / closes[i] - 1) : null;

/** Align two series on common dates. Returns { d, a, b } arrays. */
export function align(A, B) {
  const mb = new Map(B.map((x) => [x.d, x.c])); const d = [], a = [], b = [];
  for (const x of A) if (mb.has(x.d) && x.c > 0 && mb.get(x.d) > 0) { d.push(x.d); a.push(x.c); b.push(mb.get(x.d)); }
  return { d, a, b };
}
/** Drop leading and trailing placeholder bars (flat o=h=l=c with zero volume) that some provider histories carry. */
export function trimPlaceholders(rows) {
  const flat = (r) => r.v === 0 && r.o === r.c && r.h === r.c && r.l === r.c;
  let s = 0, e = rows.length; while (s < e && flat(rows[s])) s++; while (e > s && flat(rows[e - 1])) e--;
  return rows.slice(s, e);
}

/* ------------------------- uncertainty ------------------------- */
/** 90% interval of the mean by plain bootstrap (independent observations: monthly returns, one value per meeting …). */
export function bootMeanCI(xs, { B = 2000, seed = 7, lo = 0.05, hi = 0.95 } = {}) {
  const a = xs.filter((x) => x != null && Number.isFinite(x)); if (a.length < 5) return null;
  const rnd = mulberry32(seed), ms = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < a.length; i++) s += a[Math.floor(rnd() * a.length)]; ms.push(s / a.length); }
  ms.sort((p, q) => p - q); return [quantile(ms, lo), quantile(ms, hi)];
}
/** 90% interval of the mean when neighbouring values overlap: resample whole calendar months (keys = "YYYY-MM"). */
export function clusterMeanCI(values, keys, { B = 1000, seed = 11, lo = 0.05, hi = 0.95 } = {}) {
  const groups = new Map(); values.forEach((v, i) => { if (v == null || !Number.isFinite(v)) return; const k = keys[i]; if (!groups.has(k)) groups.set(k, [0, 0]); const g = groups.get(k); g[0] += v; g[1]++; });
  const G = [...groups.values()]; if (G.length < 5) return null;
  const rnd = mulberry32(seed), ms = [];
  for (let b = 0; b < B; b++) { let s = 0, n = 0; for (let i = 0; i < G.length; i++) { const g = G[Math.floor(rnd() * G.length)]; s += g[0]; n += g[1]; } ms.push(s / n); }
  ms.sort((p, q) => p - q); return [quantile(ms, lo), quantile(ms, hi)];
}
/** Cluster block for a forward horizon of h sessions: the block must be at least as long as the window it resamples, or
    neighbouring blocks share most of their future and the interval comes out too narrow (a 252-session window spans ~12
    months, so month blocks understate it about threefold). ≤21 → month, ≤63 → quarter, ≤126 → half-year, longer → year. */
export function blockName(h) { return h <= 21 ? "month" : h <= 63 ? "quarter" : h <= 126 ? "half-year" : "year"; }
export function horizonKey(d, h) { const y = d.slice(0, 4), m = +d.slice(5, 7); const b = blockName(h); return b === "month" ? d.slice(0, 7) : b === "quarter" ? `${y}-Q${Math.ceil(m / 3)}` : b === "half-year" ? `${y}-H${m <= 6 ? 1 : 2}` : y; }
export const horizonKeys = (dates, h) => dates.map((d) => horizonKey(d, h));
/** Summary of a set of forward returns: n, mean, median, % up, 90% interval (cluster by `keys` when given).
    months = distinct calendar months behind the numbers (from opt.dates, else the keys); blocks = distinct resampled clusters. */
export function summarise(xs, keys = null, opt = {}) {
  const idx = xs.map((x, i) => i).filter((i) => xs[i] != null && Number.isFinite(xs[i]));
  const v = idx.map((i) => xs[i]); if (!v.length) return { n: 0 };
  const ci = keys ? clusterMeanCI(v, idx.map((i) => keys[i]), opt) : bootMeanCI(v, opt);
  const blocks = keys ? new Set(idx.map((i) => keys[i])).size : null;
  const months = opt.dates ? new Set(idx.map((i) => opt.dates[i].slice(0, 7))).size : blocks;
  const out = { n: v.length, months, mean: r2(mean(v)), median: r2(median(v)), up: r1(shareUp(v)), ci: ci ? [r2(ci[0]), r2(ci[1])] : null };
  if (opt.block) Object.assign(out, { blocks, block: opt.block });
  return out;
}
/** Forward-return summary with the cluster block matched to the horizon (see blockName). */
export const summariseH = (xs, dates, h, opt = {}) => summarise(xs, horizonKeys(dates, h), { ...opt, dates, block: blockName(h) });
/** Did the condition's interval clear the all-days average? "above" / "below" / "overlaps". */
export function versus(s, base) { if (!s?.ci || base?.mean == null) return null; return s.ci[0] > base.mean ? "above" : s.ci[1] < base.mean ? "below" : "overlaps"; }

/* ------------------------- episodes ------------------------- */
/** Runs where flag[i] is true, merging runs separated by ≤ gap false bars. Returns [{ s, e }] (inclusive indices). */
export function runs(flags, gap = 0) {
  const out = []; let cur = null, miss = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) { if (cur && miss <= gap) cur.e = i; else { if (cur) out.push(cur); cur = { s: i, e: i }; } miss = 0; }
    else if (cur) { miss++; if (miss > gap) { out.push(cur); cur = null; miss = 0; } }
  }
  if (cur) out.push(cur); return out;
}
/** First day of each visit to a zone, a new visit needing `sep` bars outside the zone first. */
export function entries(flags, sep = 63) { const out = []; let lastIn = -Infinity; for (let i = 0; i < flags.length; i++) if (flags[i]) { if (i - lastIn > sep) out.push(i); lastIn = i; } return out; }
/** Drawdown episodes of a series from its running peak: peak → trough → recovery (or still open). Only depth ≥ minDepth (%) kept. */
export function drawdowns(vals, minDepth = 3) {
  const out = []; let pk = 0, tr = 0, inDD = false;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] >= vals[pk]) { if (inDD) { const depth = 100 * (vals[tr] / vals[pk] - 1); if (-depth >= minDepth) out.push({ peak: pk, trough: tr, rec: i, depth }); } pk = i; tr = i; inDD = false; }
    else { inDD = true; if (vals[i] < vals[tr] || tr < pk) tr = i; if (tr < pk) tr = i; }
  }
  if (inDD) { const depth = 100 * (vals[tr] / vals[pk] - 1); if (-depth >= minDepth) out.push({ peak: pk, trough: tr, rec: null, depth }); }
  return out;
}

/* ------------------------- calendar ------------------------- */
const dow = (d) => new Date(d + "T12:00:00Z").getUTCDay();
export function addDays(d, n) { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
/** Third Friday of a month ("YYYY-MM"). */
export function thirdFriday(ym) { let d = ym + "-01"; while (dow(d) !== 5) d = addDays(d, 1); return addDays(d, 14); }
/** Monthly option expiry session: the third Friday, or the last session before it when the market was shut that Friday. */
export function expirySession(ym, tradingSet) { let d = thirdFriday(ym); for (let k = 0; k < 4 && !tradingSet.has(d); k++) d = addDays(d, -1); return tradingSet.has(d) ? d : null; }
/** Sessions whose next weekday was a market closure (holiday or special closure). Only meaningful once Saturday trading ended (1952). */
export function preHolidaySessions(dates) {
  const set = new Set(dates), out = [];
  for (let i = 0; i + 1 < dates.length; i++) { let n = addDays(dates[i], 1); while (dow(n) === 0 || dow(n) === 6) n = addDays(n, 1); if (!set.has(n) && n < dates[dates.length - 1]) out.push(i); }
  return out;
}
/** Month-end closes → monthly returns [{ ym, ret }]. The last month is dropped when it is not finished (asOf inside it). */
export function monthlyReturns(series, finishedThrough) {
  const last = new Map(); for (const x of series) last.set(x.d.slice(0, 7), x.c);
  const ms = [...last.keys()].sort(), out = [];
  for (let i = 1; i < ms.length; i++) if (ms[i] <= finishedThrough) out.push({ ym: ms[i], ret: 100 * (last.get(ms[i]) / last.get(ms[i - 1]) - 1) });
  return out;
}
/** Parse a Fed meeting label ("January 29-30", "Jan/Feb 31-1", "April/May 30-1", "March 22") with its year → decision date. */
const MON = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function fedDecisionDate(label, year) {
  const m = String(label).trim().match(/^([A-Za-z]+)(?:\/([A-Za-z]+))?\s+(\d+)(?:-(\d+))?/); if (!m) return null;
  const endDay = +(m[4] ?? m[3]); const mon = MON[(m[2] ?? m[1]).toLowerCase()] ?? null; if (!mon) return null;
  // "Jan/Feb 31-1": the second month holds the last day; "January 29-30": one month
  return `${year}-${String(mon).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
}
