/* RS1 (6 Oct 2026) — THE PLAYBOOK LINE: an index's or macro series' daily RSI read against ITS OWN last two years.
   Alan, 6 Oct ~15:55 ET: "this is an interesting metric, playbook-level, at the important levels, for the SPY, for the
   QQQ, for the macro … what would the RSI on the SPY and the QQQ say against its own extremes?"

   For each instrument, as of one close:
     · today's daily RSI(14) and where it sits in its own two years (its percentile)
     · where its past pullback lows sat on that same ruler
     · how far today is from its own 90th percentile (its own top tenth)

   THE RULER is the same one the board cell is coloured by: supabase/functions/rsi-own-daily/rsi-own.mjs (imported, not
   copied) — Wilder's RSI(14) on finished daily closes, the two calendar years of sessions BEFORE the close being read.

   A PULLBACK is the estate's swing rule (research/statistics/s9-research.mjs swings(), imported): from a swing high to
   the next swing low, a swing point being a bar whose high (low) is beyond the 10 bars on each side, on wicks cleaned
   with cleanBars(). Its RSI low is the lowest daily RSI between that high and that low. Only pullbacks whose low falls
   inside the two-year window count. A swing low is only known 10 sessions later, so a dip that has not been confirmed
   yet is reported apart as "the dip still running". (This is the rule that reproduces the coordinator's "last pullback
   lows SPY 41.8, QQQ 44.0"; a closing-high rule with a 3% minimum does not see QQQ's September dip at all.)

   RUN (no key: the chart API is read with the Hub's origin; nothing is written anywhere but the two files named):
     node deliverables/20261006/rs1-rsi-own-extremes/tools/playbook-lines.mjs --as-of 2026-10-05 */
import fs from "node:fs";
import { rsiOwnRow, wilderRsi, percentileOf, rsiOwnSpan, SEVEN_DAY } from "../../../../supabase/functions/rsi-own-daily/rsi-own.mjs";
import { swings, cleanBars } from "../../../../research/statistics/s9-research.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const AS_OF = arg("as-of", null);
const OUT = new URL("../data/", import.meta.url);
const CHART = "https://scintilla-massive-chart-api.fly.dev";

/* The set. Indexes: the five the brief names. Macro: the series the R3 / R4 briefs and the Hub's MACRO tab share that
   are price-like and served daily (US2Y and the 2s10s spread have no daily bars on the chart API). */
const SET = [
  { t: "SPY", name: "S&P 500 fund", group: "index" },
  { t: "QQQ", name: "Nasdaq 100 fund", group: "index" },
  { t: "IWM", name: "Small caps fund", group: "index" },
  { t: "RSP", name: "Equal-weight S&P fund", group: "index" },
  { t: "SMH", name: "Semiconductors fund", group: "index" },
  { t: "VIX", name: "Volatility index", group: "macro", side: "high", maxWick: 1.0 },
  { t: "US10Y", name: "Ten-year yield", group: "macro", rising: "yields rising" },
  { t: "DXUSD", name: "Dollar index", group: "macro", rising: "the dollar rising" },
  { t: "GCUSD", name: "Gold", group: "macro" },
  { t: "CLUSD", name: "Oil", group: "macro" },
  { t: "BTCUSD", name: "Bitcoin", group: "macro", maxWick: 0.5 },
  { t: "HYG", name: "High-yield credit fund", group: "macro" },
  { t: "LQD", name: "Investment-grade credit fund", group: "macro" },
  { t: "TLT", name: "Long Treasury fund", group: "macro" },
];

const get = async (p) => {
  for (let k = 0; k < 3; k++) {
    const r = await fetch(CHART + p, { headers: { origin: "https://scintillahub.ai" } });
    if (r.ok) return r.json();
    if (r.status < 500 && r.status !== 429) throw new Error("chart " + r.status);
    await new Promise((res) => setTimeout(res, 1500 * (k + 1)));
  }
  throw new Error("chart retries exhausted");
};
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const r1 = (x) => Math.round(x * 10) / 10;
const median = (xs) => { const a = [...xs].sort((p, q) => p - q), m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const say = (iso) => +iso.slice(8) + " " + MON[+iso.slice(5, 7) - 1] + (iso.slice(0, 4) === (AS_OF || "").slice(0, 4) || !AS_OF ? "" : " " + iso.slice(0, 4));
/* a percentile in words, never "0th" or "100%" */
const where = (pct) => pct <= 0 ? "the lowest of the window" : pct >= 100 ? "the highest of the window"
  : pct < 50 ? "lower than " + Math.min(99, Math.round(100 - pct)) + "% of its days" : "higher than " + Math.min(99, Math.round(pct)) + "% of its days";

async function one(I) {
  const raw = await get(`/candles?symbol=${encodeURIComponent(I.t)}&tf=1d&limit=1300`);
  const served = (raw.series || raw.candles || []);
  const sevenDay = SEVEN_DAY.includes(I.t);
  /* the same bars the ruler reads: nothing after the close being read, no weekend prints (except Bitcoin's) */
  let bars = served.filter((b) => Number.isFinite(b.t) && b.c > 0 && (!AS_OF || day(b.t) <= AS_OF) && (sevenDay || ![0, 6].includes(new Date(b.t).getUTCDay())));
  const got = rsiOwnRow(I.t, served, { asOf: AS_OF });
  if (!got.row) return { ...I, ok: false, reason: got.reason };
  const row = got.row;
  bars = bars.filter((b) => day(b.t) <= row.as_of);
  const clean = cleanBars(bars, I.maxWick ?? 0.25).bars;
  const rsi = wilderRsi(clean.map((b) => +b.c));
  const dates = clean.map((b) => day(b.t)), L = clean.length - 1;
  const sw = swings(clean.map((b) => +b.h), clean.map((b) => +b.l), 10);
  const lows = [];
  for (let i = 0; i + 1 < sw.length; i++) {
    const a = sw[i], b = sw[i + 1];
    if (a.type !== "H" || b.type !== "L" || dates[b.k] < row.window_from) continue;
    let m = null, mk = null;
    for (let k = a.k; k <= b.k; k++) if (rsi[k] != null && (m == null || rsi[k] < m)) { m = rsi[k]; mk = k; }
    if (m == null) continue;
    lows.push({ top: dates[a.k], low: dates[b.k], depth_pct: r1((clean[b.k].l / clean[a.k].h - 1) * 100), rsi_low: r1(m), rsi_low_on: dates[mk], pct: percentileOf(row.grid, m) });
  }
  /* the dip still running: the last swing is a high, no swing low is confirmed after it, and price has not been back
     above that high — the lowest RSI since that high. (Price already above the high is a new advance, not a dip.) */
  const lastSw = sw[sw.length - 1];
  let running = null;
  if (lastSw && lastSw.type === "H" && lastSw.k < L) {
    let m = null, mk = null, above = false;
    for (let k = lastSw.k + 1; k <= L; k++) {
      if (+clean[k].h > lastSw.price) above = true;
      if (rsi[k] != null && (m == null || rsi[k] < m)) { m = rsi[k]; mk = k; }
    }
    if (m != null && !above) running = { since: dates[lastSw.k], rsi_low: r1(m), rsi_low_on: dates[mk], pct: percentileOf(row.grid, m), is_today: mk === L };
  }
  const lowRsis = lows.map((p) => p.rsi_low), lowPcts = lows.map((p) => p.pct);
  return {
    ...I, ok: true, as_of: row.as_of, window_from: row.window_from, sessions: row.sessions, eligible: row.eligible, span: rsiOwnSpan(row.window_from, row.as_of),
    rsi: r1(row.rsi), pct: row.pct, p10: r1(row.p10), p20: r1(row.p20), p50: r1(row.p50), p80: r1(row.p80), p90: r1(row.p90),
    to_90th_points: r1(row.p90 - row.rsi), to_90th_percentile_points: r1(90 - row.pct),
    pullbacks: lows.length, pullback_rsi_min: lows.length ? Math.min(...lowRsis) : null, pullback_rsi_max: lows.length ? Math.max(...lowRsis) : null,
    pullback_rsi_median: lows.length ? r1(median(lowRsis)) : null, pullback_pct_median: lows.length ? r1(median(lowPcts)) : null,
    pullback_pct_min: lows.length ? Math.min(...lowPcts) : null, pullback_pct_max: lows.length ? Math.max(...lowPcts) : null,
    last_pullback: lows.length ? lows[lows.length - 1] : null, running, lows,
    weekend_bars_dropped: got.weekend_bars_dropped || 0,
  };
}

function line(x) {
  if (!x.ok) return `${x.t} (${x.name}) — no reading: ${x.reason}.`;
  const n = Math.round(x.rsi);
  const head = `${x.t} (${x.name}) — daily RSI ${n} at the ${say(x.as_of)} close: ` +
    (x.pct <= 0 ? `the lowest reading of its own ${x.span}` : x.pct >= 100 ? `the highest reading of its own ${x.span}`
      : (x.pct < 50 ? `lower than ${Math.min(99, Math.round(100 - x.pct))}%` : `higher than ${Math.min(99, Math.round(x.pct))}%`) + ` of its own ${x.span}`) +
    (x.pct <= 10 ? ` — inside its own bottom tenth (${Math.round(x.p10)} or lower)` : "") + ".";
  const gap = x.to_90th_points;
  const top = gap > 0 ? ` Its own top tenth starts at ${Math.round(x.p90)}: today is ${Math.round(gap)} points below it.`
    : ` Its own top tenth starts at ${Math.round(x.p90)}: today is ${Math.round(-gap)} points above it, inside that top tenth.`;
  let pull = "";
  if (x.side === "high") pull = " (For the volatility index the meaningful extreme is the spike, not the pullback low, so no pullback clause.)";
  else if (!x.pullbacks) pull = ` No completed pullback in its own ${x.span}.`;
  else {
    const lp = x.last_pullback;
    pull = ` Its ${x.pullbacks} pullbacks in that time bottomed at an RSI between ${Math.round(x.pullback_rsi_min)} and ${Math.round(x.pullback_rsi_max)}, typically ${Math.round(x.pullback_rsi_median)} (${where(x.pullback_pct_median)}); ` +
      `the last, ${say(lp.low)}, bottomed at ${Math.round(lp.rsi_low)} (${where(lp.pct)}).`;
  }
  /* said only when it is a dip on the instrument's own scale (below its own middle) */
  const run = x.running && x.side !== "high" && x.running.pct < 50
    ? (x.running.is_today ? ` The dip still running (no swing low confirmed yet) made its lowest RSI so far today.`
      : ` A dip is still running (no swing low confirmed yet): its lowest RSI so far is ${Math.round(x.running.rsi_low)} on ${say(x.running.rsi_low_on)} (${where(x.running.pct)}).`) : "";
  const dir = x.rising ? ` (A high reading here means ${x.rising}.)` : "";
  return head + top + pull + run + dir;
}

const rows = [];
for (const I of SET) { try { rows.push(await one(I)); } catch (e) { rows.push({ ...I, ok: false, reason: String(e.message || e).slice(0, 60) }); } }
const lines = rows.map(line);
fs.writeFileSync(new URL("playbook-lines.json", OUT), JSON.stringify({ made: new Date().toISOString(), as_of_asked: AS_OF, ruler: "rsi-own.mjs ro-1: Wilder RSI(14), the two calendar years of finished sessions before the close", pullback_rule: "s9-research swings(h, l, 10) on cleaned wicks; RSI low = lowest daily RSI between swing high and next swing low; lows inside the window only", rows, lines }, null, 1));
fs.writeFileSync(new URL("playbook-lines.txt", OUT), lines.join("\n\n") + "\n");
console.log(lines.join("\n\n"));
console.log("\n--- table ---");
for (const x of rows) if (x.ok) console.log(`${x.t.padEnd(7)} rsi ${String(x.rsi).padStart(5)} pct ${String(x.pct).padStart(5)} | 10th ${x.p10} 90th ${x.p90} | to 90th ${x.to_90th_points} pts | pullbacks ${x.pullbacks}: rsi ${x.pullback_rsi_min}..${x.pullback_rsi_max} med ${x.pullback_rsi_median} = pct med ${x.pullback_pct_median} | last ${x.last_pullback ? x.last_pullback.low + " " + x.last_pullback.rsi_low + " (" + x.last_pullback.pct + ")" : "-"} | running ${x.running ? x.running.rsi_low + " on " + x.running.rsi_low_on + " (" + x.running.pct + ")" : "-"} | n ${x.sessions}`);
