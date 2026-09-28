/* METHOD DEMO · three tests of the standard on SPY, read-only from the durable bar cache (chart API daily bars copied
   27–28 Sep). node research/statistics/method/method-demo.mjs [--out <json>]
   A · "More than 10% below the 200-day → up 60 sessions later 61.5%" (S9 band table): the naive interval that treats
       275 days as 275 coin flips, against a stationary-bootstrap interval that resamples runs of days, and the
       effective number of independent observations behind the 275.
   B · 100 RSI rungs (own 3-year percentile, S8 rule) × 20-session forward result vs any day: a bootstrap p-value per
       rung, how many "beat luck" at 10%, and how many survive Benjamini–Hochberg at a 10% false-discovery rate.
   C · Walk-forward: S8's "SPY RSI bottom 10% above the 200-day → up 74.8%" measured on 2004–2015 alone and 2016–2026 alone. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { cleanBars, seriesOf, MAX_WICK } from "../s9-research.mjs";
import * as M from "./method-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const args = process.argv.slice(2), opt = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const OUT = opt("--out", path.join(ROOT, "deliverables/20260928/statistician/method-demo.json"));
const CACHE = opt("--cache-root", path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache"));
function loadBars(sym) {
  for (const d of ["daily-bars-s9", "daily-bars-rsi", "candles-f5", "daily-bars-s7"]) {
    const f = path.join(CACHE, d, sym + ".json"); if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8")); const s = Array.isArray(j) ? j : j.series; if (s?.length) return { bars: s, src: d };
  }
  throw new Error("no cached bars for " + sym);
}
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10, r2 = (x) => x == null ? null : Math.round(x * 100) / 100, r3 = (x) => x == null ? null : Math.round(x * 1000) / 1000;

const { bars: raw, src } = loadBars("SPY");
const { bars } = cleanBars(raw, MAX_WICK.default);
const S = seriesOf(bars), n = S.c.length;
const fwd = (i, h) => i + h < n ? (S.c[i + h] / S.c[i] - 1) * 100 : null;
const rows = S.dates.map((d, i) => ({ i, date: d, close: S.c[i], rsi: S.rsi[i], pct: S.pct[i], d200: S.ma.s200[i] > 0 ? (S.c[i] / S.ma.s200[i] - 1) * 100 : null, above200: S.ma.s200[i] > 0 ? S.c[i] > S.ma.s200[i] : null, f20: fwd(i, 20), f60: fwd(i, 60) }));
const out = { generated: new Date().toISOString(), source: { symbol: "SPY", cache: src, bars: n, from: S.dates[0], to: S.dates[n - 1] } };

/* ---------- A ---------- */
{
  const valid = rows.filter((r) => r.d200 != null && r.f60 != null);
  const deep = valid.filter((r) => r.d200 < -10);
  const k = deep.filter((r) => r.f60 > 0).length, nd = deep.length;
  const naive = M.wilson(k, nd);
  const anyDay = M.share(valid.map((r) => r.f60));
  const onFlags = rows.map((r) => r.d200 != null && r.d200 < -10);
  const eps = M.episodes(onFlags);
  const runs = []; { let cur = 0; for (const f of onFlags) { if (f) cur++; else if (cur) { runs.push(cur); cur = 0; } } if (cur) runs.push(cur); }
  const block = M.blockLength(valid.map((r) => r.f60), 60);
  const stat = (rs) => { const g = rs.filter((r) => r.d200 < -10); return g.length >= 20 ? 100 * M.share(g.map((r) => r.f60)) : null; };
  const boot = M.stationaryBootstrap(valid, stat, { block, reps: 2000, seed: 11 });
  const essF60 = M.effectiveN(valid.map((r) => r.f60));
  out.A = {
    question: "SPY more than 10% below its 200-day: share up 60 sessions later",
    days: nd, up: k, share: r1(100 * k / nd), anyDay: r1(100 * anyDay),
    naive90: [r1(100 * naive.lo), r1(100 * naive.hi)], naiveNote: "Wilson interval, treats every day as an independent coin flip",
    block, bootstrap90: [r1(boot.lo), r1(boot.hi)], bootstrapNote: `stationary bootstrap, mean block ${block} sessions, 2,000 draws; the share is left empty in a draw with fewer than 20 qualifying days`,
    pAnyDay: r3(M.bootstrapP(boot.draws, 100 * anyDay)),
    episodes: eps.length, runLengths: runs, medianRun: M.median(runs),
    episodeYears: [...new Set(eps.map((i) => S.dates[i].slice(0, 4)))],
    effectiveNAllDays60: Math.round(essF60), allDays: valid.length,
    effectiveNDeep: r1(nd / (1 + 2 * Math.max(0, M.dependenceSpan(deep.map((r) => r.f60)).sum))),
  };
}
/* ---------- B ---------- */
{
  const valid = rows.filter((r) => r.pct != null && r.f20 != null);
  const anyMed = M.median(valid.map((r) => r.f20));
  const block = M.blockLength(valid.map((r) => r.f20), 20);
  const rungs = [];
  for (let q = 1; q <= 100; q++) {
    const inRung = (r) => r.pct > q - 1 && r.pct <= q;
    const g = valid.filter(inRung);
    const stat = (rs) => { const h = rs.filter(inRung); return h.length >= 10 ? M.median(h.map((r) => r.f20)) : null; };
    const boot = M.stationaryBootstrap(valid, stat, { block, reps: 400, seed: 100 + q });
    rungs.push({ rung: q, days: g.length, median20: r2(M.median(g.map((r) => r.f20))), lo: r2(boot.lo), hi: r2(boot.hi), p: r3(M.bootstrapP(boot.draws, anyMed)) });
  }
  const p = rungs.map((r) => r.p ?? 1);
  const bh10 = M.benjaminiHochberg(p, 0.10), bh05 = M.benjaminiHochberg(p, 0.05);
  const rawHits = rungs.filter((r) => r.p != null && r.p < 0.10);
  out.B = {
    question: "100 RSI rungs (own prior-3-year percentile) × median 20-session result vs any day",
    anyDayMedian20: r2(anyMed), block, reps: 400, rungs,
    rawBelow10pct: rawHits.map((r) => r.rung), rawCount: rawHits.length, expectedByLuck: 10,
    survivorsFDR10: rungs.filter((_, i) => bh10.reject[i]).map((r) => r.rung), survivorsFDR05: rungs.filter((_, i) => bh05.reject[i]).map((r) => r.rung),
    note: "A p-value under 0.10 on 100 rungs is expected about 10 times by luck alone. Benjamini–Hochberg keeps the share of false claims among the survivors under the stated rate.",
  };
}
/* ---------- C ---------- */
{
  const cond = (r) => r.pct != null && r.pct <= 10 && r.above200 === true && r.f20 != null;
  const halves = [["2004–2015", (r) => r.date < "2016-01-01"], ["2016–2026", (r) => r.date >= "2016-01-01"], ["all", () => true]];
  out.C = { question: "SPY RSI in its bottom 10% (own 3-year percentile) while above the 200-day: share up 20 sessions later — each half of history alone", splits: [] };
  for (const [label, f] of halves) {
    const valid = rows.filter((r) => r.f20 != null && r.above200 === true && r.pct != null && f(r));
    const on = rows.map((r) => cond(r) && f(r)), eps = M.episodes(on);
    const hits = eps.filter((i) => rows[i].f20 > 0).length;
    const base = M.share(valid.map((r) => r.f20));
    const block = M.blockLength(valid.map((r) => r.f20), 20);
    const stat = (rs) => { const g = rs.filter(cond); return g.length >= 10 ? 100 * M.share(g.map((r) => r.f20)) : null; };
    const boot = M.stationaryBootstrap(valid, stat, { block, reps: 1500, seed: 5 });
    out.C.splits.push({ period: label, episodes: eps.length, days: rows.filter((r) => cond(r) && f(r)).length, shareEpisodesUp: r1(100 * hits / Math.max(1, eps.length)), shareDaysUp: r1(100 * M.share(rows.filter((r) => cond(r) && f(r)).map((r) => r.f20))), anyUptrendDay: r1(100 * base), bootstrap90: [r1(boot.lo), r1(boot.hi)], pAnyDay: r3(M.bootstrapP(boot.draws, 100 * base)), block });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ A: { ...out.A, runLengths: undefined }, B: { ...out.B, rungs: undefined }, C: out.C }, null, 1));
