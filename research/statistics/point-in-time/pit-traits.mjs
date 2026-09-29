/* N9 · LEADERS 2 again, on the point-in-time pool: traits on the last close before the leadership year, leaders
   (that year's top 20 contributors, point-in-time) against every other company that was an S&P 500 member that day.
   node research/statistics/point-in-time/pit-traits.mjs --conc <pit-concentration.json> [--out <file>]
   Same trait definitions as leaders-traits.mjs (traitsAt, summarize). Growth is NOT re-read unless --fund <file> names
   the statements pulled on Fly by fetch-statements-fly.mjs (one JSON line per company); with it, trailing-four-quarter
   revenue and net-income growth is read from quarters FILED before the date, exactly as leaders-traits does. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadPit, capOn, atOrBefore, repairedBars } from "./pit-data.mjs";
import { traitsAt, summarize, ttmGrowth, LOOKBACK_52W } from "../leaders-traits.mjs";

/** statements.jsonl → Map sym → rows in the shape ttmGrowth reads ({date, filingDate, revenue, netIncome}). */
export function loadStatements(file) {
  const fund = new Map(); let errors = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith("{")) continue; let o; try { o = JSON.parse(line); } catch { continue; }
    if (!o.s) continue; if (o.err) { errors++; continue; } if (!Array.isArray(o.q) || !o.q.length) continue;   // FMP has nothing for the name: counted as "no statements"
    fund.set(o.s, o.q.map(([date, filingDate, revenue, netIncome]) => ({ date, filingDate: filingDate ? String(filingDate).slice(0, 10) : date, revenue, netIncome })));
  }
  return { fund, errors };
}
import { s9Series, loadBars, dstr } from "../leaders-lib.mjs";
import { CLASS_OF } from "./pit-leaders.mjs";

export function run(conc, { fund = null } = {}) {
  const P = loadPit(), cache = new Map();
  const S = (sym) => { if (!cache.has(sym)) { const s = P.series(sym); cache.set(sym, s && s.c.length > LOOKBACK_52W + 5 ? s9Series(repairedBars(s)) : null); } return cache.get(sym); };
  const spyL = loadBars("SPY"), spy = { dates: spyL.bars.map((b) => dstr(b.t)), c: spyL.bars.map((b) => +b.c) };
  const rows = [], coverage = [];
  for (const Y of conc.years) {
    if (Y.year < 2005) continue; // SPY bars in the cache start Sep 2003; one year of history is needed
    const d0 = spy.dates[atOrBefore(spy.dates, `${Y.year - 1}-12-31`)];
    const leaders = new Set(Y.top20.map((x) => x.sym));
    const mem = P.members("SP500", d0).filter((s) => !(s in CLASS_OF));
    const caps = mem.map((s) => [s, capOn(P, s, d0)]), tot = caps.reduce((a, [, c]) => a + (c ?? 0), 0);
    const measured = [];
    for (const [sym, cap] of caps) {
      const s = S(sym); if (!s || cap == null) continue;
      const i = atOrBefore(s.dates, d0); if (i < 0 || Date.parse(d0) - Date.parse(s.dates[i]) > 10 * 864e5) continue;
      const t = traitsAt(s, i, spy); if (!t) continue;
      const g = fund && fund.has(sym) ? ttmGrowth(fund.get(sym), d0) : null;
      measured.push({ year: Y.year, regime: Y.year < 2020 ? "estimated" : "measured", sym, leader: leaders.has(sym), w: 100 * cap / tot, ...t, revG: g?.rev ?? null, niG: g?.ni ?? null, turned: g?.turned ?? null });
    }
    const rank = (k) => { const xs = measured.map((m) => m[k]).filter((x) => x != null); for (const m of measured) m[k + "Rank"] = m[k] == null ? null : 100 * (xs.filter((x) => x < m[k]).length + 0.5 * (xs.filter((x) => x === m[k]).length - 1)) / Math.max(1, xs.length - 1); };
    rank("rs"); rank("w"); rank("fromHigh"); if (fund) { rank("revG"); rank("niG"); }
    const minLeaderW = Math.min(...measured.filter((m) => m.leader).map((m) => m.w));
    for (const m of measured) m.comparableSize = m.w >= minLeaderW;
    coverage.push({ year: Y.year, members: mem.length, measured: measured.length, leadersMeasured: measured.filter((m) => m.leader).length });
    rows.push(...measured);
  }
  const summary = summarize(rows), out = { generated: new Date().toISOString(), kind: "Leaders 2 on the point-in-time pool", summary, coverage };
  if (fund) { const pool = new Set(rows.map((r) => r.sym)); const reg = (k) => summary.byRegime[k];
    out.growth = { source: "FMP quarterly income statements pulled inside Fly (fetch-statements-fly.mjs), quarters filed before the date", namesInPool: pool.size, namesWithStatements: [...pool].filter((s) => fund.has(s)).length,
      estimated: { revenueGrowing: reg("estimated").traits.all.C.revenueGrowing, revenueGrowingComparable: reg("estimated").traits.comparable.C.revenueGrowing, coverage: reg("estimated").growthCoverage, revG: { leaders: reg("estimated").traits.all.T.revG.leaders.med, others: reg("estimated").traits.all.T.revG.others.med }, niG: { leaders: reg("estimated").traits.all.T.niG.leaders.med, others: reg("estimated").traits.all.T.niG.others.med } },
      measured: { revenueGrowing: reg("measured").traits.all.C.revenueGrowing, revenueGrowingComparable: reg("measured").traits.comparable.C.revenueGrowing, coverage: reg("measured").growthCoverage, revG: { leaders: reg("measured").traits.all.T.revG.leaders.med, others: reg("measured").traits.all.T.revG.others.med }, niG: { leaders: reg("measured").traits.all.T.niG.leaders.med, others: reg("measured").traits.all.T.niG.others.med } } }; }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const st = opt("--fund") ? loadStatements(opt("--fund")) : null; if (st) console.log("statements for", st.fund.size, "names,", st.errors, "errors");
  const out = run(JSON.parse(fs.readFileSync(opt("--conc"), "utf8")), { fund: st?.fund ?? null }); fs.writeFileSync(opt("--out") ?? "pit-traits.json", JSON.stringify(out));
  if (out.growth) console.log("growth", JSON.stringify(out.growth));
  for (const k of ["estimated", "measured"]) { const G = out.summary.byRegime[k]; console.log(k, "n", G.n, "base", G.baseRate, "order", G.traits.all.C.order.map((o) => o.chance).join("/"), "rsiPct L/O", G.traits.all.T.rsiPct.leaders.med, G.traits.all.T.rsiPct.others.med, "rs L/O", G.traits.all.T.rs.leaders.med, G.traits.all.T.rs.others.med, "rsTop10", G.traits.all.T.rsRank.baseRateAtOrAbove[90], "w L/O", G.traits.all.T.w.leaders.med, G.traits.all.T.w.others.med, "fromHigh L/O", G.traits.all.T.fromHigh.leaders.med, G.traits.all.T.fromHigh.others.med); }
  console.log("coverage", out.coverage.map((c) => `${c.year}:${c.measured}/${c.members}(${c.leadersMeasured})`).join(" "));
}
