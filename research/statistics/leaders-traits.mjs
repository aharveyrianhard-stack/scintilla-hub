/* LEADERS · 2 · WHAT LEADERS LOOKED LIKE AT THE START — traits read on the last close before the year they led.
   node research/statistics/leaders-traits.mjs --fmp <dir> --conc <leaders-concentration.json> [--out <file>]

   A "leader" of year Y = one of that year's top 20 contributors to the S&P 500's price return (leaders-concentration).
   The comparison group = every other company in the same pool on the same date:
   · 2020 → 2026: the companies in SPY's holdings on the last quarter-end before Y that have chart-API bars (~250 a year).
   · 2004 → 2019: the 113 large companies with FMP cap histories that were S&P members on that date.
   Everything is read on the last close of Y−1 from data available then (no look-ahead):
   · relative strength = the stock's price return over the prior 252 sessions minus SPY's, and its rank in the pool;
   · distance from the 52-week high = close ÷ highest high of the prior 252 sessions − 1;
   · RSI(14) own-history percentile over the stock's WHOLE prior history (expanding; leaders-lib s9Series, needs 250
     earlier readings) — not the S9 rolling 3-year window;
   · cloud order (Station vocabulary, s9-research cloudState): bull order e13>e21>s50>s200, bear order, or mixed; price
     above all four lines / between / below all;
   · growth: trailing-four-quarter revenue and net income against the four quarters a year earlier, using only
     quarters FMP says were FILED before the date (filingDate);
   · size: the company's weight in the index (measured or estimated) and its rank in the pool.
   Base rates are read over the whole range of each trait: "chance of being a leader if the trait is at or above the
   p-th pool percentile", p = 0 … 99 — no single chosen cut-off.
   The "run start" block is hindsight: for each leader (and, as the yardstick, every non-leader of comparable size), the lowest low between the start of Y−1 and its highest close
   in Y, and the same traits read on that day. It describes, it does not select. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadBars, setPatchDir, listCachedSymbols, idxOnOrBefore, median, quantile, percentiles, r1, r2, dstr, NOT_STOCKS, s9Series, cloudState } from "./leaders-lib.mjs";
import { companiesOf } from "./leaders-concentration.mjs";

export const LOOKBACK_52W = 252;

/** Trailing-four-quarter growth from quarterly statements filed on or before d. */
export function ttmGrowth(rows, d) {
  const q = rows.filter((r) => (r.filingDate ?? r.date) <= d).sort((a, b) => a.date < b.date ? 1 : -1);
  if (q.length < 8) return { rev: null, ni: null, turned: null, asOf: q[0]?.date ?? null };
  const sum = (arr, k) => arr.reduce((s, r) => s + (+r[k] || 0), 0);
  const r0 = sum(q.slice(0, 4), "revenue"), r1_ = sum(q.slice(4, 8), "revenue"), n0 = sum(q.slice(0, 4), "netIncome"), n1 = sum(q.slice(4, 8), "netIncome");
  return { rev: r1_ > 0 ? 100 * (r0 / r1_ - 1) : null, ni: n1 > 0 ? 100 * (n0 / n1 - 1) : null, turned: n1 <= 0 && n0 > 0, asOf: q[0].date };
}

/** Traits of one series at bar i (all from bars 0..i). */
export function traitsAt(S, i, spy) {
  if (i < LOOKBACK_52W) return null;
  const d = S.dates[i], j = idxOnOrBefore(spy.dates, d), j0 = idxOnOrBefore(spy.dates, S.dates[i - LOOKBACK_52W]);
  const ret = 100 * (S.c[i] / S.c[i - LOOKBACK_52W] - 1), spyRet = j >= 0 && j0 >= 0 ? 100 * (spy.c[j] / spy.c[j0] - 1) : null;
  let hi = -Infinity; for (let k = i - LOOKBACK_52W + 1; k <= i; k++) hi = Math.max(hi, S.h[k]);
  const st = cloudState(S.ma, S.c[i], i);
  return { date: d, ret1y: ret, rs: spyRet == null ? null : ret - spyRet, fromHigh: 100 * (S.c[i] / hi - 1), rsi: S.rsi[i], rsiPct: S.pct[i],
    order: st ? (st.bull ? "bull order" : st.bear ? "bear order" : "mixed") : null, position: st?.position ?? null };
}

export function run(fmpDir, conc) {
  setPatchDir(path.join(fmpDir, "bars-patch"));
  const cached = new Set(listCachedSymbols()), series = new Map();
  const S = (sym) => { if (!cached.has(sym) || NOT_STOCKS.has(sym)) return null; if (!series.has(sym)) { const L = loadBars(sym); series.set(sym, L && L.bars.length > LOOKBACK_52W + 5 ? s9Series(L.bars) : null); } return series.get(sym); };
  const spyL = loadBars("SPY"), spy = { dates: spyL.bars.map((b) => dstr(b.t)), c: spyL.bars.map((b) => +b.c) };
  const fund = new Map(); for (const f of fs.readdirSync(path.join(fmpDir, "fund"))) fund.set(f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(fmpDir, "fund", f), "utf8")));
  const hdir = path.join(fmpDir, "spy-holdings"), snapDates = fs.readdirSync(hdir).map((f) => f.slice(0, 10)).sort();
  const capCands = JSON.parse(fs.readFileSync(path.join(fmpDir, "cap-candidates.json"), "utf8")).filter((s) => s !== "GOOG");

  const rows = [], runStarts = [];
  for (const Y of conc.years) {
    const d0 = spy.dates[idxOnOrBefore(spy.dates, `${Y.year - 1}-12-31`)];
    const leaders = new Set(Y.top20.map((x) => x.sym));
    // the pool and its sizes
    let pool = [];
    if (Y.regime === "measured") {
      const sd = snapDates.filter((x) => x <= d0).at(-1);
      const co = companiesOf(JSON.parse(fs.readFileSync(path.join(hdir, sd + ".json"), "utf8")));
      pool = [...co.values()].map((c) => ({ sym: c.sym, w: c.w }));
    } else {
      const est = new Map(Y.allWeights ?? []);
      pool = capCands.filter((s) => est.has(s)).map((s) => ({ sym: s, w: est.get(s) }));
    }
    const seen = new Set(); pool = pool.filter((p) => { if (seen.has(p.sym)) return false; seen.add(p.sym); return true; });
    const measured = [];
    for (const p of pool) {
      const s = S(p.sym); if (!s) continue;
      const i = idxOnOrBefore(s.dates, d0); if (i < 0 || Date.parse(d0) - Date.parse(s.dates[i]) > 10 * 864e5) continue;
      const t = traitsAt(s, i, spy); if (!t) continue;
      const g = fund.has(p.sym) ? ttmGrowth(fund.get(p.sym), d0) : null;
      measured.push({ year: Y.year, regime: Y.regime, sym: p.sym, leader: leaders.has(p.sym), w: p.w, ...t, revG: g?.rev ?? null, niG: g?.ni ?? null, turned: g?.turned ?? null });
    }
    // pool ranks (0..100) for rs and size
    const rank = (k) => { const xs = measured.map((m) => m[k]).filter((x) => x != null); for (const m of measured) m[k + "Rank"] = m[k] == null ? null : 100 * (xs.filter((x) => x < m[k]).length + 0.5 * (xs.filter((x) => x === m[k]).length - 1)) / Math.max(1, xs.length - 1); };
    rank("rs"); rank("w"); rank("fromHigh"); rank("revG"); rank("niG");
    const minLeaderW = Math.min(...measured.filter((m) => m.leader).map((m) => m.w));
    for (const m of measured) m.comparableSize = m.w >= minLeaderW;
    rows.push(...measured);
    // hindsight run start for leaders
    for (const m of measured.filter((x) => x.leader || x.comparableSize)) {
      const s = S(m.sym), a = idxOnOrBefore(s.dates, `${Y.year - 2}-12-31`) + 1, yEnd = idxOnOrBefore(s.dates, `${Y.year}-12-31`), yStart = idxOnOrBefore(s.dates, d0) + 1;
      if (a <= 0 || yEnd <= yStart) continue;
      let top = yStart; for (let k = yStart; k <= yEnd; k++) if (s.c[k] > s.c[top]) top = k;
      let lo = a; for (let k = a; k <= top; k++) if (s.l[k] < s.l[lo]) lo = k;
      const t = traitsAt(s, lo, spy); if (!t) continue;
      const g = fund.has(m.sym) ? ttmGrowth(fund.get(m.sym), s.dates[lo]) : null;
      runStarts.push({ year: Y.year, sym: m.sym, leader: m.leader, low: s.dates[lo], peak: s.dates[top], monthsFromYearStart: r1((Date.parse(s.dates[lo]) - Date.parse(d0)) / (30.44 * 864e5)), gainToPeak: r1(100 * (s.c[top] / s.c[lo] - 1)),
        rs: r1(t.rs), fromHigh: r1(t.fromHigh), rsiPct: r1(t.rsiPct), order: t.order, position: t.position, revG: r1(g?.rev), niG: r1(g?.ni) });
    }
  }
  return { generated: new Date().toISOString(), kind: "Leaders 2 — traits on the last close before the leadership year, leaders vs the rest of the pool", rows: rows.map(slim), summary: summarize(rows), runStarts, runStartSummary: { leaders: summarizeRunStarts(runStarts.filter((r) => r.leader)), comparableOthers: summarizeRunStarts(runStarts.filter((r) => !r.leader)) } };
}

const slim = (m) => ({ y: m.year, s: m.sym, L: m.leader ? 1 : 0, w: r2(m.w), rs: r1(m.rs), rsR: r1(m.rsRank), fh: r1(m.fromHigh), rp: r1(m.rsiPct), o: m.order, p: m.position, rg: r1(m.revG), ng: r1(m.niG), wR: r1(m.wRank), cs: m.comparableSize ? 1 : 0 });

/** Distribution + base-rate summaries for every trait. */
export function summarize(rows, nested = false) {
  const out = { n: rows.length, leaders: rows.filter((r) => r.leader).length, baseRate: null, traits: {}, categorical: {} };
  out.baseRate = r1(100 * out.leaders / out.n);
  const groups = { all: rows, comparable: rows.filter((r) => r.comparableSize) };
  for (const [gname, g] of Object.entries(groups)) {
    const L = g.filter((r) => r.leader), N = g.filter((r) => !r.leader), base = 100 * L.length / g.length;
    const T = {};
    for (const k of ["rs", "fromHigh", "rsiPct", "revG", "niG", "w", "rsRank", "wRank", "revGRank", "niGRank", "fromHighRank"]) {
      const lx = L.map((r) => r[k]).filter((x) => x != null), nx = N.map((r) => r[k]).filter((x) => x != null);
      T[k] = { leaders: { n: lx.length, med: r1(median(lx)), q1: r1(quantile(lx, 0.25)), q3: r1(quantile(lx, 0.75)), pct: percentiles(lx) }, others: { n: nx.length, med: r1(median(nx)), q1: r1(quantile(nx, 0.25)), q3: r1(quantile(nx, 0.75)), pct: percentiles(nx) } };
      if (k.endsWith("Rank") || k === "rsiPct") {
        const curve = []; for (let p = 0; p < 100; p++) { const sel = g.filter((r) => r[k] != null && r[k] >= p); curve.push(sel.length >= 10 ? r1(100 * sel.filter((r) => r.leader).length / sel.length) : null); }
        T[k].baseRateAtOrAbove = curve;
      }
    }
    const C = {};
    for (const [k, vals] of [["order", ["bull order", "mixed", "bear order"]], ["position", ["above all", "between", "below all"]]]) {
      C[k] = vals.map((v) => { const sel = g.filter((r) => r[k] === v); return { value: v, n: sel.length, leaders: sel.filter((r) => r.leader).length, chance: sel.length ? r1(100 * sel.filter((r) => r.leader).length / sel.length) : null, shareOfLeaders: L.length ? r1(100 * sel.filter((r) => r.leader).length / L.length) : null }; });
    }
    const posRev = (r) => r.revG != null && r.revG > 0;
    C.revenueGrowing = [true, false].map((v) => { const sel = g.filter((r) => r.revG != null && posRev(r) === v); return { value: v ? "revenue up" : "revenue flat/down", n: sel.length, chance: sel.length ? r1(100 * sel.filter((r) => r.leader).length / sel.length) : null }; });
    out.traits[gname] = { n: g.length, leaders: L.length, baseRate: r1(base), T, C };
  }
  // the two pools have very different base rates (survivor list before 2020, the whole index after), so pooled chances
  // mix them: every number is also given for each pool on its own. Growth data covers every pre-2020 row, but after
  // 2020 only the 119 companies whose statements were fetched — mostly names that led in some year — so the 2020+
  // growth comparison is NOT on equal terms (growthCoverage says how uneven).
  if (!nested) {
    const reg = (r) => r.regime ?? (r.year < 2020 ? "estimated" : "measured");
    out.byRegime = {};
    for (const k of ["estimated", "measured"]) { const sub = rows.filter((r) => reg(r) === k); if (!sub.length) continue; const S = summarize(sub, true);
      const cov = (sel) => sel.length ? r1(100 * sel.filter((r) => r.revG != null).length / sel.length) : null;
      S.growthCoverage = { leaders: cov(sub.filter((r) => r.leader)), others: cov(sub.filter((r) => !r.leader)) };
      S.years = [Math.min(...sub.map((r) => r.year)), Math.max(...sub.map((r) => r.year))];
      out.byRegime[k] = S; }
  }
  return out;
}

export function summarizeRunStarts(rs) {
  const f = (k) => ({ med: r1(median(rs.map((r) => r[k]))), q1: r1(quantile(rs.map((r) => r[k]), 0.25)), q3: r1(quantile(rs.map((r) => r[k]), 0.75)) });
  const share = (pred) => rs.length ? r1(100 * rs.filter(pred).length / rs.length) : null;
  return { n: rs.length, monthsFromYearStart: f("monthsFromYearStart"), gainToPeak: f("gainToPeak"), rs: f("rs"), fromHigh: f("fromHigh"), rsiPct: f("rsiPct"), revG: f("revG"),
    lowBeforeYear: share((r) => r.monthsFromYearStart <= 0), bullOrderAtLow: share((r) => r.order === "bull order"), belowAllAtLow: share((r) => r.position === "below all"), aboveAllAtLow: share((r) => r.position === "above all") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const conc = JSON.parse(fs.readFileSync(opt("--conc"), "utf8"));
  const t0 = Date.now(), out = run(opt("--fmp"), conc); fs.writeFileSync(opt("--out") ?? "leaders-traits.json", JSON.stringify(out));
  console.log(`done in ${Date.now() - t0} ms; rows ${out.rows.length}`);
  for (const g of ["all", "comparable"]) { const G = out.summary.traits[g]; console.log(g, "n", G.n, "leaders", G.leaders, "base", G.baseRate);
    for (const k of ["rs", "fromHigh", "rsiPct", "revG", "niG", "w"]) console.log("  ", k, "L", G.T[k].leaders.med, `[${G.T[k].leaders.q1}..${G.T[k].leaders.q3}]`, "O", G.T[k].others.med, `[${G.T[k].others.q1}..${G.T[k].others.q3}]`);
    console.log("  order", JSON.stringify(G.C.order)); console.log("  position", JSON.stringify(G.C.position)); console.log("  rev", JSON.stringify(G.C.revenueGrowing));
    console.log("  rsRank curve", G.T.rsRank.baseRateAtOrAbove.filter((_, i) => i % 10 === 0).join(" ")); }
  console.log("runStarts", JSON.stringify(out.runStartSummary));
}
