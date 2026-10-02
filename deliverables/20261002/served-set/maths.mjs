/* U2 (2 Oct 2026) · the served set decided by its parents — the maths, in one small module the builder and the tests both
   import, so the numbers on the page are the numbers the tests check.

   Plain words. A PARENT is a fund (or a sector heading read through its sector fund) with a list of holdings and their
   weights. Its AGGREGATE is one number made from the Geiger readings of its holdings: the equal-weight mean, or the
   weight-blended mean (bigger holdings count more). The FULL aggregate uses every holding that has a reading; the TOP-N
   aggregate uses only the N biggest holdings. The STRONG-N is the smallest N whose top-N aggregate stays within the
   tolerance of the full aggregate — on the main reading and on at least 90% of the extra "draws" (other rungs, other days).
   That N is how many names the parent needs on the Hub for its bar to be trusted.

   Tickers: Massive spells BRK.B with a dot, the Hub with a dash (BRK-B). norm() maps both to the dash so a holding, a reading
   and a served name meet on one spelling. */

export const norm = (t) => String(t || "").trim().toUpperCase().replace(/\./g, "-");

export const GRID = [5, 8, 10, 15, 20, 30, 40, 50, 75, 100];   // the brief's 5…30, extended so the broad funds get an answer
export const TOL = 0.05;                                       // the tolerance (decision 1 for Alan)
export const PASS_SHARE = 0.9;                                 // "9 days out of 10"

/* holdings: [[ticker, weight_pct], …] in any spelling; readingOf(normTicker) → number or null.
   Returns the equal-weight and weight-blended aggregates over the holdings that HAVE a reading, with the coverage. */
export function aggregate(holdings, readingOf) {
  let n = 0, sw = 0, sg = 0, swg = 0, wAll = 0;
  const notRead = [];
  for (const [t, w0] of holdings) {
    const w = Number(w0);
    if (!(w > 0)) continue;
    wAll += w;
    const g = readingOf(norm(t));
    if (g == null || !Number.isFinite(g)) { notRead.push(norm(t)); continue; }
    n++; sw += w; sg += g; swg += w * g;
  }
  if (!n) return { eq: null, w: null, count: 0, weight_pct: 0, total_weight_pct: wAll, coverage_pct: 0, not_read: notRead };
  return { eq: sg / n, w: swg / sw, count: n, weight_pct: sw, total_weight_pct: wAll, coverage_pct: wAll > 0 ? (100 * sw) / wAll : 0, not_read: notRead };
}

/* The holdings sorted by weight, biggest first, keeping only the ones with a reading (a name that cannot be read cannot
   carry a bar). */
export function readable(holdings, readingOf) {
  return holdings
    .map(([t, w]) => [norm(t), Number(w)])
    .filter(([t, w]) => w > 0 && Number.isFinite(readingOf(t) ?? NaN))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

export const topN = (sorted, N) => sorted.slice(0, N);

/* strongN(holdings, mainReadingOf, draws, opts)
   draws: an array of readingOf functions — here the seven rungs of the 1 Oct close and the five daily three-rung closes.
   For each N on the grid: the top-N aggregate against the full aggregate on the main reading (diff_main) and on every
   draw (draws_pass of draws_total). N is STRONG when |diff_main| ≤ tol and draws_pass / draws_total ≥ passShare.
   Returns, for "eq" and "w" separately: n (the smallest strong N on the grid, capped at the readable count), one_day_n (the
   smallest N that passes on the main reading alone), and the ladder by N. When the parent has fewer readable holdings than
   the smallest grid step, n = that count ("all of it"). */
export function strongN(holdings, mainReadingOf, draws, opts = {}) {
  const grid = opts.grid || GRID, tol = opts.tol ?? TOL, passShare = opts.passShare ?? PASS_SHARE;
  const sorted = readable(holdings, mainReadingOf);
  const count = sorted.length;
  const full = aggregate(sorted, mainReadingOf);
  const fullDraws = draws.map((r) => aggregate(sorted, r));
  const out = { count, full: { eq: full.eq, w: full.w }, ladder: [], eq: { n: null, one_day_n: null }, w: { n: null, one_day_n: null } };
  for (const N of grid) {
    const top = topN(sorted, N);
    const a = aggregate(top, mainReadingOf);
    const row = { N, used: top.length, weight_pct: top.reduce((s, x) => s + x[1], 0) };
    for (const kind of ["eq", "w"]) {
      const diffMain = a[kind] == null || full[kind] == null ? null : a[kind] - full[kind];
      let pass = 0, total = 0;
      draws.forEach((r, i) => {
        const ad = aggregate(top, r), fd = fullDraws[i];
        if (ad[kind] == null || fd[kind] == null) return;
        total++; if (Math.abs(ad[kind] - fd[kind]) <= tol) pass++;
      });
      const passMain = diffMain != null && Math.abs(diffMain) <= tol;
      const strong = passMain && total > 0 && pass / total >= passShare;
      row[kind] = { diff_main: diffMain, draws_pass: pass, draws_total: total, pass_main: passMain, strong };
      if (strong && out[kind].n == null) out[kind].n = Math.min(N, count);
      if (passMain && out[kind].one_day_n == null) out[kind].one_day_n = Math.min(N, count);
    }
    out.ladder.push(row);
    if (N >= count) break;   // the top-N is the whole fund from here on
  }
  for (const kind of ["eq", "w"]) {
    if (out[kind].n == null) out[kind].n = count ? "more than " + Math.min(grid[grid.length - 1], count) : 0;
    if (out[kind].one_day_n == null) out[kind].one_day_n = count ? "more than " + Math.min(grid[grid.length - 1], count) : 0;
    if (count && count <= grid[0]) { out[kind].n = count; out[kind].one_day_n = count; }
  }
  return out;
}

/* The IWM rule. iwm: IWM's holdings; homes: { parentTicker: holdings } for every sector or industry fund we serve;
   inherited: the Set of names the proposed served set keeps through OTHER parents, lists and cohorts.
   Returns the names with both homes, the IWM-only names and their weight, and what IWM's aggregate reads from
   (a) all its holdings, (b) only the inherited names — the gap is what IWM loses by keeping no own names. */
export function iwmRule(iwm, homes, inherited, readingOf) {
  const both = [], only = [];
  for (const [t0, w] of iwm) {
    const t = norm(t0);
    const where = Object.keys(homes).filter((p) => homes[p].some(([h]) => norm(h) === t));
    (where.length ? both : only).push({ ticker: t, weight_pct: Number(w), homes: where });
  }
  const full = aggregate(iwm, readingOf);
  const inh = iwm.filter(([t]) => inherited.has(norm(t)));
  const inhA = aggregate(inh, readingOf);
  return {
    both_homes: both.sort((a, b) => b.weight_pct - a.weight_pct),
    iwm_only: only.sort((a, b) => b.weight_pct - a.weight_pct),
    iwm_only_weight_pct: only.reduce((s, x) => s + x.weight_pct, 0),
    both_weight_pct: both.reduce((s, x) => s + x.weight_pct, 0),
    full: { eq: full.eq, w: full.w, count: full.count },
    inherited: { eq: inhA.eq, w: inhA.w, count: inhA.count, weight_pct: inhA.weight_pct },
    gap: { eq: inhA.eq == null || full.eq == null ? null : inhA.eq - full.eq, w: inhA.w == null || full.w == null ? null : inhA.w - full.w },
  };
}

/* The served set. parents: [{ ticker, holdings, n, admits }] — n the parent's strong-N (a number, or a string "more than X"
   which is read as X), admits=false for IWM (it admits nothing by itself). lists / cohorts: Sets of names. funds: Set of
   every fund on the tree (the parents stay served). universe: Set of what the Hub serves today (names and funds).
   Returns the kept set and, for every kept name, who needs it. */
export function servedSet({ parents, lists, cohorts, funds, universe, readingOf, cap = Infinity }) {
  const need = new Map();   // name → [{ parent, rank, weight_pct }]
  const addNeed = (t, why) => { if (!need.has(t)) need.set(t, []); need.get(t).push(why); };
  const spreadOut = [];     // parents beyond the ladder (or above the cap): no small top-N reproduces them, so (like IWM) they admit nothing by themselves
  for (const p of parents) {
    if (p.admits === false) continue;
    if (typeof p.n !== "number" || p.n > cap) { spreadOut.push(p.ticker); continue; }
    const sorted = readable(p.holdings, readingOf);
    sorted.slice(0, p.n).forEach(([t, w], i) => addNeed(t, { parent: p.ticker, rank: i + 1, weight_pct: w }));
  }
  const keep = new Set([...need.keys()]);
  const why = {};
  for (const t of keep) why[t] = { parents: need.get(t), lists: [], cohort: false };
  for (const [name, set] of Object.entries(lists)) for (const t0 of set) { const t = norm(t0); if (!keep.has(t)) { keep.add(t); why[t] = { parents: [], lists: [], cohort: false }; } why[t].lists.push(name); }
  for (const t0 of cohorts) { const t = norm(t0); if (!keep.has(t)) { keep.add(t); why[t] = { parents: [], lists: [], cohort: true }; } why[t].cohort = true; }
  const names = [...keep].filter((t) => !funds.has(t));
  const servedNames = [...universe].filter((t) => !funds.has(t));
  const out = servedNames.filter((t) => !keep.has(t)).sort();
  const inn = names.filter((t) => !universe.has(t)).sort();
  return { keep: names.sort(), why, out, in: inn, funds: [...funds].sort(), proposed_count: names.length + funds.size, spread_out: spreadOut };
}

/* The spread of the readings inside one parent: the plain standard deviation of its readable holdings' Geigers. With a
   spread s, an equal-weight average of N names is pinned to about ± s/√N — so names_for(tol) = (s / tol)² is the rough
   count a parent needs for that tolerance. The page says this in words; the table shows it per parent. */
export function spread(holdings, readingOf) {
  const g = readable(holdings, readingOf).map(([t]) => readingOf(t));
  const n = g.length;
  if (n < 2) return { n, sd: null, names_for: {} };
  const m = g.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(g.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1));
  const namesFor = {};
  for (const tol of [0.05, 0.075, 0.1, 0.15]) namesFor[tol] = Math.ceil((sd / tol) * (sd / tol));
  return { n, sd, mean: m, names_for: namesFor };
}
