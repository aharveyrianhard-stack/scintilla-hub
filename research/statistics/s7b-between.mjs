/* S7b · BETWEEN REPORTS: what was true at the real reversals — found, not assumed (descriptive, prior bars only)
   Alan, 27 Sep: "Think of the periods between earnings reports … Why are you setting conditions instead of finding
   conditions? … When there was a reversal, what were the factors that coincided there?"

   1. Unit = the stretch between two reports: the closes after report k's news session up to the last close before
      report k+1's (between.mjs → stretches). Names with ≥ 8 listed report sessions in their own history.
   2. Discovery: in each stretch, the hindsight best entry (lowest close before the exit close) and every ±5-session
      swing low / high. Every factor (between.mjs) at those closes vs at every ordinary close of the stretch → lift.
   3. Conditions come from the data: every "below / at or above a bin edge" cut and every cloud state, scored by
      lift at the hindsight lows on 2003–2016 only (coverage 3–50% of ordinary closes); the 12 best (at most two per
      family) form singles, pairs and triples of different families. Trade = enter at the first close in the stretch
      where every part holds, exit at the last close before the report (primary), the report session's close and
      five sessions after it. Confirm on stretches ending 2017 onward. Flag ≥ 65% / ≥ 70% with ≥ 200 trades in BOTH.
   4. Sell the news: the 30 largest names and the eight Station targets, share of reports followed by a drop.

   node research/statistics/s7b-between.mjs --cache <dir>     → data/s7b-between.json. Survivors only. Nothing predicts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { runupStudy, reportTiming, reportSession, rsiWilder, spread } from "./stats.mjs";
import { rsiOwnPercentile, wilson } from "./entries.mjs";
import { FACTORS, CLOUD_STATES, binOf, factorSeries, stretches, reversalsIn, swingPivots, condHolds, condKey, stretchTrade, liftTable } from "./between.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CACHE = args.includes("--cache") ? args[args.indexOf("--cache") + 1] : null;
if (!CACHE) { console.error("--cache <dir> is required"); process.exit(2); }
const SPLIT_YEAR = 2017, MIN_TRADES = 200, MIN_REPORTS = 8, POOL = 12, PER_FAMILY = 2, COVER_MIN = 3, COVER_MAX = 50;
const TARGETS = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"];   // public.station_targets, 25 Sep (build.mjs)
const FUNDS = new Set(["SPY", "QQQ", "DIA", "IWM", "SMH", "RSP", "GLD", "TLT"]);

const earnings = JSON.parse(fs.readFileSync(path.join(here, "data/earnings-export-with-estimates-20260926.json"), "utf8"));
const caps = JSON.parse(fs.readFileSync(path.join(here, "data/meta-cohorts-caps-20260926.json"), "utf8")).caps;
const byTicker = new Map();
for (const r of earnings) { if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []); byTicker.get(r.ticker).push(r); }
const tOf = (b) => { const x = b.t ?? b.time ?? b.ts ?? b.timestamp; return x < 1e11 ? x * 1000 : x; };
const day = (t) => new Date(t).toISOString().slice(0, 10);
const load = (t) => { const f = path.join(CACHE, t + ".json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).map((b) => ({ t: tOf(b), h: +b.h, l: +b.l, c: +b.c })) : null; };

// SPY's own RSI percentile, by date
const spyBars = load("SPY");
const spyPct = rsiOwnPercentile(rsiWilder(spyBars.map((b) => b.c), 14));
const spyByDate = new Map(spyBars.map((b, i) => [day(b.t), spyPct[i]]));

const PERIODS = ["all", "discover", "confirm"];
const KINDS = ["ordinary", "best", "swingLow", "swingHigh"];
const zeroCounts = (nb) => Object.fromEntries(KINDS.map((k) => [k, new Array(nb).fill(0)]));
const dist = Object.fromEntries(PERIODS.map((p) => [p, Object.fromEntries([...FACTORS.map((f) => [f.key, zeroCounts(f.edges.length + 1)]),
  ["cloud", zeroCounts(CLOUD_STATES.length)]])]));
const rawAtBest = Object.fromEntries(FACTORS.map((f) => [f.key, { best: [], ordinary: [] }]));   // all periods, for medians
const stretchFacts = { len: [], best_since: [], best_to_exit: [], start_to_exit: [], best_to_report_close: [], best_to_after5: [] };

const names = []; const missing = []; let nStretches = 0;
for (const [t, reps] of byTicker) {
  if (FUNDS.has(t)) continue;
  const raw = load(t);
  if (!raw || raw.length < 400) { missing.push(t); continue; }
  const st = runupStudy(raw, reps);                                      // only for the name's own-history segment
  const seg = raw.filter((b) => day(b.t) >= st.analysis_start);
  const dates = seg.map((b) => day(b.t));
  // every listed report inside the name's own history, as its news session (a report dated before the first bar is skipped)
  const rs = [...new Set(reps.map((rep) => String(rep.date).slice(0, 10)).filter((d) => d > dates[0])
    .map((d) => reportSession(dates, d, reportTiming(reps.find((x) => String(x.date).slice(0, 10) === d).report_time).rule))
    .filter((r) => r != null && r > 0))].sort((a, b) => a - b);
  if (rs.length < MIN_REPORTS) continue;
  const fs_ = factorSeries(seg, rs, dates.map((d) => spyByDate.get(d) ?? null));
  const piv = swingPivots(fs_.highs, fs_.lows);
  const sts = stretches(rs, seg.length).filter((s) => s.x + 1 < seg.length).map((s) => ({ ...s,
    period: +dates[s.r].slice(0, 4) < SPLIT_YEAR ? "discover" : "confirm" }));
  if (!sts.length) continue;
  for (const s of sts) {
    const rv = reversalsIn(s, fs_.closes, piv); s.best = rv.best;
    const add = (kind, i) => {
      for (const p of ["all", s.period]) {
        for (const f of FACTORS) { const b = binOf(fs_.F[f.key][i], f.edges); if (b >= 0) dist[p][f.key][kind][b]++; }
        const ci = CLOUD_STATES.indexOf(fs_.cloud[i]); if (ci >= 0) dist[p].cloud[kind][ci]++;
      }
      if (kind === "best" || kind === "ordinary") for (const f of FACTORS) { const v = fs_.F[f.key][i]; if (v != null && Number.isFinite(v)) rawAtBest[f.key][kind].push(v); }
    };
    for (let i = s.s; i < s.x; i++) add("ordinary", i);
    add("best", rv.best);
    for (const k of rv.swingLows) add("swingLow", k);
    for (const k of rv.swingHighs) add("swingHigh", k);
    const c = fs_.closes, pct = (a, b) => b < c.length ? (c[b] / c[a] - 1) * 100 : null;
    stretchFacts.len.push(s.x - s.s + 1); stretchFacts.best_since.push(rv.best - s.s + 1);
    stretchFacts.best_to_exit.push(pct(rv.best, s.x)); stretchFacts.start_to_exit.push(pct(s.s, s.x));
    stretchFacts.best_to_report_close.push(pct(rv.best, s.r)); stretchFacts.best_to_after5.push(pct(rv.best, s.r + 5));
  }
  nStretches += sts.length;
  names.push({ t, closes: fs_.closes, F: fs_.F, cloud: fs_.cloud, sts, events: st.events, seg, dates });
}

/* ---- 2 · distributions and lift ---- */
const r2 = (x) => x == null ? null : Math.round(x * 100) / 100;
const lifts = {};
for (const p of PERIODS) {
  lifts[p] = {};
  for (const f of FACTORS) { const lt = liftTable(dist[p][f.key], f.edges); lifts[p][f.key] = { totals: lt.totals, rows: lt.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? r2(v) : v]))) }; }
  const cl = dist[p].cloud, tot = Object.fromEntries(KINDS.map((k) => [k, cl[k].reduce((a, b) => a + b, 0)]));
  lifts[p].cloud = { totals: tot, rows: CLOUD_STATES.map((s, b) => { const sh = (k) => tot[k] ? 100 * cl[k][b] / tot[k] : null, o = sh("ordinary");
    return { bin: s, ordinary: r2(o), best: r2(sh("best")), swingLow: r2(sh("swingLow")), swingHigh: r2(sh("swingHigh")),
      lift_best: o ? r2(sh("best") / o) : null, lift_swingLow: o ? r2(sh("swingLow") / o) : null, lift_swingHigh: o ? r2(sh("swingHigh") / o) : null, n_best: cl.best[b], n_swingLow: cl.swingLow[b] }; }) };
}
const medians = Object.fromEntries(FACTORS.map((f) => [f.key, { at_best_low: r2(spread(rawAtBest[f.key].best).median), ordinary: r2(spread(rawAtBest[f.key].ordinary).median),
  best_q25: r2(spread(rawAtBest[f.key].best).q25), best_q75: r2(spread(rawAtBest[f.key].best).q75) }]));

/* ---- 3 · conditions the data suggests (discover only) ---- */
const cands = [];
const cum = (arr, from, to) => { let s = 0; for (let b = from; b < to; b++) s += arr[b]; return s; };
for (const f of FACTORS) {
  const d = dist.discover[f.key], nb = f.edges.length + 1, T = Object.fromEntries(KINDS.map((k) => [k, cum(d[k], 0, nb)]));
  f.edges.forEach((edge, e) => {
    for (const [side, from, to] of [["lt", 0, e + 1], ["ge", e + 1, nb]]) {
      const cover = 100 * cum(d.ordinary, from, to) / T.ordinary;
      if (cover < COVER_MIN || cover > COVER_MAX) continue;
      const liftB = (cum(d.best, from, to) / T.best) / (cum(d.ordinary, from, to) / T.ordinary);
      const liftS = (cum(d.swingLow, from, to) / T.swingLow) / (cum(d.ordinary, from, to) / T.ordinary);
      cands.push({ factor: f.key, fam: f.fam, side, value: edge, cover: r2(cover), lift_best: r2(liftB), lift_swingLow: r2(liftS) });
    }
  });
}
{ const d = dist.discover.cloud, T = Object.fromEntries(KINDS.map((k) => [k, d[k].reduce((a, b) => a + b, 0)]));
  CLOUD_STATES.forEach((s, b) => { const cover = 100 * d.ordinary[b] / T.ordinary; if (cover < COVER_MIN || cover > COVER_MAX) return;
    cands.push({ factor: "cloud", fam: "cloud", value: s, cover: r2(cover), lift_best: r2((d.best[b] / T.best) / (d.ordinary[b] / T.ordinary)), lift_swingLow: r2((d.swingLow[b] / T.swingLow) / (d.ordinary[b] / T.ordinary)) }); }); }
cands.sort((a, b) => b.lift_best - a.lift_best);
const pool = [], famCount = {};
for (const c of cands) { if (pool.length >= POOL) break; if ((famCount[c.fam] || 0) >= PER_FAMILY) continue; famCount[c.fam] = (famCount[c.fam] || 0) + 1; pool.push({ ...c, key: condKey(c) }); }

const combos = [{ key: "stretch start (buy the close after the report)", parts: [], fams: [] }];
for (let a = 0; a < pool.length; a++) {
  combos.push({ key: pool[a].key, parts: [a], fams: [pool[a].fam] });
  for (let b = a + 1; b < pool.length; b++) {
    if (pool[a].fam === pool[b].fam) continue;
    combos.push({ key: `${pool[a].key} + ${pool[b].key}`, parts: [a, b] });
    for (let c = b + 1; c < pool.length; c++) {
      if (pool[c].fam === pool[a].fam || pool[c].fam === pool[b].fam) continue;
      combos.push({ key: `${pool[a].key} + ${pool[b].key} + ${pool[c].key}`, parts: [a, b, c] });
    }
  }
}
const accNew = () => ({ stretches: 0, dates: [], primary: [], reportDay: [], after5: [], wait: [], held: [], base: [], names: new Set() });
const acc = combos.map(() => Object.fromEntries(PERIODS.map((p) => [p, accNew()])));
const hind = Object.fromEntries(PERIODS.map((p) => [p, accNew()]));
for (const nm of names) {
  const holds = pool.map((c) => { const a = new Uint8Array(nm.closes.length); for (let i = 0; i < a.length; i++) a[i] = condHolds(c, nm.F, nm.cloud, i) ? 1 : 0; return a; });
  for (const s of nm.sts) {
    const baseTr = stretchTrade(nm.closes, s, () => true);
    const best = stretchTrade(nm.closes, s, (e) => e === s.best);
    for (const p of ["all", s.period]) { const h = hind[p]; h.stretches++; if (best) { h.primary.push(best.primary); h.reportDay.push(best.reportDay); h.after5.push(best.after5); h.held.push(best.held); h.wait.push(best.wait); } }
    combos.forEach((cb, ci) => {
      const tr = stretchTrade(nm.closes, s, (e) => cb.parts.every((q) => holds[q][e]));
      for (const p of ["all", s.period]) {
        const a = acc[ci][p]; a.stretches++;
        if (!tr || tr.primary == null) continue;
        a.primary.push(tr.primary); a.reportDay.push(tr.reportDay); a.after5.push(tr.after5); a.wait.push(tr.wait); a.held.push(tr.held);
        a.base.push(baseTr?.primary); a.names.add(nm.t); a.dates.push(nm.dates[tr.entry]);
      }
    });
  }
}
function row(a) {
  const s = spread(a.primary), rd = spread(a.reportDay), a5 = spread(a.after5), b = spread(a.base);
  return { stretches: a.stretches, trades: s.n, fire_rate: a.stretches ? r2(100 * s.n / a.stretches) : null, names: a.names?.size ?? null,
    share_up: r2(s.share_positive), ci95: wilson(s.positive, s.n).map(r2), median: r2(s.median), q25: r2(s.q25), q75: r2(s.q75),
    median_wait: spread(a.wait).median, median_held: spread(a.held).median,
    to_report_close: { share_up: r2(rd.share_positive), median: r2(rd.median) }, to_five_after: { n: a5.n, share_up: r2(a5.share_positive), median: r2(a5.median) },
    same_stretches_from_start: { share_up: r2(b.share_positive), median: r2(b.median) } };
}
/* Trades on the same days across names are one market event, not many. For a rule: how many distinct entry days and
   months, how much of it sits in its three busiest months, and the share up when every month counts once. */
function clustering(a) {
  const byMonth = new Map(), byYear = new Map();
  a.dates.forEach((d, i) => { const m = d.slice(0, 7), y = d.slice(0, 4);
    if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(a.primary[i]);
    if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(a.primary[i]); });
  const sizes = [...byMonth.values()].map((v) => v.length).sort((x, y) => y - x);
  const top3 = sizes.slice(0, 3).reduce((s, x) => s + x, 0);
  const monthShares = [...byMonth.values()].map((v) => v.filter((x) => x > 0).length / v.length);
  const busiest = [...byMonth.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 5).map(([m, v]) => ({ month: m, trades: v.length, share_up: r2(100 * v.filter((x) => x > 0).length / v.length) }));
  return { entry_days: new Set(a.dates).size, entry_months: byMonth.size, top3_months_pct: a.dates.length ? r2(100 * top3 / a.dates.length) : null,
    share_up_month_weighted: monthShares.length ? r2(100 * monthShares.reduce((s, x) => s + x, 0) / monthShares.length) : null, busiest_months: busiest,
    by_year: [...byYear.entries()].sort().map(([y, v]) => ({ year: y, trades: v.length, share_up: r2(100 * v.filter((x) => x > 0).length / v.length) })) };
}
const rows = combos.map((c, ci) => ({ key: c.key, size: c.parts.length, ...Object.fromEntries(PERIODS.map((p) => [p, row(acc[ci][p])])),
  clustering: Object.fromEntries(PERIODS.map((p) => [p, clustering(acc[ci][p])])) }));
const flag = (thr) => rows.filter((r) => r.size >= 1 && r.discover.trades >= MIN_TRADES && r.confirm.trades >= MIN_TRADES && r.discover.share_up >= thr && r.confirm.share_up >= thr).map((r) => r.key);
const chosenOnDiscover = rows.filter((r) => r.size >= 1 && r.discover.trades >= MIN_TRADES).sort((a, b) => b.discover.share_up - a.discover.share_up).slice(0, 20)
  .map((r) => ({ key: r.key, size: r.size, discover: r.discover, confirm: r.confirm, clustering: r.clustering }));

/* ---- 4 · sell the news ---- */
const largest = names.map((n) => n.t).filter((t) => caps[t] > 0).sort((a, b) => caps[b] - caps[a]).slice(0, 30);
const snNames = [...new Set([...largest, ...TARGETS])];
const sellNews = snNames.map((t) => {
  const nm = names.find((n) => n.t === t); if (!nm) return { ticker: t, missing: true };
  const c = nm.closes, idx = new Map(nm.dates.map((d, i) => [d, i]));
  const ev = nm.events.map((e) => { const r = idx.get(e.session); return { date: e.date, day: e.day_pct, after5: e.after_pct,
    news5: r != null && r + 4 < c.length ? (c[r + 4] / c[r - 1] - 1) * 100 : null }; }).filter((e) => e.after5 != null && e.news5 != null);
  const block = (list) => { const d = spread(list.map((e) => e.day)), a = spread(list.map((e) => e.after5)), n5 = spread(list.map((e) => e.news5));
    return { reports: list.length, day_down: r2(100 - d.share_positive), day_median: r2(d.median),
      news5_down: r2(100 - n5.share_positive), news5_median: r2(n5.median), after5_down: r2(100 - a.share_positive), after5_median: r2(a.median) }; };
  return { ticker: t, target: TARGETS.includes(t), cap_rank: largest.indexOf(t) + 1 || null, all: block(ev), last8: block(ev.slice(-8)),
    last8_rows: ev.slice(-8).map((e) => ({ date: e.date, day: r2(e.day), news5: r2(e.news5), after5: r2(e.after5) })) };
});

const med = (a) => r2(spread(a).median);
const out = {
  built_utc: new Date().toISOString(), study: "S7b between reports — reversal discovery",
  names: names.length, stretches: nStretches, split: { discover: `stretches whose closing report is dated before ${SPLIT_YEAR}`, confirm: `${SPLIT_YEAR} onward` },
  min_trades: MIN_TRADES, pool_rule: { size: POOL, per_family: PER_FAMILY, cover_min_pct: COVER_MIN, cover_max_pct: COVER_MAX, ranked_by: "lift at the hindsight best entry, discover years" },
  stretch_facts: { median_len: med(stretchFacts.len), median_best_since: med(stretchFacts.best_since), best_since_q25: r2(spread(stretchFacts.best_since).q25), best_since_q75: r2(spread(stretchFacts.best_since).q75),
    median_best_to_exit: med(stretchFacts.best_to_exit), median_start_to_exit: med(stretchFacts.start_to_exit), start_to_exit_up: r2(spread(stretchFacts.start_to_exit).share_positive),
    median_best_to_report_close: med(stretchFacts.best_to_report_close), median_best_to_after5: med(stretchFacts.best_to_after5) },
  factors: FACTORS.map(({ key, fam, label, edges }) => ({ key, fam, label, edges })), cloud_states: CLOUD_STATES,
  lifts, medians, candidates: cands, pool, combos_tested: combos.length - 1, rows, hindsight: Object.fromEntries(PERIODS.map((p) => [p, row(hind[p])])),
  chosen_on_discover: chosenOnDiscover, flagged: { at65: flag(65), at70: flag(70) },
  sell_the_news: sellNews, largest30: largest, targets: TARGETS, missing_bars: missing,
  caveats: ["survivors only: today's universe", "trades on the same dates across names move together; the 95% interval treats them as independent and is too narrow",
    `${combos.length - 1} rules were tried, chosen on 2003–2016 and read untouched on 2017 onward`, "descriptive; no prediction; no costs or slippage",
    "the hindsight entry and the swing points use later bars by design (they are the labels); every factor uses bars up to that close only"],
};
fs.writeFileSync(path.join(here, "data/s7b-between.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ names: names.length, stretches: nStretches, pool: pool.map((p) => `${p.key} (${p.lift_best})`), combos: combos.length - 1,
  at65: out.flagged.at65.length, at70: out.flagged.at70.length, top: chosenOnDiscover.slice(0, 5).map((r) => [r.key, r.discover.share_up, r.discover.trades, r.confirm.share_up, r.confirm.trades]), missing: missing.length }));
