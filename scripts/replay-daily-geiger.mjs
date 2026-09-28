#!/usr/bin/env node
/* TREE COHORTS (28 Sep, lane N5) — replay the daily-rung Geiger for every served symbol, one reading per session,
   so cohorts can be judged by how their members' Geigers actually move together (co-movement), not by label.

   The maths is the Hub's own: deliverables/20260927/geiger-review/geiger-replay.mjs rungReading on the newest 230
   daily bars ending at each session (the same call the coverage-tree tracking study made). Nothing here is wired
   into the Hub; it is research code that writes one JSON file.

   Usage: CANDLES_DIR=<dir of <SYM>.json from the chart API /candles?tf=D> node scripts/replay-daily-geiger.mjs <out.json> [sessions]
   Output: { dates: [...], sessions, window_bars, symbols: { SYM: { composite: [...], trend: [...], momentum: [...], ret: [...], n } } }
   A session with fewer than 230 prior bars, or no bar that day, is null (never filled in). ret = log return of close vs prior session. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { rungReading, WINDOW } = await import(pathToFileURL(join(ROOT, "deliverables/20260927/geiger-review/geiger-replay.mjs")));
const CANDLES = process.env.CANDLES_DIR;
const OUT = process.argv[2];
const SESSIONS = Number(process.argv[3] || 750);
if (!CANDLES || !OUT) { console.error("CANDLES_DIR and <out.json> are required"); process.exit(2); }

const raw = {};
for (const f of readdirSync(CANDLES)) {
  if (!f.endsWith(".json")) continue;
  const j = JSON.parse(readFileSync(join(CANDLES, f), "utf8"));
  const series = Array.isArray(j) ? j : j.series;
  if (!series || !series.length) continue;
  raw[j.symbol || f.slice(0, -5)] = series.map((b) => ({ d: new Date(b.t).toISOString().slice(0, 10), c: +b.c, h: +b.h, l: +b.l }));
}
const spy = raw.SPY; if (!spy) { console.error("SPY bars are needed for the session calendar"); process.exit(2); }
const DATES = spy.map((b) => b.d).slice(-SESSIONS);
const out = { built_utc: new Date().toISOString(), what: "Daily-rung Geiger replayed per served symbol, one reading per SPY session; null where the symbol had no bar or fewer than 230 prior bars.", sessions: DATES.length, window_bars: WINDOW, dates: DATES, symbols: {} };
let done = 0;
for (const [s, bars] of Object.entries(raw)) {
  const idx = new Map(bars.map((b, i) => [b.d, i]));
  const composite = new Array(DATES.length).fill(null), trend = composite.slice(), momentum = composite.slice(), ret = composite.slice();
  let n = 0;
  for (let k = 0; k < DATES.length; k++) {
    const i = idx.get(DATES[k]);
    if (i == null) continue;
    if (i >= 1 && bars[i - 1].c > 0 && bars[i].c > 0) ret[k] = Math.log(bars[i].c / bars[i - 1].c);
    if (i + 1 < WINDOW) continue;
    const r = rungReading(bars.slice(i + 1 - WINDOW, i + 1));
    if (!r || !Number.isFinite(r.composite)) continue;
    composite[k] = +r.composite.toFixed(5); trend[k] = +r.trend.toFixed(5); momentum[k] = r.momentum == null ? null : +r.momentum.toFixed(5); n++;
  }
  out.symbols[s] = { composite, trend, momentum, ret, n, first_bar: bars[0].d, bars: bars.length };
  if (++done % 50 === 0) console.error(`${done} symbols`);
}
writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify({ symbols: Object.keys(out.symbols).length, sessions: DATES.length, from: DATES[0], to: DATES[DATES.length - 1] }));
