// Quant loop run 1 · studies S1 and S2 on the 13 names' finished daily bars. Offline: reads the bytes
// fetch-bars.mjs saved, never the network. Writes one JSON file and nothing else.
//   node tools/quant-loop/run1/run.mjs <cache-dir> <out.json>
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { rsiWilder, historyCheck, BREAK_DAYS, quantile } from "../../../research/statistics/stats.mjs";
import { indexVsMembers, percentileLineCoverage, shareAtOrBelow, s2Name, williamsR, prefixStable, badHighLow } from "./studies.mjs";
import { TARGETS, FUNDS } from "../fetch-bars.mjs";

const SEED = 20260925, B = 2000, BLOCK = 20, K = 50, THRESHOLD = 0.9;
const SENS_MEMBERS_BEFORE = "2012-01-01";      // same rule the bake-off's primary universe uses

const [cache, out] = process.argv.slice(2);
if (!cache || !out) { console.error("usage: run.mjs <cache-dir> <out.json>"); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(cache, "manifest.json"), "utf8"));
const dateOf = (t) => new Date(t).toISOString().slice(0, 10);

/** The package's rule: the analysis starts after the last hole longer than BREAK_DAYS. */
function load(sym) {
  const raw = fs.readFileSync(path.join(cache, sym + ".json"));
  const j = JSON.parse(raw);
  const ser = j.series;
  const hist = historyCheck(ser, ser.map((b) => +b.c));
  let start = 0;
  for (const g of hist.gaps) if (g.days > BREAK_DAYS) start = ser.findIndex((b) => dateOf(b.t) === g.to);
  const bars = ser.slice(start).map((b) => ({ date: dateOf(b.t), o: +b.o, h: +b.h, l: +b.l, c: +b.c }));
  return { sym, bars, served: ser.length, dropped: start, response_sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    provider: j.provider, price_basis: j.price_basis, finality_verified: j.bar_finality?.verified ?? null,
    wild_moves_in_segment: hist.wild_examples.filter((w) => w.date > bars[0].date).length };
}

const names = [...TARGETS, ...FUNDS].map(load);
const by = Object.fromEntries(names.map((n) => [n.sym, n]));
const rsiBy = {};
for (const n of names) {
  const r = rsiWilder(n.bars.map((b) => b.c), 14);
  rsiBy[n.sym] = new Map(n.bars.map((b, i) => [b.date, r[i]]).filter(([, v]) => v != null));
}

function align(indexSym, members) {
  const dates = [...rsiBy[indexSym].keys()].filter((d) => members.every((m) => rsiBy[m].has(d)));
  return { dates, index: dates.map((d) => rsiBy[indexSym].get(d)),
    members: Object.fromEntries(members.map((m) => [m, dates.map((d) => rsiBy[m].get(d))])) };
}

// ---------------------------------------------------------------- S1
const sensMembers = TARGETS.filter((m) => by[m].bars[0].date < SENS_MEMBERS_BEFORE);
const s1 = {
  claim: "#42 (card U-3): Percentile mode self-calibrates; the S&P's RSI almost never reaches 30.",
  shares_all_history: Object.fromEntries(names.map((n) => [n.sym, { first: n.bars[0].date, last: n.bars.at(-1).date,
    ...shareAtOrBelow([...rsiBy[n.sym].values()]) }])),
  a_primary: {}, a_sensitivity: {}, b: {},
  sensitivity_members: sensMembers,
};
for (const f of FUNDS) {
  s1.a_primary[f] = indexVsMembers(align(f, TARGETS), { B, block: BLOCK, seed: SEED });
  s1.a_sensitivity[f] = indexVsMembers(align(f, sensMembers), { B, block: BLOCK, seed: SEED });
}
for (const n of names) {
  const vals = n.bars.map((b) => rsiBy[n.sym].get(b.date) ?? null);
  s1.b[n.sym] = percentileLineCoverage(vals, { B, block: BLOCK, seed: SEED });
}

// ---------------------------------------------------------------- S2
const s2 = { claim: "#24 (card I-2): Counting correlated indicators as independent inflates confidence.",
  threshold: THRESHOLD, threshold_status: "placeholder from the checkup, not ratified", K, names: {} };
s2.excluding_bad_prints = {};
for (const n of names) {
  s2.names[n.sym] = s2Name(n.bars, { K, threshold: THRESHOLD });
  const bad = badHighLow(n.bars);
  if (bad.length) s2.excluding_bad_prints[n.sym] = { flagged: bad, ...s2Name(n.bars, { K, threshold: THRESHOLD }, new Set(bad)) };
}

// ---------------------------------------------------------------- G0 for the readings: no repaint
const spy = by.SPY.bars;
const cuts = [300, 1000, 2500, 4000, spy.length - 1];
const g0 = {
  rsi: prefixStable((m) => rsiWilder(spy.slice(0, m).map((b) => b.c), 14), spy.length, cuts),
  williams_r: prefixStable((m) => { const s = spy.slice(0, m); return williamsR(s.map((b) => b.h), s.map((b) => b.l), s.map((b) => b.c), 14); }, spy.length, cuts),
  percentile_line: prefixStable((m) => {
    const r = rsiWilder(spy.slice(0, m).map((b) => b.c), 14);
    // the line value each day would have been drawn at, recomputed on the shorter history
    return r.map((_, i) => { const w = r.slice(Math.max(0, i - 252), i).filter((v) => v != null); return w.length === 252 ? quantile(w.sort((a, b) => a - b), 0.1) : null; });
  }, spy.length, cuts),
  on: "SPY", cuts,
};

const result = {
  run: "quant loop run 1 · S1 and S2", built_utc: new Date().toISOString(),
  request: manifest.request, fetched_utc: manifest.started_utc,
  params: { seed: SEED, bootstrap_B: B, block: BLOCK, K, threshold: THRESHOLD, percentile_window: 252 },
  bars: Object.fromEntries(names.map((n) => [n.sym, { provider: n.provider, price_basis: n.price_basis, served: n.served,
    kept: n.bars.length, dropped_before_listing_break: n.dropped, first: n.bars[0].date, last: n.bars.at(-1).date,
    finality_verified: n.finality_verified, wild_moves_beyond_50pct: n.wild_moves_in_segment, bad_high_low: badHighLow(n.bars), response_sha256: n.response_sha256 }])),
  g0, s1, s2,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
const pc = (x) => (x * 100).toFixed(2) + "%";
for (const f of FUNDS) { const a = s1.a_primary[f]; console.log(`S1a ${f} n=${a.n_dates} ${a.first}..${a.last} idx ${pc(a.index_share)} med ${pc(a.member_median_share)} diff ${pc(a.diff)} CI [${pc(a.ci[0])}, ${pc(a.ci[1])}] ${a.verdict.split(" —")[0]} | sens n=${s1.a_sensitivity[f].n_dates} diff ${pc(s1.a_sensitivity[f].diff)} CI [${pc(s1.a_sensitivity[f].ci[0])}, ${pc(s1.a_sensitivity[f].ci[1])}]`); }
for (const [k, v] of Object.entries(s1.b)) console.log(`S1b ${k} n=${v.n} fired ${v.fired} ${pc(v.share)} band [${pc(v.band[0])}, ${pc(v.band[1])}] ${v.verdict.split(" —")[0]}`);
for (const [k, v] of Object.entries(s2.names)) console.log(`S2 ${k} rho ${v.all.rho.toFixed(3)} CI [${v.all.ci[0].toFixed(3)}, ${v.all.ci[1].toFixed(3)}] neff ${v.all.n_eff.toFixed(0)}/${v.all.n} ${v.all.stamp} | early ${v.early.rho.toFixed(3)} ${v.early.stamp} late ${v.late.rho.toFixed(3)} ${v.late.stamp} agree ${pc(v.all.agreement)} lift ${v.all.lift?.toFixed(2)}`);
for (const [k, v] of Object.entries(s2.excluding_bad_prints)) console.log(`S2 excl ${k} flagged ${v.flagged.length} skipped ${v.skipped_near_bad_prints} rho ${v.all.rho.toFixed(3)} CI [${v.all.ci.map((x) => x.toFixed(3)).join(", ")}] early ${v.early.rho.toFixed(3)} ${v.early.stamp}`);
console.log("G0", JSON.stringify({ rsi: g0.rsi.ok, wr: g0.williams_r.ok, line: g0.percentile_line.ok }));
