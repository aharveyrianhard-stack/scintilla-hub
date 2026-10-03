/* U3 (2 Oct 2026) · the served-set rule as Alan corrected it — the maths, in one module the builder and the tests import.

   Plain words. A fund's HOLDINGS are its names with their weights. The TOP-k are its k biggest names. The COVERED SHARE at k
   is the part of the fund's weight (its market cap) that the top-k carry. The BLEND at k is the weight-blended Geiger of
   those k names (bigger names count more; the weights are re-scaled to add to one). The fund has its OWN Geiger (read on
   the fund's own price). The blend TRACKS the fund when it stays within the Geiger tolerance of the fund's own reading on
   the main reading and on most of the extra draws, AND when the blend's daily returns explain enough of the fund's daily
   returns (the returns test). The COVERAGE POINT is the smallest k from which the blend tracks the fund and keeps tracking
   it at every larger k we measured (so one lucky k does not count). The HUB POINT is the same with the looser, live
   tolerance: that many names are read live on the Hub; the rest of the covered set is read at the close (off-Hub). */

export const norm = (t) => String(t || "").trim().toUpperCase().replace(/\./g, "-");

export const TOL_CLOSE = 0.10;   // the firm read: blend within ±0.10 of the fund's own Geiger (a tenth of the −1…+1 scale)
export const TOL_LIVE = 0.20;    // the live read: within ±0.20 — the Hub shows the sign and the rough size, the close firms it up
export const PASS_SHARE = 0.9;   // on at least 9 of 10 draws
export const R2_CLOSE = 0.90;    // the top-k blend explains 90% of the fund's daily moves (returns test, firm)
export const R2_LIVE = 0.80;     // 80% for the live read
export const RETURN_DAYS = 60;   // the returns test runs on the last 60 sessions that both sides have
export const RETURNS_MIN_SHARE = 0.8;   // the returns side is asked only when names carrying 80% of the set's weight have daily returns

/* holdings → [[ticker, weight]] sorted biggest first, every weight > 0, tickers normalised */
export function sorted(holdings) {
  return holdings.map(([t, w]) => [norm(t), Number(w)]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

/* the weight-blended reading of a set of [ticker, weight]; names without a reading are left out and the weights re-scaled */
export function blend(set, readingOf) {
  let sw = 0, swg = 0, n = 0;
  for (const [t, w] of set) { const g = readingOf(t); if (g == null || !Number.isFinite(g)) continue; sw += w; swg += w * g; n++; }
  return n ? { value: swg / sw, n, weight: sw } : { value: null, n: 0, weight: 0 };
}

/* daily log returns aligned on common dates. closes: { SYM: { d: [dates], c: [closes] } } */
const RET_CACHE = new WeakMap();
export function returnsOf(sym, closes) {
  let cache = RET_CACHE.get(closes); if (!cache) { cache = new Map(); RET_CACHE.set(closes, cache); }
  if (cache.has(sym)) return cache.get(sym);
  const s = closes[sym]; let m = null;
  if (s && s.c.length >= 3) { m = new Map(); for (let i = 1; i < s.c.length; i++) if (s.c[i] > 0 && s.c[i - 1] > 0) m.set(s.d[i], Math.log(s.c[i] / s.c[i - 1])); }
  cache.set(sym, m); return m;
}

/* The returns test. set: [[ticker, weight]]; fund: ticker. Blend the names' daily returns (weights re-scaled among the names
   that have a return that day), compare with the fund's own daily return over the last RETURN_DAYS common sessions.
   r2 = 1 − var(fund − blend) / var(fund): the share of the fund's day-to-day movement the blend explains.
   te = the standard deviation of (fund − blend) per day, in %. */
export function returnsFit(set, fund, closes, days = RETURN_DAYS) {
  const fr = returnsOf(fund, closes); if (!fr) return { r2: null, te: null, days: 0, names_with_returns: 0 };
  const rs = set.map(([t, w]) => [returnsOf(t, closes), w]).filter(([r]) => r);
  const wAll = set.reduce((s, [, w]) => s + w, 0), wHave = rs.reduce((s, [, w]) => s + w, 0);
  const w_share = wAll > 0 ? wHave / wAll : 0;   // the part of the set's weight that has daily returns (the chart API serves only the tracked universe)
  if (!rs.length) return { r2: null, te: null, days: 0, names_with_returns: 0, w_share };
  const dates = [...fr.keys()].sort().slice(-days);
  const f = [], b = [];
  for (const d of dates) {
    let sw = 0, swr = 0;
    for (const [r, w] of rs) { const x = r.get(d); if (x == null) continue; sw += w; swr += w * x; }
    if (!sw) continue;
    f.push(fr.get(d)); b.push(swr / sw);
  }
  const n = f.length; if (n < 10) return { r2: null, te: null, days: n, names_with_returns: rs.length, w_share };
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const mf = mean(f), diff = f.map((x, i) => x - b[i]), md = mean(diff);
  const varF = f.reduce((s, x) => s + (x - mf) ** 2, 0) / (n - 1), varD = diff.reduce((s, x) => s + (x - md) ** 2, 0) / (n - 1);
  return { r2: varF > 0 ? 1 - varD / varF : null, te: Math.sqrt(varD) * 100, fund_vol: Math.sqrt(varF) * 100, days: n, names_with_returns: rs.length, w_share };
}

/* The curve for one fund: for every k (1…n, or every k up to kmax for the returns side), the covered share, the blend
   against the fund's own Geiger on the main reading and the draws, and the returns fit.
   readingOf(ticker) → main Geiger; draws: [readingOf]; own: the fund's own main Geiger; ownDraws: its own reading per draw.
   Returns rows [{k, share, blend, diff, pass_draws, of_draws, r2, te}] */
export function curve(holdings, { readingOf, draws, own, ownDraws, fund, closes, kmaxReturns = 200 }) {
  const S = sorted(holdings);
  const total = S.reduce((s, [, w]) => s + w, 0);
  const rows = [];
  let cum = 0;
  for (let k = 1; k <= S.length; k++) {
    cum += S[k - 1][1];
    const top = S.slice(0, k);
    const b = blend(top, readingOf);
    const diff = b.value == null || own == null ? null : b.value - own;
    let pass = 0, of = 0;
    draws.forEach((r, i) => { const bd = blend(top, r), od = ownDraws[i]; if (bd.value == null || od == null) return; of++; if (Math.abs(bd.value - od) <= TOL_CLOSE) pass++; });
    let passLive = 0;
    draws.forEach((r, i) => { const bd = blend(top, r), od = ownDraws[i]; if (bd.value == null || od == null) return; if (Math.abs(bd.value - od) <= TOL_LIVE) passLive++; });
    const fit = closes && k <= kmaxReturns ? returnsFit(top, fund, closes) : { r2: null, te: null, days: 0, w_share: 0 };
    const asked = fit.w_share >= RETURNS_MIN_SHARE;
    rows.push({ k, share: total > 0 ? (100 * cum) / total : 0, names_read: b.n, blend: b.value, diff, pass_draws: pass, pass_live: passLive, of_draws: of, r2: asked ? fit.r2 : null, r2_thin: asked ? null : fit.r2, returns_share: fit.w_share, te: fit.te, days: fit.days });
  }
  return { rows, total_weight: total, n: S.length };
}

/* does row k track the fund at the given tolerances? The Geiger side needs the main reading and the draw share; the returns
   side needs r2 — when no returns are measured at this k (beyond kmaxReturns, or no closes), the returns side is not asked. */
export function tracks(row, tol, r2min, passShare = PASS_SHARE) {
  if (row.diff == null || Math.abs(row.diff) > tol) return false;
  const p = tol === TOL_LIVE ? row.pass_live : row.pass_draws;
  if (row.of_draws > 0 && p / row.of_draws < passShare) return false;
  if (row.r2 != null && row.r2 < r2min) return false;
  return true;
}

/* the point: the smallest k from which every measured larger k also tracks. null when even the whole fund does not. */
export function point(rows, tol, r2min) {
  let pt = null;
  for (let i = rows.length - 1; i >= 0; i--) { if (tracks(rows[i], tol, r2min)) pt = rows[i].k; else break; }
  return pt;
}

/* The overlap rule for an equal-weight or very broad fund. holdings: the fund's; covered: Set of names already chosen;
   overlapCount(ticker) → how many OTHER funds in our set hold it; readingOf / own / draws / ownDraws / closes as above.
   Adds the candidates in order of overlap (most other homes first; ties by weight), never a name no other fund holds, and
   stops at the first of: the blend of the covered names tracks the fund at the close tolerance with at least minShare % of the fund's weight in (a floor, so a handful of names cannot pass for an equal-weight fund), or the next `window`
   additions together would add less than `minGain` points of covered share. Returns the path and where it stopped. */
export function overlapRule(holdings, { covered, overlapCount, readingOf, draws, own, ownDraws, fund, closes, window = 10, minGain = 1.0, maxAdd = 150, minShare = 50 }) {
  const S = sorted(holdings);
  const total = S.reduce((s, [, w]) => s + w, 0);
  const have = S.filter(([t]) => covered.has(t));
  const cands = S.filter(([t]) => !covered.has(t) && overlapCount(t) > 0).sort((a, b) => overlapCount(b[0]) - overlapCount(a[0]) || b[1] - a[1]);
  const state = (set) => {
    const b = blend(set, readingOf);
    let pass = 0, of = 0;
    draws.forEach((r, i) => { const bd = blend(set, r), od = ownDraws[i]; if (bd.value == null || od == null) return; of++; if (Math.abs(bd.value - od) <= TOL_CLOSE) pass++; });
    const fit0 = closes ? returnsFit(set, fund, closes) : { r2: null, te: null, w_share: 0 };
    const fit = fit0.w_share >= RETURNS_MIN_SHARE ? fit0 : { ...fit0, r2: null };
    return { count: set.length, returns_share: fit0.w_share, share: total > 0 ? (100 * set.reduce((s, [, w]) => s + w, 0)) / total : 0, blend: b.value, diff: b.value == null || own == null ? null : b.value - own, pass_draws: pass, of_draws: of, r2: fit.r2, te: fit.te };
  };
  const path = [{ added: 0, ticker: null, overlap: null, ...state(have) }];
  const set = have.slice();
  let stop = 0, why = "nothing to add";
  for (let i = 0; i < cands.length && i < maxAdd; i++) {
    const cur = path[path.length - 1];
    const trackNow = cur.share >= minShare && cur.diff != null && Math.abs(cur.diff) <= TOL_CLOSE && (cur.of_draws === 0 || cur.pass_draws / cur.of_draws >= PASS_SHARE) && (cur.r2 == null || cur.r2 >= R2_CLOSE);
    if (trackNow) { stop = i; why = `the blend tracks the fund at the close tolerance with at least ${minShare}% of its weight in`; break; }
    const gain = cands.slice(i, i + window).reduce((s, [, w]) => s + w, 0) * (total > 0 ? 100 / total : 0);
    if (gain < minGain) { stop = i; why = `the next ${window} names together add under ${minGain} point of the fund's weight`; break; }
    set.push(cands[i]);
    path.push({ added: i + 1, ticker: cands[i][0], overlap: overlapCount(cands[i][0]), weight: cands[i][1], ...state(set) });
    stop = i + 1; why = i + 1 >= maxAdd ? `the cap of ${maxAdd} additions` : i + 1 >= cands.length ? "no candidate left that another fund holds" : why;
  }
  return { path, stop, why, added: path.slice(1, stop + 1).map((p) => p.ticker), candidates: cands.length, covered_before: path[0], covered_after: path[stop], total_weight: total, n: S.length, only_here: S.filter(([t]) => !covered.has(t) && overlapCount(t) === 0).length };
}
