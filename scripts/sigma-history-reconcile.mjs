/* M68 — does the backfill reproduce the counts data/scintilla-rules.json already recorded?
   Same 125-name sample, same last 60 sessions, same rules. If these two disagree, the backfill is
   not the live rule walked backwards and the whole study is suspect.
   Usage: node scripts/sigma-history-reconcile.mjs <bars-cache-dir> <out.json> [sessions] */
import fs from "node:fs";
import path from "node:path";
import { backfillSymbol } from "./scintillas-backfill.mjs";
import { detectPriceOutliers, stdev, assetClassOf } from "./scintillas-detect.mjs";

const CACHE = process.argv[2], OUT = process.argv[3], SESSIONS = Number(process.argv[4] || 60);
const MAX = 125;                                     // the sample size the rules file measured
const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const load = (s) => { const f = path.join(CACHE, s.replace(/[^A-Z0-9._-]/gi, "_") + ".json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).bars : null; };
const all = JSON.parse(fs.readFileSync(path.join(CACHE, "_universe.json"), "utf8"));

/* scripts/scintilla-rule-counts.mjs builds its sample this way: every fund, then an even sample of
   the single names. Repeated here exactly so the two runs look at the same names. */
const funds = all.filter((s) => assetClassOf(s, RULES) !== "equity");
const singles = all.filter((s) => assetClassOf(s, RULES) === "equity");
const step = Math.max(1, Math.ceil(singles.length / Math.max(0, MAX - funds.length)));
const sample = funds.concat(singles.filter((_, i) => i % step === 0)).slice(0, MAX);

const window = load("SPY").slice(-SESSIONS).map((b) => b.d);
const from = window[0], to = window.at(-1);
let statistical = 0, raw = 0, either = 0;
const perDay = {};
for (const sym of sample) {
  const bars = load(sym);
  if (!bars || bars.length < 25) continue;
  const rets = [], heartbeat = [];
  for (let i = 1; i < bars.length; i++) {
    rets.push((bars[i].c / bars[i - 1].c - 1) * 100);
    const w = rets.slice(-60);
    heartbeat.push({ date: bars[i].d, usual_day_60: w.length >= 20 ? stdev(w) : null, n: w.length });
  }
  const out = backfillSymbol({ detect: detectPriceOutliers, symbol: sym, bars, heartbeat, from, to, rules: RULES });
  for (const e of out.events) {
    either++;
    if (e.detail.fired.includes("statistical")) statistical++;
    if (e.detail.fired.includes("raw")) raw++;
    perDay[e.detail.session] = (perDay[e.detail.session] || 0) + 1;
  }
}
const counts = Object.values(perDay).sort((a, b) => a - b);
const r2 = (n) => Math.round(n * 100) / 100;
const replayed = { statistical: r2(statistical / SESSIONS), raw: r2(raw / SESSIONS), either: r2(either / SESSIONS),
  median_either: counts[Math.floor(counts.length / 2)], busiest_day: counts.at(-1) };
const recorded = RULES.measured.per_day_on_that_sample;
const result = { built_utc: new Date().toISOString(), sample: sample.length, funds: funds.length,
  sessions: SESSIONS, from, to, replayed, recorded,
  agreement: Object.fromEntries(Object.keys(recorded).map((k) => [k, r2(replayed[k] - recorded[k])])) };
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
