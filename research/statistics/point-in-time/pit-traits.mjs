/* N9 · LEADERS 2 again, on the point-in-time pool: traits on the last close before the leadership year, leaders
   (that year's top 20 contributors, point-in-time) against every other company that was an S&P 500 member that day.
   node research/statistics/point-in-time/pit-traits.mjs --conc <pit-concentration.json> [--out <file>]
   Same trait definitions as leaders-traits.mjs (traitsAt, summarize). Growth is NOT re-read: FMP statements were
   fetched for 119 names only, so revenue / net-income growth stays out of this re-run. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadPit, capOn, atOrBefore, repairedBars } from "./pit-data.mjs";
import { traitsAt, summarize, LOOKBACK_52W } from "../leaders-traits.mjs";
import { s9Series, loadBars, dstr } from "../leaders-lib.mjs";
import { CLASS_OF } from "./pit-leaders.mjs";

export function run(conc) {
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
      measured.push({ year: Y.year, regime: Y.year < 2020 ? "estimated" : "measured", sym, leader: leaders.has(sym), w: 100 * cap / tot, ...t, revG: null, niG: null, turned: null });
    }
    const rank = (k) => { const xs = measured.map((m) => m[k]).filter((x) => x != null); for (const m of measured) m[k + "Rank"] = m[k] == null ? null : 100 * (xs.filter((x) => x < m[k]).length + 0.5 * (xs.filter((x) => x === m[k]).length - 1)) / Math.max(1, xs.length - 1); };
    rank("rs"); rank("w"); rank("fromHigh");
    const minLeaderW = Math.min(...measured.filter((m) => m.leader).map((m) => m.w));
    for (const m of measured) m.comparableSize = m.w >= minLeaderW;
    coverage.push({ year: Y.year, members: mem.length, measured: measured.length, leadersMeasured: measured.filter((m) => m.leader).length });
    rows.push(...measured);
  }
  return { generated: new Date().toISOString(), kind: "Leaders 2 on the point-in-time pool", summary: summarize(rows), coverage };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const out = run(JSON.parse(fs.readFileSync(opt("--conc"), "utf8"))); fs.writeFileSync(opt("--out") ?? "pit-traits.json", JSON.stringify(out));
  for (const k of ["estimated", "measured"]) { const G = out.summary.byRegime[k]; console.log(k, "n", G.n, "base", G.baseRate, "order", G.traits.all.C.order.map((o) => o.chance).join("/"), "rsiPct L/O", G.traits.all.T.rsiPct.leaders.med, G.traits.all.T.rsiPct.others.med, "rs L/O", G.traits.all.T.rs.leaders.med, G.traits.all.T.rs.others.med, "rsTop10", G.traits.all.T.rsRank.baseRateAtOrAbove[90], "w L/O", G.traits.all.T.w.leaders.med, G.traits.all.T.w.others.med, "fromHigh L/O", G.traits.all.T.fromHigh.leaders.med, G.traits.all.T.fromHigh.others.med); }
  console.log("coverage", out.coverage.map((c) => `${c.year}:${c.measured}/${c.members}(${c.leadersMeasured})`).join(" "));
}
